/**
 * @file templateFrontEnd.test.js
 * @description The template front-end must never silently change what a
 * template means.
 *
 * Every case here was a reproduced miscompile: the build succeeded, and the
 * program it emitted described a different template than the one written.
 * Before the shared markup lexer, `@css`, `data-ax-bind` and comment stripping
 * were applied by regular expressions that treated the first `>` as the end of
 * a tag and any `<!--` as a comment, wherever they appeared.
 *
 * The assertions read the emitted render program and the expression sources it
 * addresses, which is what a production bundle executes.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-front-end-'));
let fileCounter = 0;

/**
 * Compiles one component source and returns what the build would emit.
 * @param {string} source - The component file contents.
 * @param {string} [css] - The component stylesheet contents.
 * @returns {{parser: ComponentParser, style: StyleProcessor, generated: string,
 *   program: object|null, exprs: string[], stmts: string[]}} The result.
 */
function compile(source, css = '<@css>\n  button { color: red; }\n  card { padding: 1rem; }\n</@css>\n') {
  // Each probe gets its own directory and the same file name, so the component
  // name -- which is part of every scoped-class hash -- is identical across
  // probes and two compilations can be compared byte for byte.
  fileCounter += 1;
  const dir = path.join(workDir, String(fileCounter));
  fs.mkdirSync(dir);
  const base = path.join(dir, 'probe');
  fs.writeFileSync(`${base}.component.js`, source);
  fs.writeFileSync(`${base}.component.css`, css);

  const style = new StyleProcessor();
  const parser = new ComponentParser(style);
  const generated = parser.parse(`${base}.component.js`);

  const readJson = (pattern) => {
    const match = generated.match(pattern);
    return match ? JSON.parse(match[1]) : null;
  };

  return {
    parser,
    style,
    generated,
    program: readJson(/\.__axProgram = (\{.*\});\n/),
    exprs: readJson(/\.__axProgramExprSrc = (\[.*\]);\n/) || [],
    stmts: readJson(/\.__axProgramStmtSrc = (\[.*\]);\n/) || [],
  };
}

/**
 * Asserts a template compiled to a program with nothing refused or deferred.
 * @param {object} result - A {@link compile} result.
 * @param {string} label - What is being compiled, for the failure message.
 */
function assertCompiled(result, label) {
  assert.deepStrictEqual(result.parser.renderFallbacks, [], `${label}: must not fall back`);
  assert.deepStrictEqual(result.parser.expressionGaps, [], `${label}: every expression must compile`);
  assert.ok(result.program, `${label}: a render program must be emitted`);
}

/**
 * Asserts that compiling throws a diagnostic with the given code.
 * @param {string} source - The component source.
 * @param {string} code - The expected diagnostic code.
 * @param {string} label - What is being compiled.
 */
function assertRejected(source, code, label) {
  assert.throws(
    () => compile(source),
    (error) => {
      assert.strictEqual(error.code, code, `${label}: expected ${code}, got ${error.code}: ${error.message}`);
      return true;
    },
    `${label}: must fail the build`,
  );
}

try {
  console.log('🧪 Template front-end: expression content is never read as markup');

  // 1. A `>` inside a quoted handler on a tag that also carries `@css`.
  const gtAfter = compile(
    '<state count="0" />\n<div><button @click="count > 3 ? count = 0 : count++" @css button>x</button></div>',
  );
  assertCompiled(gtAfter, '@css after a handler containing ">"');
  const events = gtAfter.program.ops.filter((op) => op.k === 'event');
  assert.deepStrictEqual(
    events.map((op) => op.n),
    ['click'],
    '@css must not become an event handler',
  );
  assert.strictEqual(gtAfter.stmts[events[0].x], 'count > 3 ? count = 0 : count++');
  assert.match(gtAfter.program.html, /<button class="avenx-[0-9a-f]+" data-axb="0">x<\/button>/);
  assert.ok(!/\bbutton="true"/.test(gtAfter.program.html), 'the block name must not become an attribute');
  assert.match(gtAfter.style.scopedStyles, /\.avenx-[0-9a-f]+ \{ color: red; \}/, 'the block must be emitted');

  // 2. The same tag with its attributes in the other order means the same thing.
  const gtBefore = compile(
    '<state count="0" />\n<div><button @css button @click="count > 3 ? count = 0 : count++">x</button></div>',
  );
  assertCompiled(gtBefore, '@css before a handler containing ">"');
  assert.deepStrictEqual(gtBefore.program, gtAfter.program, 'attribute order must not change the program');
  assert.deepStrictEqual(gtBefore.stmts, gtAfter.stmts);

  // 3. A double-quoted string inside a single-quoted handler survives the
  //    static-subtree pass's serialise/parse round trip.
  const quoted = compile('<state msg="" />\n<div><button @click=\'msg = "hi"\'>x</button><p>{{ msg }}</p></div>');
  assertCompiled(quoted, 'double quotes inside a single-quoted attribute');
  assert.deepStrictEqual(quoted.stmts, ['msg = "hi"']);

  // 4. Comment-like text inside an attribute value is not a comment.
  const commentInAttr = compile('<state a="" />\n<div title="<!-- not a comment -->">{{ a }}</div>');
  assertCompiled(commentInAttr, 'comment-like attribute value');
  assert.ok(
    commentInAttr.program.html.includes('title="<!-- not a comment -->"'),
    `the attribute value must be preserved, got ${commentInAttr.program.html}`,
  );

  // 5. A real comment is still removed.
  const realComment = compile('<state a="" />\n<div><!-- remove me -->{{ a }}</div>');
  assertCompiled(realComment, 'template comment');
  assert.ok(!realComment.program.html.includes('remove me'));

  // 6. A `<` inside an interpolation is an operator, not a tag.
  const ltInText = compile('<state a="1" b="2" />\n<div><p>{{ a <b }}</p></div>');
  assertCompiled(ltInText, '"<" inside an interpolation');
  assert.deepStrictEqual(ltInText.exprs, ['a <b']);
  assert.ok(!ltInText.program.html.includes('<b'), `no <b> element may be invented, got ${ltInText.program.html}`);

  // 7. data-ax-bind on a tag whose other attributes contain ">".
  const bindGt = compile('<state v="" />\n<div><input title="a > b" data-ax-bind="v" /></div>');
  assertCompiled(bindGt, 'data-ax-bind beside ">"');
  assert.ok(!bindGt.program.html.includes('data-ax-bind'), 'data-ax-bind must be expanded');
  assert.ok(bindGt.program.html.includes('title="a > b"'), 'the other attribute must be preserved');
  assert.ok(
    bindGt.program.ops.some((op) => op.k === 'attr' && op.a === 'value'),
    'the bound value must become an attribute binding',
  );
  assert.ok(
    bindGt.program.ops.some((op) => op.k === 'event' && op.n === 'input'),
    'the bound value must write back on input',
  );

  // 8. data-ax-bind whose expression contains a double quote.
  const bindQuoted = compile('<state user="{}" />\n<div><input data-ax-bind=\'user["name"]\' /></div>');
  assertCompiled(bindQuoted, 'data-ax-bind with a quoted member access');
  assert.ok(bindQuoted.exprs.includes('user["name"]'), `got ${JSON.stringify(bindQuoted.exprs)}`);
  assert.ok(bindQuoted.stmts.includes('user["name"] = event.target.value'), `got ${JSON.stringify(bindQuoted.stmts)}`);

  // 9. Whitespace inside attribute values is not collapsed by bind expansion.
  const bindSpaces = compile('<state v="" />\n<div><input placeholder="a    b" data-ax-bind="v" /></div>');
  assertCompiled(bindSpaces, 'data-ax-bind beside a value with repeated spaces');
  assert.ok(bindSpaces.program.html.includes('placeholder="a    b"'), bindSpaces.program.html);

  // 10. Multi-line tags, escaped quotes and nested brackets.
  const multiline = compile(
    [
      '<state items="[]" />',
      '<div>',
      '  <button',
      '    @css button',
      '    @click="items = items.filter((i) => i.score > 3 && i.label !== \'>\')"',
      '    title=\'say "hi" > bye\'',
      '  >go</button>',
      '</div>',
    ].join('\n'),
  );
  assertCompiled(multiline, 'multi-line tag');
  assert.deepStrictEqual(multiline.stmts, ["items = items.filter((i) => i.score > 3 && i.label !== '>')"]);
  assert.match(multiline.program.html, /class="avenx-[0-9a-f]+"/);

  console.log('🧪 Template front-end: <@css /> placement follows the documentation');

  // 11. First child: styles the host.
  const hostTag = compile('<div>\n  <@css card />\n  <h1>t</h1>\n</div>');
  assertCompiled(hostTag, '<@css /> as first child');
  assert.match(hostTag.program.html, /^<div class="avenx-[0-9a-f]+">/);

  // 12. Immediately after an element: styles that element (docs: styling.md §2).
  const siblingTag = compile('<section><div>Card content</div>\n<@css card /></section>');
  assertCompiled(siblingTag, '<@css /> after a sibling element');
  assert.match(siblingTag.program.html, /<div class="avenx-[0-9a-f]+">Card content<\/div>/);
  assert.ok(!siblingTag.program.html.includes('@css'));

  // 13. Two blocks on one element both apply.
  const twoBlocks = compile('<div @css card @css button>x</div>');
  assertCompiled(twoBlocks, 'two @css blocks');
  assert.match(twoBlocks.program.html, /^<div class="avenx-[0-9a-f]+ avenx-[0-9a-f]+">/);

  console.log('🧪 Template front-end: invalid templates fail the build');

  assertRejected('<div @css>x</div>', AvenxErrorCodes.COMPILER_INVALID_STYLE_DIRECTIVE, '@css without a block name');
  assertRejected('<div @css="card">x</div>', AvenxErrorCodes.COMPILER_INVALID_STYLE_DIRECTIVE, '@css with a value');
  assertRejected('<div>\n  <p title="unterminated>\n</div>', AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE, 'unterminated tag');
  assertRejected('<div><!-- never closed </div>', AvenxErrorCodes.COMPILER_MALFORMED_TEMPLATE, 'unterminated comment');

  console.log('🧪 Template front-end: compilation is deterministic');

  const deterministicSource =
    '<state count="0" />\n<div @css card><button @css button @click="count > 1 ? count-- : count++">{{ count }}</button></div>';
  const first = compile(deterministicSource);
  const second = compile(deterministicSource);
  assert.strictEqual(first.generated, second.generated);
  assert.strictEqual(first.style.scopedStyles, second.style.scopedStyles);

  console.log('  ✅ Template front-end tests passed!');
} catch (error) {
  console.error('❌ Template front-end tests failed:', error);
  process.exitCode = 1;
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
