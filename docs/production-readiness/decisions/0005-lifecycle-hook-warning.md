# ADR 0005 — AVX_W26 no longer warns on lifecycle hooks

- Status: accepted
- Branch: `fix/lifecycle-hook-warning`

## Context

`AVX_W26` (`COMPONENT_METHOD_RESERVED_KEY_COLLISION`) fired whenever a component
declared an action whose name was in `RESERVED_INSTANCE_KEYS`, a list that mixed
two unrelated groups:

- **Instance methods** — `mount`, `unmount`, `update`, `destroy`,
  `scheduleUpdate` — real `AvenxComponent` methods. An action of the same name
  shadows framework machinery: a genuine mistake.
- **Lifecycle hooks** — `onBeforeMount`, `onMount`, `onBeforeUpdate`,
  `onUpdate`, `onUnmount`, `onActivate`, `onDeactivate`, `onErrorCaptured`.
  `lifecycle-hooks.md` documents `<action name="onMount">` as *the* way to define
  a hook, and `#triggerLifecycle` invokes exactly `this.#methods[hookName]`.

So the framework required declaring these names and then warned that declaring
them "collides with a reserved lifecycle hook". Every documented lifecycle
example, and the E2E security fixture's `onMount`, produced the warning.

## Decision

Split the list:

- `RESERVED_INSTANCE_METHOD_KEYS` = `mount`, `unmount`, `update`, `destroy`,
  `scheduleUpdate`. The `AVX_W26` collision check (compile-time in
  `ComponentParser`, runtime in `AvenxComponent`) uses **only** this set.
- `LIFECYCLE_HOOK_KEYS` = the eight hook names. Declaring one is expected and
  does not warn.
- `RESERVED_INSTANCE_KEYS` stays exported as the union, for callers that need the
  full set (e.g. the mixin-merge key filter), so nothing else changes.

The `AVX_W26` message and its error-reference entry are rewritten to describe an
instance-method collision and to state that lifecycle hooks are not reserved.

## Compatibility

- No feature changes. A genuine collision (`update`, `destroy`, …) still warns.
- Behaviour change: declaring a lifecycle hook as an action no longer warns —
  which is what the documentation always described.

## Evidence

- `test/unit/reservedMethodWarning.test.js` — the two split lists; `update`
  warns and `onMount` does not, at runtime and through the compiler; a component
  defining all eight hooks warns for none. Fails before the split.
- Full Node suite green.
