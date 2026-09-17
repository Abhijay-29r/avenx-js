# ADR 0004 — Inline `on*` handler attributes

- Status: accepted
- Branch: `fix/event-handler-attributes`
- Evidence: `../security-inventory.md` categories B and C

## Context

An `on*` attribute on an HTML element runs its value as JavaScript. Nothing
guarded them:

- `onclick="{{ handler }}"` compiled to an `attr` op; `applyAttribute` set the
  value verbatim (`onclick` is not a URL attribute), so a reactive state value
  became an executed inline handler.
- `onclick="alert(1)"` sat in the skeleton and executed when the skeleton was
  instantiated.
- `:[name]="value"` (string-renderer path) resolved the name at run time; a name
  of `onclick` installed a handler from state.

Runtime evidence (happy-dom): `applyAttribute(el, 'onclick', 'globalThis.__pwn = 1')`
set the attribute verbatim.

Bound `on*` is not documented and appears in no fixture, example (except an
"Incorrect" one) or test. `@click` is the documented event system.

## Decision

Preserve the event system and the legitimate static case; close the injection.

| Pattern | Outcome | Code |
|---|---|---|
| `@click`, modifiers | unchanged, documented | — |
| Bound `on*` on an element (`onclick="{{ x }}"`) | **build error**, with the `@event` rewrite | `AVX_C28` |
| Static `on*` on an element (`onclick="f()"`) | **build warning**, kept | `AVX_W52` |
| `on*` on a component (PascalCase tag) | unchanged — it is a prop | — |
| Any `on*` reaching the runtime (dynamic name, fallback) | **refused at run time** | `AVX_R35` |

Recognition uses the real set of HTML event-handler content attributes
(`lib/core/security/eventAttributes.js`), shared by the compiler and the
runtime, so `once`, `online` and `ontology` are never flagged and a made-up
`onfoo` (which no browser executes) is not either.

The build check runs on the semantic template, where component tags are still
PascalCase, so element handlers and component props are distinguished.

## Compatibility and migration

- No documented feature is removed. `@click` is unchanged; a static inline
  handler still works (with a warning); component `on*` props are untouched.
- Behaviour change: a **bound** `on*` on an element now fails the build.
  Migration is mechanical and in the message: `onclick="{{ h }}"` →
  `@click="h"`. Documented in `core-concepts/events.md`.
- `AVX_W52` is silenceable (`"warnings": { "AVX_W52": "off" }`).

## Evidence

- `test/unit/eventHandlerAttributes.test.js` — bound `on*` → `AVX_C28`
  (including uppercase and parts); static `on*` → one `AVX_W52`; `@click` and
  modifiers never flagged; component `on*` and `once`/`data-online` never flagged.
- `test/unit/eventAttributeRuntimeGuard.test.js` — the handler set; `applyAttribute`
  refuses `on*`; non-handlers unaffected.
- `test/unit/dynamicAttributeGuard.test.js` — `DomPatcher` refuses a dynamic
  name resolving to `onclick` and nothing executes; fails on the base runtime.
- `test/e2e/specs/security/srcdoc.spec.js` remains the real-browser gate for the
  companion `srcdoc` change (ADR 0003).
