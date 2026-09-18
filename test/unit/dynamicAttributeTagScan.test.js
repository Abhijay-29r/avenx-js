/**
 * @file dynamicAttributeTagScan.test.js
 * @description Dynamic attribute names resolve regardless of ">" elsewhere in the tag.
 *
 * `resolveDynamicAttributes` located tags with `/<([a-zA-Z0-9@/!-][^>]*?)>/g`,
 * which ends a tag at the first `>` wherever it appears -- the pattern
 * lib/core/utils/markupLexer.js exists to replace. On
 * `<div title="a > b" :[name]="val">` it matched only `<div title="a >`, so the
 * dynamic attribute fell outside the tag and was never resolved. The failure was
 * silent and doubly wrong: the intended attribute was absent, and the literal
 * text `:[name]="val"` stayed on the element.
 *
 * This runs after interpolation, so the `>` need not be in the template at all.
 * Any rendered value containing one, in any attribute before the dynamic one,
 * was enough -- which makes it data-dependent and invisible until real content
 * arrives.
 */

import assert from 'assert';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';

console.log('Testing dynamic attribute tag scanning...');

const renderer = new TemplateRenderer();

/**
 * Resolves the fixture's two expressions.
 * @param {string} expression - The expression source.
 * @returns {any} The resolved value.
 */
function resolve(expression) {
  return { name: 'data-x', val: 'yes', flag: true, missing: null }[expression.trim()];
}

/**
 * Resolves dynamic attributes in a fragment.
 * @param {string} html - The rendered markup.
 * @returns {string} The rewritten markup.
 */
function run(html) {
  return renderer.resolveDynamicAttributes(html, resolve);
}

// --- the defect ----------------------------------------------------------
{
  const out = run('<div title="a > b" :[name]="val">hi</div>');
  assert.ok(out.includes('data-x="yes"'), `the dynamic attribute must resolve. Got: ${out}`);
  assert.ok(!out.includes(':[name]'), `the directive must not survive into the DOM. Got: ${out}`);
  assert.ok(out.includes('title="a > b"'), 'the attribute containing ">" is left alone');
  console.log('  ✅ resolves past a ">" in an earlier attribute');
}

// --- the same, from rendered data rather than the template ---------------
{
  const out = run('<div title="5 > 3" data-note="x>y" :[name]="val">hi</div>');
  assert.ok(out.includes('data-x="yes"'), `two ">" values must not stop it. Got: ${out}`);
  console.log('  ✅ resolves past several ">" values');
}

// --- ordinary cases still work -------------------------------------------
{
  const out = run('<div :[name]="val">hi</div>');
  assert.ok(out.includes('data-x="yes"'));
  assert.ok(out.includes('data-ax-dyn-attrs="data-x"'), 'the bookkeeping attribute is still added');
  console.log('  ✅ a plain dynamic attribute still resolves');
}

// --- a ">" in text before the tag ----------------------------------------
{
  const out = run('<p>a > b</p><div :[name]="val">hi</div>');
  assert.ok(out.includes('data-x="yes"'), 'text content must not shift the scan');
  assert.ok(out.includes('<p>a > b</p>'), 'the text is untouched');
  console.log('  ✅ a ">" in text content does not shift the scan');
}

// --- only the tags that need rewriting are touched -----------------------
{
  const input = '<span title="x > y">s</span><div :[name]="val">hi</div>';
  const out = run(input);
  assert.ok(out.startsWith('<span title="x > y">s</span>'), 'an untouched tag is byte-identical');
  assert.ok(out.includes('data-x="yes"'));
  console.log('  ✅ tags without dynamic attributes are left byte-identical');
}

// --- no dynamic attributes means no rewriting ----------------------------
{
  for (const input of [
    '<div title="a > b">hi</div>',
    '<p>plain</p>',
    '',
    '<div class="x"><span>y</span></div>',
  ]) {
    assert.strictEqual(run(input), input, `markup with no ":[" must pass through unchanged: ${input}`);
  }
  console.log('  ✅ markup with no dynamic attributes passes through unchanged');
}

// --- an unterminated tag does not lose the rest of the document ----------
{
  const out = run('<div :[name]="val">ok</div><span title="unclosed');
  assert.ok(out.includes('data-x="yes"'), 'the well-formed tag still resolves');
  assert.ok(out.endsWith('<span title="unclosed'), 'the trailing fragment survives');
  console.log('  ✅ an unterminated trailing tag does not truncate the output');
}

console.log('✅ Dynamic attribute tag scanning tests passed!');
