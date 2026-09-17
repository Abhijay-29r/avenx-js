/**
 * @file irDocumentedConstructs.test.js
 * @description Documented constructs the IR refused, forcing a fallback.
 *
 * Two forms appear in the documentation but were not modelled by the IR, so
 * every component using one compiled to the string renderer instead of a render
 * program — correct output, but the slow path, and `AVX_W47` on every build:
 *
 * - `<@for item="user" in="users">`, the attribute spelling of a loop header,
 *   used in api-reference/component.md and troubleshooting/errors.md;
 * - `<@loading>` inside `<@defer>`, documented in core-concepts/defer.md.
 *
 * Both now lower to a program. The header spelling and the `<@placeholder>`
 * spelling keep working exactly as before.
 */
import assert from 'node:assert';
import { buildTemplateIR } from '../../lib/compiler/ir/build.js';
import { lowerToProgram } from '../../lib/compiler/ir/lower.js';
import { parseForHeader } from '../../lib/compiler/ir/build.js';
import { OpKind } from '../../lib/compiler/render/program.js';

/**
 * Compiles a template to a render program.
 * @param {string} template - The template source.
 * @returns {{program: object|null, refusal: object|null}} The result.
 */
function compile(template) {
  const built = buildTemplateIR(template, {});
  if (built.refusal) return { program: null, refusal: built.refusal };
  const lowered = lowerToProgram(built.ir, {});
  if (lowered.refusal) return { program: null, refusal: lowered.refusal };
  return { program: lowered.program, refusal: null };
}

try {
  console.log('🧪 The attribute spelling of a loop header is a loop');

  for (const header of ['item="user" in="users"', "item='user' in='users'", 'item="user"  in="users"']) {
    const parts = parseForHeader(header);
    assert.strictEqual(parts.item, 'user', `${header}: binds the item`);
    assert.strictEqual(parts.list, 'users', `${header}: iterates the list`);
    assert.strictEqual(parts.key, null);
  }

  // With a key, as the documentation writes it.
  const keyed = parseForHeader('item="row" in="rows" key="row.id"');
  assert.strictEqual(keyed.item, 'row');
  assert.strictEqual(keyed.list, 'rows');
  assert.strictEqual(keyed.key, 'row.id');

  const attributeForm = compile('<ul><@for item="user" in="users"><li>{{ user }}</li></@for></ul>');
  assert.strictEqual(attributeForm.refusal, null, `must compile: ${JSON.stringify(attributeForm.refusal)}`);
  const forOp = attributeForm.program.ops.find((op) => op.k === OpKind.FOR);
  assert.ok(forOp, 'it lowers to a for op');
  assert.strictEqual(forOp.as, 'user');

  console.log('🧪 The header spelling is unchanged');
  const headerForm = compile('<ul><@for user in users><li>{{ user }}</li></@for></ul>');
  assert.strictEqual(headerForm.refusal, null);
  assert.deepStrictEqual(
    headerForm.program.ops.find((op) => op.k === OpKind.FOR).as,
    'user',
  );
  // Both spellings describe the same loop.
  assert.deepStrictEqual(attributeForm.program, headerForm.program, 'both spellings compile identically');

  // A genuinely malformed header is still refused.
  assert.throws(() => parseForHeader('item="user"'), /has no "in" clause/);
  // Missing the item binding is still refused; the exact wording comes from
  // whichever reader rejects it first.
  assert.throws(() => parseForHeader('in="users"'), /<@for/);

  console.log('🧪 <@loading> inside <@defer> compiles');
  const loading = compile('<div><@defer when="visible"><@loading>loading…</@loading><p>content</p></@defer></div>');
  assert.strictEqual(loading.refusal, null, `must compile: ${JSON.stringify(loading.refusal)}`);
  const deferOp = loading.program.ops.find((op) => op.k === OpKind.DEFER);
  assert.ok(deferOp, 'it lowers to a defer op');
  assert.strictEqual(deferOp.when, 'visible');
  assert.ok(deferOp.ph !== undefined && deferOp.ph !== null, 'the loading block becomes the placeholder');

  console.log('🧪 <@placeholder> keeps working and still wins when both are present');
  const placeholder = compile('<div><@defer when="idle"><@placeholder>ph</@placeholder><p>c</p></@defer></div>');
  assert.strictEqual(placeholder.refusal, null);
  assert.ok(placeholder.program.ops.find((op) => op.k === OpKind.DEFER).ph !== undefined);

  const both = compile(
    '<div><@defer when="idle"><@placeholder>ph</@placeholder><@loading>ld</@loading><p>c</p></@defer></div>',
  );
  assert.strictEqual(both.refusal, null, 'both spellings together still compile');

  console.log('  ✅ IR documented-construct tests passed!');
} catch (error) {
  console.error('❌ IR documented-construct tests failed:', error);
  process.exitCode = 1;
}
