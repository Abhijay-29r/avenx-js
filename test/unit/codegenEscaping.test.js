import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';

/**
 * Regression coverage for code generation emitting the compiled template into a
 * backtick-wrapped template literal. Any `${...}` in component HTML was then
 * evaluated as JavaScript when the generated bundle loaded, and backticks or
 * backslashes in a template could terminate or corrupt the literal.
 */

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-codegen-'));

/**
 * Compiles a component source string and returns the generated class source.
 * @param {string} name - Component base name.
 * @param {string} source - Component file contents.
 * @param {'component'|'page'} [type] - Compilation type.
 * @returns {string} Generated JavaScript.
 */
function compile(name, source, type = 'component') {
  const suffix = type === 'page' ? '.page.js' : '.component.js';
  const filePath = path.join(tmpDir, `${name}${suffix}`);
  fs.writeFileSync(filePath, source);
  const parser = new ComponentParser(new StyleProcessor({}, {}), [], {});
  return parser.parse(filePath, type);
}

/**
 * Evaluates generated component source and captures the constructor arguments
 * the runtime would receive, without loading the real runtime.
 * @param {string} generated - Generated class source.
 * @param {string} className - Name of the generated class.
 * @returns {{template: string, methods: object, sideEffect: any}}
 */
function instantiate(generated, className) {
  const captured = {};
  globalThis.__codegenSideEffect = undefined;

  class StubBase {
    /**
     * @param {...any} args - Constructor arguments produced by the compiler.
     */
    constructor(...args) {
      captured.template = args[3];
      captured.methods = args[4];
    }
  }

  const factory = new Function(
    'AvenxComponent',
    'AvenxPage',
    `${generated}\nreturn new ${className}({}, {});`,
  );
  factory(StubBase, StubBase);

  return {
    template: captured.template,
    methods: captured.methods,
    sideEffect: globalThis.__codegenSideEffect,
  };
}

/**
 * A `${...}` sequence in template HTML must reach the runtime as literal text
 * and must not execute during bundle load.
 */
function testDollarBraceIsNotInterpolated() {
  console.log('🧪 Testing ${...} inside template HTML is not executed...');

  const generated = compile(
    'Injection',
    '<state msg="hi" />\n<div>${globalThis.__codegenSideEffect = "executed"}<span>{{ msg }}</span></div>\n',
  );
  const { template, sideEffect } = instantiate(generated, 'Injection');

  assert.strictEqual(sideEffect, undefined, 'template content must not execute during bundle load');
  assert.ok(
    template.includes('${globalThis.__codegenSideEffect = "executed"}'),
    'the ${...} sequence must be preserved verbatim in the template',
  );
  console.log('  ✅ ${...} preserved as literal text.');
}

/**
 * A currency-style `${name}` — the common accidental form — must survive intact.
 */
function testCurrencyStyleDollarBrace() {
  console.log('🧪 Testing ${amount} style content survives compilation...');

  const generated = compile('Price', '<state amount="5" />\n<div><p>Cost: ${amount} today</p></div>\n');
  const { template } = instantiate(generated, 'Price');

  assert.ok(template.includes('Cost: ${amount} today'), 'literal ${amount} must be preserved');
  console.log('  ✅ Literal ${amount} preserved.');
}

/**
 * Backticks and backslashes must round-trip through code generation.
 */
function testBackticksAndBackslashes() {
  console.log('🧪 Testing backticks and backslashes in templates...');

  const generated = compile(
    'Ticks',
    '<state active="true" />\n<div><p>a `tick` and a back\\slash</p><span>{{ active ? `on` : `off` }}</span></div>\n',
  );
  const { template } = instantiate(generated, 'Ticks');

  assert.ok(template.includes('a `tick` and a back\\slash'), 'backticks and backslashes must be preserved');
  assert.ok(template.includes('{{ active ? `on` : `off` }}'), 'backticks inside interpolations must be preserved');
  console.log('  ✅ Backticks and backslashes preserved.');
}

/**
 * A legitimate template literal inside an <action> body must remain source code
 * rather than being interpolated while the bundle loads.
 */
function testActionBodyTemplateLiteral() {
  console.log('🧪 Testing template literals inside <action> bodies...');

  const generated = compile(
    'Fmt',
    '<state n="1" />\n<action name="label">\nreturn `total: ${n + 1}`;\n</action>\n<div>{{ n }}</div>\n',
  );
  const { methods } = instantiate(generated, 'Fmt');

  assert.ok(methods.label.includes('${n + 1}'), 'action body template literal must be preserved as source');
  assert.ok(!methods.label.includes('total: 2'), 'action body must not be evaluated at bundle load');
  console.log('  ✅ Action body preserved as source.');
}

/**
 * The generated source must remain syntactically valid for hostile-looking input.
 */
function testGeneratedSourceStaysParseable() {
  console.log('🧪 Testing generated source parses for awkward template content...');

  const cases = [
    ['Quotes', '<div><p>He said "hi" and \'bye\'</p></div>'],
    ['Newlines', '<div>\n<p>line one</p>\n<p>line two</p>\n</div>'],
    ['ScriptEnd', '<div><p>an end tag: &lt;/script&gt;</p></div>'],
    ['Unicode', '<div><p>emoji 🎯 and accents éàü</p></div>'],
  ];

  for (const [name, body] of cases) {
    const generated = compile(name, `<state x="1" />\n${body}\n`);
    assert.doesNotThrow(() => {
      new Function('AvenxComponent', 'AvenxPage', generated);
    }, `generated source for ${name} should parse`);
  }
  console.log('  ✅ Generated source parses in all cases.');
}

/**
 * Pages use a separate code generation branch and need the same guarantee.
 */
function testPageCodegenIsAlsoSafe() {
  console.log('🧪 Testing page code generation applies the same escaping...');

  const generated = compile(
    'Landing',
    '<state msg="hi" />\n<div>${globalThis.__codegenSideEffect = "page-executed"}<span>{{ msg }}</span></div>\n',
    'page',
  );
  const { template, sideEffect } = instantiate(generated, 'Landing');

  assert.strictEqual(sideEffect, undefined, 'page template content must not execute during bundle load');
  assert.ok(template.includes('${globalThis.__codegenSideEffect'), 'page template must preserve ${...} verbatim');
  console.log('  ✅ Page code generation is safe.');
}

try {
  testDollarBraceIsNotInterpolated();
  testCurrencyStyleDollarBrace();
  testBackticksAndBackslashes();
  testActionBodyTemplateLiteral();
  testGeneratedSourceStaysParseable();
  testPageCodegenIsAlsoSafe();
  console.log('🎉 All code generation escaping tests passed successfully!');
} catch (err) {
  console.error('❌ Code generation escaping test failed:', err);
  process.exit(1);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
