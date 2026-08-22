import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';
import { createInterpolationRegex } from '../../lib/core/utils/templateUtils.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { extractCompiledTemplate } from '../helpers/compiled-template.js';

/**
 * Regression coverage for the compiler and the runtime disagreeing on what an
 * interpolation is. The compiler validated expressions with [\s\S] while the
 * runtime parsed them with `.`, so an expression wrapped onto a second line
 * passed compile-time validation and then rendered as literal braces in the
 * page, with no warning anywhere.
 */

const scope = {
  ok: true,
  count: 2,
  user: { name: 'Ada', role: 'admin' },
};

/**
 * Evaluates an expression against the fixture scope.
 * @param {string} expression - Expression source.
 * @returns {any}
 */
function resolve(expression) {
  // eslint-disable-next-line no-new-func
  return new Function('s', `with (s) { return (${expression}); }`)(scope);
}

/**
 * Expressions spanning multiple lines must render, not leak literal braces.
 */
function testMultilineExpressionsRender() {
  console.log('🧪 Testing multi-line interpolations render...');
  const renderer = new TemplateRenderer();

  assert.strictEqual(renderer.render('<p>{{ 1 +\n 2 }}</p>', resolve), '<p>3</p>');

  const wrappedTernary = '<p>{{ ok\n  ? user.name\n  : "nobody" }}</p>';
  assert.strictEqual(renderer.render(wrappedTernary, resolve), '<p>Ada</p>');

  const wrappedObject = '<p>{{ JSON.stringify({\n  a: count,\n  b: user.role\n}) }}</p>';
  assert.strictEqual(
    renderer.render(wrappedObject, resolve),
    '<p>{&quot;a&quot;:2,&quot;b&quot;:&quot;admin&quot;}</p>',
  );

  const crlf = '<p>{{ count +\r\n count }}</p>';
  assert.strictEqual(renderer.render(crlf, resolve), '<p>4</p>', 'CRLF line endings should also work');

  console.log('  ✅ Multi-line interpolations render correctly.');
}

/**
 * The raw triple-brace form must behave the same way.
 */
function testMultilineRawInterpolation() {
  console.log('🧪 Testing multi-line raw interpolations...');
  const renderer = new TemplateRenderer();

  const raw = '<p>{{{ ok\n  ? "<b>yes</b>"\n  : "" }}}</p>';
  assert.strictEqual(renderer.render(raw, resolve), '<p><b>yes</b></p>');

  console.log('  ✅ Multi-line raw interpolations render correctly.');
}

/**
 * Single-line behaviour and escaping must be unchanged.
 */
function testSingleLineBehaviourUnchanged() {
  console.log('🧪 Testing single-line interpolation behaviour is unchanged...');
  const renderer = new TemplateRenderer();

  assert.strictEqual(renderer.render('<p>{{ 1 + 2 }}</p>', resolve), '<p>3</p>');
  assert.strictEqual(renderer.render('<p>{{ user.name }}</p>', resolve), '<p>Ada</p>');
  assert.strictEqual(renderer.render('<p>no expressions here</p>', resolve), '<p>no expressions here</p>');
  assert.strictEqual(
    renderer.render('<p>{{ "<script>" }}</p>', resolve),
    '<p>&lt;script&gt;</p>',
    'escaping must still apply to multi-line-capable matching',
  );
  assert.strictEqual(
    renderer.render('<p>{{ user.name }} and {{ count }}</p>', resolve),
    '<p>Ada and 2</p>',
    'non-greedy matching must not swallow the text between two interpolations',
  );

  console.log('  ✅ Single-line behaviour preserved.');
}

/**
 * The compiler and the runtime must agree on the interpolation grammar.
 */
function testCompilerAndRuntimeAgree() {
  console.log('🧪 Testing compiler and runtime accept the same expressions...');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-multiline-'));
  try {
    const filePath = path.join(tmpDir, 'Wrapped.component.js');
    fs.writeFileSync(
      filePath,
      '<state ok="true" />\n<div><p>{{ ok\n  ? "yes"\n  : "no" }}</p></div>\n',
    );

    const parser = new ComponentParser(new StyleProcessor({}, {}), [], {});
    const generated = parser.parse(filePath);
    const template = extractCompiledTemplate(generated);

    // The compiler must preserve the wrapped expression, and the runtime's
    // parser must then recognise it as a single interpolation segment.
    const renderer = new TemplateRenderer();
    const segments = renderer.parseTemplate(template);
    const expressions = segments.filter((segment) => segment.isExpression);

    assert.strictEqual(expressions.length, 1, 'the wrapped expression should parse as one interpolation');
    assert.ok(expressions[0].expression.includes('?'), 'the full expression should be captured');
    assert.strictEqual(
      renderer.render(template, () => 'yes'),
      '<div><p>yes</p></div>',
      'the compiled template should render without literal braces',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('  ✅ Compiler and runtime agree on multi-line expressions.');
}

/**
 * The shared pattern must be a fresh instance per call, since it is global.
 */
function testSharedPatternIsStateless() {
  console.log('🧪 Testing the shared interpolation pattern is per-call...');

  const first = createInterpolationRegex();
  const second = createInterpolationRegex();
  assert.notStrictEqual(first, second, 'each call must return a new regex instance');

  first.exec('{{ a }} {{ b }}');
  assert.strictEqual(second.lastIndex, 0, 'a fresh instance must not inherit lastIndex');

  console.log('  ✅ Shared pattern is stateless across callers.');
}

try {
  testMultilineExpressionsRender();
  testMultilineRawInterpolation();
  testSingleLineBehaviourUnchanged();
  testCompilerAndRuntimeAgree();
  testSharedPatternIsStateless();
  console.log('🎉 All multi-line interpolation tests passed successfully!');
} catch (err) {
  console.error('❌ Multi-line interpolation test failed:', err);
  process.exit(1);
}
