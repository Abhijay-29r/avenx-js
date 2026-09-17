# ADR 0009 — Reactivity hot path, and why ancestor propagation stays

- Status: accepted
- Branch: `fix/reactivity-granularity`
- Addresses: "Hot-path cost" and "Broad invalidation" in `../initial-assessment.md` §5

## What was measured

Node, same machine, before any change:

| Benchmark | Before | After | Change |
|---|---:|---:|---|
| Watcher with 400 tracked reads, 200 re-evaluations | 54.6 ms | 25.1 ms | **2.2× faster** |
| 100,000 untracked nested writes | 73.2 ms | 38.0 ms | **1.9× faster** |
| 1,000 nested writes with 200 sibling watchers | 136.5 ms | 126 ms | 1.08× |

## Fixed

### 1. `addDep` was quadratic in the number of reads

`this.deps` was a `Set` of `{target, key, watchersSet}` records, and `addDep`
scanned it linearly on **every tracked read** to test whether the source was
already known. A render effect reads every value it displays, so a component
with a few hundred bindings paid a few hundred comparisons per read.

`deps` is now a `Map` keyed by the watcher set: one lookup per read.
`cleanupDeps` and `teardown` iterate it directly. Nothing about which
dependencies are kept or released changed — pinned by
`reactivityDependencyTracking.test.js`, including that a branch no longer read
is released and stops waking the watcher.

### 2. The causation path was built on every write

`trigger` called `getPropertyPath(target, key)` — which walks the parent chain
and joins strings — for every write, to append to `causationTrace`. That trace
is only read when a cycle is reported (`AVX_R18`) or by
`getActiveCausationTrace()`.

Entries are now recorded as `{target, key}` and formatted only when read. The
public `getActiveCausationTrace()` still returns the same strings, and the cycle
diagnostics still print the same paths.

## Deliberately not changed: ancestor propagation

A write to `state.rows[3].qty` also triggers the parent key `rows`, so a watcher
that read only `state.rows` re-runs. In the sibling benchmark that is 1,999
wake-ups for 1,000 writes, and it is the largest remaining source of
unnecessary invalidation.

It was removed experimentally and the suite was run: `test/unit/reactivity.test.js`
fails, on an assertion whose own comment states the intent:

```js
// In Avenx, nested mutations propagate up to parent properties,
// triggering watchers depending on the parent
proxiedObj.y = 30;
assert.strictEqual(iterateCount, 2);
```

This is a deliberate, documented framework semantic — a Map/Set iteration
watcher, and deep reactivity generally, depend on it. Removing it would be a
capability reduction, not an optimisation, so **it stays**, and a test now pins
it explicitly so it cannot be dropped by accident.

### Recommended for a future major version

Adopt the model Vue 3 uses, where a nested write wakes only watchers that
actually read the nested key, and a watcher that wants the container's whole
subtree opts in with `deep: true` (Avenx's `deep` option already traverses, so
it would keep working unchanged). That is a breaking change to reactivity
semantics and belongs in a major release with a migration note — not here.

## Evidence

- `test/unit/reactivityDependencyTracking.test.js` — one dependency per source
  whatever the read order, release of unread branches, teardown, the causation
  trace still resolving paths, and the ancestor-propagation semantic.
- Full Node suite 236/236 and E2E 152/152 after the change.
