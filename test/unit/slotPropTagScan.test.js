/**
 * @file slotPropTagScan.test.js
 * @description Slot props are rewritten regardless of ">" inside the tag.
 *
 * `processSlotProps` bounded the tag with `/<slot\b([^>]*?)>/gi`, which ends a
 * tag at the first `>` wherever it appears. Two shapes failed silently:
 *
 *   <slot name="a > b" :item="row">          -- a ">" in an earlier attribute
 *   <slot :label="a > b ? x : y">            -- a conditional passed to a slot
 *
 * In both the `:prop` was never rewritten to `data-props-*`, so the slot
 * received nothing and the raw `:label="..."` was left in the markup. The
 * second is the same shape as the `@click="count > 3 ? a() : b()"` defect the
 * changelog records as fixed -- the fix reached the handler path and not this
 * one.
 */

import assert from 'assert';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';

console.log('Testing slot prop tag scanning...');

const parser = new ComponentParser(new StyleProcessor());

/**
 * Rewrites slot props in a fragment.
 * @param {string} template - The template markup.
 * @returns {string} The rewritten markup.
 */
function run(template) {
  return parser.processSlotProps(template);
}

// --- the ordinary case still works ---------------------------------------
{
  assert.strictEqual(run('<slot :item="row">x</slot>'), '<slot data-props-item="row">x</slot>');
  console.log('  ✅ a plain slot prop is still rewritten');
}

// --- a ">" in an earlier attribute ---------------------------------------
{
  const out = run('<slot name="a > b" :item="row">x</slot>');
  assert.ok(out.includes('data-props-item="row"'), `the prop must be rewritten. Got: ${out}`);
  assert.ok(!out.includes(':item='), 'the raw directive must not survive');
  assert.ok(out.includes('name="a > b"'), 'the attribute containing ">" is preserved');
  console.log('  ✅ rewrites past a ">" in an earlier attribute');
}

// --- a conditional expression in the prop itself -------------------------
{
  const out = run('<slot :label="a > b ? x : y">x</slot>');
  assert.ok(
    out.includes('data-props-label="a > b ? x : y"'),
    `a conditional passed to a slot must survive intact. Got: ${out}`,
  );
  console.log('  ✅ a conditional expression in the prop survives intact');
}

// --- several props on one slot -------------------------------------------
{
  const out = run('<slot :item="row" :index="i > 0 ? i : 0">x</slot>');
  assert.ok(out.includes('data-props-item="row"'), 'the first prop is rewritten');
  assert.ok(out.includes('data-props-index="i > 0 ? i : 0"'), 'and so is the second');
  console.log('  ✅ several props on one slot are all rewritten');
}

// --- markup without slot props is untouched ------------------------------
{
  for (const input of [
    '<slot>x</slot>',
    '<slot name="header">x</slot>',
    '<div title="a > b">x</div>',
    '<p>plain</p>',
    '',
  ]) {
    assert.strictEqual(run(input), input, `must pass through unchanged: ${input}`);
  }
  console.log('  ✅ markup with no slot props passes through unchanged');
}

// --- several slots, only the relevant ones rewritten ---------------------
{
  const out = run('<slot name="a">1</slot><slot :item="row">2</slot>');
  assert.ok(out.startsWith('<slot name="a">1</slot>'), 'the untouched slot is byte-identical');
  assert.ok(out.includes('data-props-item="row"'), 'the other is rewritten');
  console.log('  ✅ only slots with props are rewritten');
}

// --- an unterminated slot tag does not truncate the output ---------------
{
  const out = run('<slot :item="row">ok</slot><slot name="unclosed');
  assert.ok(out.includes('data-props-item="row"'), 'the well-formed slot is still rewritten');
  assert.ok(out.endsWith('<slot name="unclosed'), 'the trailing fragment survives');
  console.log('  ✅ an unterminated trailing slot does not truncate the output');
}

// --- scoped slots are recognised past a ">" in an earlier attribute ------
{
  // `escapeScopedSlots` matched the whole opening tag with `[^>]*` before
  // `data-slot-props`, so an earlier attribute containing ">" ended the match
  // and the tag was not recognised as a scoped slot at all. Its interpolations
  // were then left for the parent to evaluate -- the exact premature evaluation
  // this pass exists to prevent.
  const escaped = parser.escapeScopedSlots('<template title="a > b" data-slot-props="row">{{ row.n }}</template>');
  assert.ok(
    escaped.includes('_AX_LBRACE_row.n_AX_RBRACE_'),
    `the scoped slot's interpolation must be escaped. Got: ${escaped}`,
  );
  assert.ok(escaped.includes('title="a > b"'), 'the attribute containing ">" is preserved');

  const plain = parser.escapeScopedSlots('<template data-slot-props="row">{{ row.n }}</template>');
  assert.ok(plain.includes('_AX_LBRACE_row.n_AX_RBRACE_'), 'the ordinary case still works');

  const untouched = '<template><p>{{ x }}</p></template>';
  assert.strictEqual(
    parser.escapeScopedSlots(untouched),
    untouched,
    'a template that is not a scoped slot is left alone',
  );

  const two = parser.escapeScopedSlots(
    '<template data-slot-props="a">{{ a.x }}</template><template data-slot-props="b">{{ b.y }}</template>',
  );
  assert.ok(two.includes('_AX_LBRACE_a.x_AX_RBRACE_') && two.includes('_AX_LBRACE_b.y_AX_RBRACE_'),
    'both scoped slots are escaped');
  console.log('  ✅ a scoped slot is recognised past a ">" in an earlier attribute');
}

console.log('✅ Slot prop tag scanning tests passed!');
