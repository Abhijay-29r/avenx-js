/**
 * @file reactivityDependencyTracking.test.js
 * @description Dependency bookkeeping is O(1) per read, and the causation trace
 * is built only when something reads it.
 *
 * `addDep` scanned every dependency the watcher already had, on every tracked
 * read: quadratic in the number of reads, on the hot path of every render
 * effect. `trigger` built a property-path string for *every* write to feed a
 * causation trace that is only consulted when a cycle is reported.
 *
 * Neither change alters what wakes: the tests below also pin that a nested
 * mutation still wakes a watcher that depends on the parent, which is Avenx's
 * documented deep-reactivity semantic.
 */
import assert from 'node:assert';
import { StateFactory } from '../../lib/core/reactive/createState.js';
import { AvenxWatcher, getActiveCausationTrace, clearCausationTrace } from '../../lib/core/reactive/watcher.js';

const factory = new StateFactory();

try {
  console.log('🧪 A watcher keeps one dependency per source, whatever the read order');

  const state = factory.create({ a: 1, b: 2, c: 3 });
  let runs = 0;
  const watcher = new AvenxWatcher(() => {
    runs += 1;
    // Reading the same keys repeatedly must not accumulate duplicates.
    return state.a + state.a + state.b + state.b + state.c;
  });

  assert.strictEqual(runs, 1);
  assert.strictEqual(watcher.deps.size, 3, 'one dependency per distinct source');

  state.a = 10;
  assert.strictEqual(runs, 2, 'a tracked write still wakes the watcher');

  // Dropping a branch releases the dependency it no longer reads.
  let readB = true;
  const conditional = new AvenxWatcher(() => (readB ? state.a + state.b : state.a));
  assert.strictEqual(conditional.deps.size, 2);
  readB = false;
  conditional.get();
  assert.strictEqual(conditional.deps.size, 1, 'an unread source is released');

  let wokeAfterRelease = 0;
  const released = new AvenxWatcher(() => (readB ? state.b : state.a), () => { wokeAfterRelease += 1; });
  state.b = 99;
  assert.strictEqual(wokeAfterRelease, 0, 'a released dependency no longer wakes the watcher');

  watcher.teardown();
  conditional.teardown();
  released.teardown();

  console.log('🧪 Teardown detaches every dependency');
  const detached = factory.create({ value: 1 });
  let detachedRuns = 0;
  const temp = new AvenxWatcher(() => detached.value, () => { detachedRuns += 1; });
  temp.teardown();
  assert.strictEqual(temp.deps.size, 0);
  detached.value = 2;
  assert.strictEqual(detachedRuns, 0, 'a torn-down watcher never runs again');

  console.log('🧪 The causation trace still reports paths when something reads it');
  clearCausationTrace();
  const traced = factory.create({ nested: { leaf: 0 } });
  let seen = [];
  const observer = new AvenxWatcher(
    () => traced.nested.leaf,
    () => {
      seen = getActiveCausationTrace();
    },
  );
  traced.nested.leaf = 5;
  assert.ok(seen.length > 0, 'the trace is populated while a cascade runs');
  assert.ok(
    seen.some((entry) => typeof entry === 'string' && entry.includes('leaf')),
    `the path is still resolved: ${JSON.stringify(seen)}`,
  );
  observer.teardown();

  console.log('🧪 A nested mutation still wakes a watcher depending on the parent');
  // Documented Avenx semantic, relied on by deep reactivity and Map/Set
  // iteration watchers. Kept deliberately; see ADR 0009.
  const parent = factory.create({ group: { child: { n: 1 } } });
  let parentWakes = 0;
  const parentWatcher = new AvenxWatcher(() => parent.group, () => { parentWakes += 1; });
  parent.group.child.n = 2;
  assert.strictEqual(parentWakes, 1, 'the parent watcher woke on a nested write');
  parentWatcher.teardown();

  console.log('  ✅ Reactivity dependency-tracking tests passed!');
} catch (error) {
  console.error('❌ Reactivity dependency-tracking tests failed:', error);
  process.exitCode = 1;
}
