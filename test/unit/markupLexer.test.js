/**
 * @file markupLexer.test.js
 * @description The shared template lexer.
 *
 * Two kinds of assertion. Targeted cases pin the grammar decisions that the
 * regex front-end got wrong. A randomised pass pins the structural invariant
 * every consumer relies on: tokens tile the source exactly, so an edit made by
 * span can never lose or duplicate a character, whatever the input.
 */
import assert from 'node:assert';
import {
  tokenizeMarkup,
  findTagEnd,
  applyEdits,
  quoteAttributeValue,
  interpolationEnd,
} from '../../lib/core/utils/markupLexer.js';

/**
 * Asserts the tiling invariant for one source.
 * @param {string} source - Any string.
 */
function assertTiles(source) {
  const tokens = tokenizeMarkup(source);
  let cursor = 0;
  for (const token of tokens) {
    assert.strictEqual(token.start, cursor, `gap or overlap at ${cursor} in ${JSON.stringify(source)}`);
    assert.ok(token.end > token.start, `empty token at ${cursor} in ${JSON.stringify(source)}`);
    cursor = token.end;
    for (const attr of token.attrs || []) {
      assert.ok(attr.start >= token.start && attr.end <= token.end, 'attribute outside its tag');
    }
  }
  assert.strictEqual(cursor, source.length, `tokens do not reach the end of ${JSON.stringify(source)}`);
}

/**
 * Returns the open tokens of a source.
 * @param {string} source - Markup.
 * @returns {object[]} Open-tag tokens.
 */
function opens(source) {
  return tokenizeMarkup(source).filter((token) => token.type === 'open');
}

try {
  console.log('🧪 markupLexer: tag extents');

  const gt = opens('<button @click="a > b ? x() : y()" @css button>go</button>');
  assert.strictEqual(gt.length, 1);
  assert.deepStrictEqual(
    gt[0].attrs.map((a) => [a.name, a.value, a.quote]),
    [
      ['@click', 'a > b ? x() : y()', '"'],
      ['@css', null, null],
      ['button', null, null],
    ],
  );

  const single = opens(`<a @click='say("hi")' title="it's">x</a>`)[0];
  assert.deepStrictEqual(single.attrs.map((a) => [a.name, a.value, a.quote]), [
    ['@click', 'say("hi")', "'"],
    ['title', "it's", '"'],
  ]);

  const escaped = opens(`<a @click='say(\\'hi\\')'>x</a>`)[0];
  assert.strictEqual(escaped.attrs[0].value, "say(\\'hi\\')", 'backslash escapes are preserved verbatim');

  const unquoted = opens('<input value={{ a > b }} disabled/>')[0];
  assert.deepStrictEqual(unquoted.attrs.map((a) => [a.name, a.value]), [
    ['value', '{{ a > b }}'],
    ['disabled', null],
  ]);
  assert.strictEqual(unquoted.selfClosing, true);

  const slashValue = opens('<img src=a/>')[0];
  assert.strictEqual(slashValue.attrs[0].value, 'a');
  assert.strictEqual(slashValue.selfClosing, true);

  const apostrophe = opens("<div data-x=it's>t</div>")[0];
  assert.strictEqual(apostrophe.attrs[0].value, "it's", 'a quote inside an unquoted value does not open a string');
  assert.ok(!apostrophe.unterminated);

  const directive = opens('<@for row in rows.filter(r => r.score > 90)><p>{{ row }}</p></@for>')[0];
  assert.strictEqual(directive.name, '@for');
  assert.strictEqual(directive.directive, true);
  assert.strictEqual(directive.end, '<@for row in rows.filter(r => r.score > 90)>'.length);

  const cssTag = opens('<@css card />')[0];
  assert.strictEqual(cssTag.selfClosing, true);
  assert.deepStrictEqual(cssTag.attrs.map((a) => a.name), ['card']);

  const multiline = opens('<div\n  class="a"\n  @click="n > 1"\n>x</div>')[0];
  assert.deepStrictEqual(multiline.attrs.map((a) => a.name), ['class', '@click']);

  assert.strictEqual(findTagEnd('<p title="a>b">', 0), 14);
  assert.strictEqual(findTagEnd('<p title="a>b', 0), -1);
  assert.strictEqual(findTagEnd('a < b', 2), -1);

  console.log('🧪 markupLexer: text, interpolations and comments');

  const lt = tokenizeMarkup('<p>{{ a <b }}</p>');
  assert.deepStrictEqual(
    lt.map((t) => t.type),
    ['open', 'interpolation', 'close'],
    'a < inside an interpolation is not a tag',
  );

  const commentInAttr = tokenizeMarkup('<div title="<!-- x -->">t</div>');
  assert.ok(!commentInAttr.some((t) => t.type === 'comment'), 'comment-like attribute text is not a comment');

  const comment = tokenizeMarkup('a<!-- c -->b');
  assert.deepStrictEqual(comment.map((t) => t.type), ['text', 'comment', 'text']);

  const openComment = tokenizeMarkup('a<!-- never');
  assert.strictEqual(openComment[1].unterminated, true);

  const openTag = tokenizeMarkup('<div>\n<p title="x>\n</div>');
  assert.ok(openTag.some((t) => t.type === 'open' && t.unterminated), 'an unterminated tag is reported');

  const prose = tokenizeMarkup('a < b and 3<4 and <!doctype html>');
  assert.ok(prose.every((t) => t.type === 'text'), 'a < that does not start a tag name is text');

  const strayBraces = tokenizeMarkup('{{ never closed <p>{{ x }}</p>');
  assert.ok(
    strayBraces.some((t) => t.type === 'open' && t.name === 'p'),
    'an unterminated interpolation does not swallow the tags after it',
  );

  const escapedMarkers = tokenizeMarkup('<li>{%% item %%}</li>');
  assert.deepStrictEqual(escapedMarkers.map((t) => t.type), ['open', 'interpolation', 'close']);

  const script = tokenizeMarkup('<script>if (a<b) {}</script>');
  assert.deepStrictEqual(script.map((t) => t.type), ['open', 'text', 'close'], 'script content is raw text');

  assert.strictEqual(interpolationEnd('{{ a }}', 0), 7);
  assert.strictEqual(interpolationEnd('{{{ a }}}', 0), 9);
  assert.strictEqual(interpolationEnd('{ a }', 0), -1);

  console.log('🧪 markupLexer: edits and quoting');

  assert.strictEqual(applyEdits('abcdef', [{ start: 4, end: 5, text: 'X' }, { start: 1, end: 2, text: '' }]), 'acdXf');
  assert.throws(() => applyEdits('abc', [{ start: 0, end: 2, text: '' }, { start: 1, end: 3, text: '' }]));
  assert.strictEqual(quoteAttributeValue('a'), '"a"');
  assert.strictEqual(quoteAttributeValue('a["b"]'), `'a["b"]'`);
  assert.strictEqual(quoteAttributeValue(`a["b"] + 'c'`), null);

  console.log('🧪 markupLexer: tokens tile any input');

  const alphabet = ['<', '>', '/', '"', "'", '=', ' ', '\n', '{', '}', '%', '@', '!', '-', 'a', 'b', 'div', 'p', '\\', '(', ')'];
  let seed = 0x5eed;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let run = 0; run < 3000; run++) {
    let source = '';
    const length = Math.floor(random() * 40);
    for (let k = 0; k < length; k++) {
      source += alphabet[Math.floor(random() * alphabet.length)];
    }
    assertTiles(source);
  }
  for (const fixed of ['', '<', '</', '<!--', '{{', '<a', '<a b="', "<a b='", '<@if (', '<@for x in y', '<div>{{ a }}</div>']) {
    assertTiles(fixed);
  }

  console.log('  ✅ markupLexer tests passed!');
} catch (error) {
  console.error('❌ markupLexer tests failed:', error);
  process.exit(1);
}
