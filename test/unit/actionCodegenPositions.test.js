/**
 * @file actionCodegenPositions.test.js
 * @description Free identifiers in an action body are rewritten according to
 * where they stand.
 *
 * The action compiler replaces each free name with a call. Replacing the name's
 * text alone produced three silent miscompiles:
 *
 * - `new Date(0)` became `new axGet($s, "Date")(0)`, which constructs the lookup
 *   helper and then calls its result: `d.getTime is not a function`.
 * - `tag\`x\`` had the same precedence problem.
 * - `{ count }` became `{ axGet($s, "count") }`, which does not parse, and a
 *   destructuring assignment `({ a } = value)` read its target instead of
 *   writing it.
 */
import assert from 'node:assert';
import { compileActionToSource } from '../../lib/compiler/codegen/actions.js';
import { EXPRESSION_OPS } from '../../lib/core/expression/ops.js';

/**
 * Compiles and runs an action body.
 * @param {string} body - The body.
 * @param {object} scope - The scope to run it against.
 * @param {object} [options] - Compiler options.
 * @returns {any} What the body returned.
 */
function run(body, scope, options = {}) {
  const generated = compileActionToSource(body, options);
  const names = Object.keys(EXPRESSION_OPS);
  return new Function(...names, `return (${generated});`)(...Object.values(EXPRESSION_OPS))(scope);
}

try {
  console.log('🧪 Action codegen: identifier positions');

  for (const options of [{}, { ambient: true }]) {
    assert.strictEqual(run('const d = new Date(0); return d.getTime();', {}, options), 0);
    assert.strictEqual(run('return new Map([[1, 2]]).size;', {}, options), 1);
    assert.strictEqual(run('return new Widget(2).size;', { Widget: class { constructor(n) { this.size = n; } } }, options), 2);
    assert.throws(() => run('if (!ok) { throw new Error("boom"); }', { ok: false }, options), (e) => e instanceof Error && e.message === 'boom');

    assert.strictEqual(run('return tag`x${count}`;', { count: 3, tag: (strings, value) => strings[0] + value }, options), 'x3');

    assert.deepStrictEqual(run('return { count, label: "n" };', { count: 5 }, options), { count: 5, label: 'n' });

    const swapped = { a: 1, b: 2 };
    run('[a, b] = [b, a];', swapped, options);
    assert.deepStrictEqual(swapped, { a: 2, b: 1 });

    const assigned = { a: 0, total: 0 };
    run('({ a, b: total = 7 } = { a: 4 });', assigned, options);
    assert.deepStrictEqual(assigned, { a: 4, total: 7 });

    assert.strictEqual(run('const { q = count } = {}; return q;', { count: 9 }, options), 9);
  }

  console.log('  ✅ Action codegen position tests passed!');
} catch (error) {
  console.error('❌ Action codegen position tests failed:', error);
  process.exit(1);
}
