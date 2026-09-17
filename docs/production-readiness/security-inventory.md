# Security Inventory — Event Handler Attributes and `srcdoc`

Internal engineering document. Written before `fix/*` changed any behaviour, to
separate what must change from what must be preserved.

Rule applied throughout: legitimate, documented event-binding capabilities are
kept. Only the exact unsafe patterns change, each with a safe alternative, a
migration and tests.

## Method

Every way an `on*` attribute or `srcdoc` can reach the DOM was traced through
the compiler and the runtime:

1. compiled every shape through `ComponentParser` in production mode
   (`scratchpad/secprobe.mjs`);
2. drove the runtime attribute path under happy-dom (`scratchpad/secruntime.mjs`);
3. read the URL policy, both renderers' attribute application, and the sanitizer;
4. grepped the docs, fixtures, tests and plugins for real usage.

## The paths an attribute can take

| Template form | Compiler output | Runtime |
|---|---|---|
| `@click="expr"` | `event` op | `EventExecutor`, compiled handler |
| `attr="{{ expr }}"` (whole value) | `attr` op | `applyAttribute` → `sanitizeUrlAttribute` for URL attrs only, else raw `setAttribute` |
| `attr="a {{ b }}"` (parts) | `attrp` op | `applyAttributeParts`, same rule |
| `attr="literal"` (no interpolation) | verbatim in `program.html` skeleton | set via `innerHTML` when the skeleton is cloned |
| `data-ax-html="{{ expr }}"` | `html` op | `applyHtml` → escapes non-`SafeHtml` |
| `:[nameExpr]="valExpr"` | IR refuses (`a dynamic attribute name`) → string renderer | `domPatch` resolves the name at run time; value through `sanitizeUrlAttribute` (URL attrs only); **name is not checked** |

`sanitizeUrlAttribute` (`lib/core/security/urlPolicy.js`) only inspects the six
URL attributes plus `srcdoc`, and only checks the URL *scheme*.

## Evidence

Runtime, current tree (`scratchpad/secruntime.mjs`):

```
onclick set to: "globalThis.__pwn = 1"           ← executable, from a state value
srcdoc set to:  "<img src=x onerror=\"parent.__pwn=1\">"  ← same-origin script
href set to:    "about:blank"                    ← javascript: scheme blocked (control)
```

## Categories

### A. Legitimate, documented — keep unchanged

| Capability | Why it is safe | Evidence |
|---|---|---|
| `@click`, `@input`, `@change`, `@keydown`, key/`.prevent`/`.stop`/`.self`/`.once` modifiers | The documented event system (`core-concepts/events.md`). Compiles to `event` ops and a compiled handler; no string is ever set as an inline handler; runs under a strict CSP. | `secprobe` `click-directive` → `event` op; E2E `events/*` |
| `href`, `src`, `xlink:href`, `action`, `formaction`, `ping`, `data`, `poster`, `background` bound to `{{ }}` | `applyAttribute` runs `sanitizeUrlAttribute`; a `javascript:`/`vbscript:`/active-`data:` scheme becomes `about:blank` (`AVX_W45`). | `secruntime` `href` → `about:blank` |
| `data-ax-html="{{ expr }}"` | `applyHtml` escapes a plain value; only a `SafeHtml`/`Sanitizer` value introduces markup, and the `Sanitizer` strips `on*` and dangerous tags (`AVX_W16`/`AVX_W17`). | `templates.md`; `sanitize.test.js` |

**None of these changes.**

### B. Currently supported but potentially unsafe — warn, do not remove

| Pattern | Risk | Decision |
|---|---|---|
| Static literal `onclick="alert(1)"` (no interpolation) | Developer-authored inline handler in the skeleton. It is the developer's own code, not user data — the same trust level as raw HTML they typed — but it bypasses the event system and does not run under a strict CSP. The docs already list "remove inline event handler attributes such as `onclick`" as the fix for `AVX_W17`. | **Keep** the capability; add a build **warning** (`AVX_W52`) naming the handler and pointing to `@click`. Silenceable. Not an error: removing it would drop a real, if discouraged, capability, and a literal handler carries no injected data. |

### C. Clearly unsafe — refuse, with a safe alternative

| Pattern | Risk | Decision | Migration |
|---|---|---|---|
| **Bound** `onclick="{{ expr }}"`, `onerror="{{ expr }}"`, any `on*` attribute whose value interpolates | A reactive state value is written verbatim as an inline handler and executed — `eval` of state, re-run on every update. Never documented; the docs say to use `@click`. | **Build error** (`AVX_C28`) naming the handler, with the `@click` rewrite. A **runtime guard** also refuses to set an `on*` attribute from a bound value, covering the string-renderer and dynamic-name paths. | `onclick="{{ h }}"` → `@click="h"` (or `@click="h()"` to call it). Mechanical; the message gives it. |
| `:[nameExpr]="valExpr"` resolving to an `on*` name (string-renderer fallback only) | The attribute name is dynamic, so the build cannot see it; at run time an `on*` handler can be assembled from state. | Covered by the same **runtime guard**: `domPatch` refuses to set a resolved `on*` name. The `:[ ]` feature itself is preserved for every non-`on*` name. | none; non-`on*` dynamic attributes keep working |

No documented feature is removed: bound `on*` is not documented, is absent from
every fixture, doc example (except an "Incorrect" one) and test, and `@click`
already provides event binding.

### D. Compiler/runtime provides a safe alternative — reclassify `srcdoc`

| Pattern | Risk | Decision | Migration |
|---|---|---|---|
| Bound `srcdoc="{{ html }}"` | `srcdoc` is treated as a URL attribute, but its content is an **HTML document**. `<img onerror>` has no scheme, so the scheme check passes and the markup runs in a same-origin iframe. | Treat a **bound** `srcdoc` as HTML, exactly like `data-ax-html`: a plain value is escaped, and only a `SafeHtml`/`Sanitizer` value introduces markup. `srcdoc` leaves `URL_ATTRIBUTES` (a scheme check is meaningless for a document) and gains HTML-safe application. | To render trusted HTML in an iframe, wrap the value in `html(...)` or a sanitized value — the same rule as `data-ax-html`. A plain string now shows as text instead of executing. |

A static literal `srcdoc="<b>x</b>"` (no interpolation) is developer-authored
and unchanged.

## Trace export (recorded separately)

`avenx trace export` interpolates trace fields into generated test source
without escaping, and the `/__avenx/trace` ingest endpoint has no Origin check
(inventory item S4 in `initial-assessment.md`). Not part of this branch; tracked
for a later `fix/trace-export-injection`.

## Implementation plan

Small branches, each merged into `production-readiness`:

1. `fix/srcdoc-html-safety` — category D. Reclassify `srcdoc`; escape a bound
   value unless `SafeHtml`. Tests, docs, migration note.
2. `fix/event-handler-attributes` — categories B and C. Build error `AVX_C28`
   for a bound `on*`; build warning `AVX_W52` for a static `on*`; runtime guard
   for the bound and dynamic-name paths. Tests, docs, migration note.
3. `fix/lifecycle-hook-warning` — the separate `AVX_W26` correction.

## Diagnostics to add

| Code | Severity | Meaning |
|---|---|---|
| `AVX_C28` | error | A bound `on*` attribute would execute a value as code; use `@event`. |
| `AVX_W52` | warning | A static inline `on*` handler bypasses the event system and a strict CSP. |
