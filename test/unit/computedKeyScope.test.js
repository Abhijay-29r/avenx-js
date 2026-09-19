/**
 * @file computedKeyScope.test.js
 * @description Computed properties belong to the state object, not to every object inside it.
 *
 * One ProxyHandlerFactory serves a component's root state object and every
 * nested object reached through it, because nested values are wrapped by the
 * same shared handler. The `get`, `ownKeys` and `getOwnPropertyDescriptor`
 * traps consulted `computedKeys` without asking which object they were
 * answering for, so every nested object claimed all of the component's
 * computed properties as its own.
 *
 * The consequences are silent and corrupting rather than loud:
 *
 *   Object.keys(state.query)      -> ['tab', 'total', 'isEmpty', ...]
 *   JSON.stringify(state.form)    -> computed values posted to an API
 *   { ...state.filters }          -> a copy carrying properties it never had
 *   state.query.total             -> the component's `total`, unrelated to the
 *                                    query string it was read from
 *
 * Nothing in a template surfaces this, because a template reads computeds off
 * the root, where they belong. It appears the moment application code iterates,
 * spreads or serialises a nested state object -- which is what building a query
 * string or a request body looks like.
 */

import assert from 'assert';
import { StateFactory } from '../../lib/core/reactive/createState.js';
import { ProxyHandlerFactory } from '../../lib/core/reactive/proxyHandler.js';

console.log('Testing computed key scoping...');

/**
 * Builds reactive state with computed properties, as a component does.
 * @param {object} initial - The raw state.
 * @param {Record<string, Function>} computed - Computed evaluators by name.
 * @returns {object} The reactive state proxy.
 */
function stateWithComputed(initial, computed) {
  const names = Object.keys(computed);
  return new StateFactory(
    class extends ProxyHandlerFactory {
      constructor(options = {}) {
        super({ ...options, computedKeys: names, getComputedValue: (key) => computed[key]() });
      }
    },
  ).create(initial);
}

const state = stateWithComputed(
  { count: 2, query: { tab: 'activity' }, form: { name: 'Ada' }, rows: [{ id: 1 }] },
  { total: () => 99, label: () => 'computed-label' },
);

// --- the root still owns its computed properties -------------------------
{
  assert.strictEqual(state.total, 99, 'a computed still resolves on the state object');
  assert.strictEqual(state.label, 'computed-label', 'and so does the second');
  const keys = Object.keys(state);
  for (const name of ['count', 'query', 'form', 'rows', 'total', 'label']) {
    assert.ok(keys.includes(name), `Object.keys(state) must still include "${name}", got ${keys}`);
  }
  console.log('  ✅ the root state object still exposes its computed properties');
}

// --- a nested object does not ---------------------------------------------
{
  assert.deepStrictEqual(
    Object.keys(state.query),
    ['tab'],
    'a nested object must list only its own keys',
  );
  assert.deepStrictEqual(Object.keys(state.form), ['name'], 'and so must another');
  assert.strictEqual(state.query.total, undefined, 'a nested object must not resolve a computed');
  assert.strictEqual(state.form.label, undefined, 'under any name');
  console.log('  ✅ a nested object lists and resolves only its own keys');
}

// --- serialising a nested object is clean ---------------------------------
{
  assert.strictEqual(
    JSON.stringify(state.query),
    '{"tab":"activity"}',
    'serialising a nested object must not smuggle computed values into a request',
  );
  assert.deepStrictEqual(
    { ...state.form },
    { name: 'Ada' },
    'spreading a nested object must copy only what it has',
  );
  console.log('  ✅ serialising and spreading a nested object is clean');
}

// --- arrays and array elements --------------------------------------------
{
  assert.deepStrictEqual(Object.keys(state.rows[0]), ['id'], 'an array element is a nested object too');
  assert.strictEqual(state.rows[0].total, undefined, 'and resolves no computed');
  assert.strictEqual(state.rows.length, 1, 'the array itself is unaffected');
  assert.strictEqual(
    JSON.stringify(state.rows),
    '[{"id":1}]',
    'a list of rows serialises to exactly the rows',
  );
  console.log('  ✅ arrays and their elements are unaffected');
}

// --- for...in over a nested object ----------------------------------------
{
  const seen = [];
  for (const key in state.query) seen.push(key);
  assert.deepStrictEqual(seen, ['tab'], 'for...in over a nested object yields only its keys');
  console.log('  ✅ for...in over a nested object yields only its own keys');
}

// --- a state object with no computed properties ---------------------------
{
  const plain = new StateFactory().create({ a: 1, nested: { b: 2 } });
  assert.deepStrictEqual(Object.keys(plain), ['a', 'nested'], 'unchanged without computeds');
  assert.deepStrictEqual(Object.keys(plain.nested), ['b'], 'and nested is unchanged too');
  console.log('  ✅ state without computed properties is unchanged');
}

console.log('✅ Computed key scoping tests passed!');
