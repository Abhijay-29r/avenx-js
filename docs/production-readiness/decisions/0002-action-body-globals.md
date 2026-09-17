# ADR 0002 — `<action>` and `<resource>` bodies resolve browser globals

- Status: accepted
- Branch: `fix/action-browser-globals`
- Evidence: `../build-validation-inventory.md` §2

## Context

The documentation describes action and resource bodies as ordinary JavaScript
and uses browser APIs in them throughout: the README's `<resource>` example
(`fetch`), `resources.md`, `lifecycle-hooks.md` (`setInterval`, `clearInterval`,
`window`), the routing tutorial (`window`, `alert`), `api-reference/virtuallist.md`
and the React, Angular and Next.js migration guides.

| Period | Behaviour |
|---|---|
| `avenx-core@0.4.3` (published) | bodies ran through `new Function` + `with(this)`; every global resolved |
| July–August 2026 | bodies ran inside `AvenxSandbox`; allow-listed globals only, others `AVX_R15` at run time; resource scopes explicitly received `fetch` and the timer functions |
| `2a825e34` (2026-09-10) onward | action compiler refused `window`, `fetch`, timers, storage and others at build time (`AVX_C21`); any other page global (`requestAnimationFrame`, `window.AppUtils`) `AVX_R15` at run time |

The harvest found 26 documented action/resource bodies that no longer built.

The restriction was not a security boundary. Template expressions document
their boundary as "not isolation", and an action body is developer-authored
JavaScript that can already reach every global through
`this.$element.ownerDocument.defaultView`.

## Decision

1. Action and resource bodies are compiled in *ambient* mode
   (`buildExpressionTable` → `generateBody(…, { ambient: true })`). Free names
   resolve through new runtime primitives in `lib/core/expression/ops.js`:

   | Primitive | Role |
   |---|---|
   | `axGetAmbient` | read: scope → expression globals via Trace → page global |
   | `axTypeofAmbient` | `typeof` of a free name, never throws |
   | `axSetAmbient` | assignment from the expression-statement generator |
   | `axAmbientTarget` | holder object for an assignment from the acorn generator (scope when it binds the name, the page global when it defines it, otherwise scope) |

   They are exported from `avenx-core/runtime` and listed in
   `RUNTIME_IMPORT_NAMES` and `EXPRESSION_OPS`, which a test keeps in agreement.

2. `eval` and `Function` stay refused in every context (`DYNAMIC_CODE_GLOBALS`),
   at build time and at run time, so the documented "no `'unsafe-eval'`"
   property of a production bundle holds.

3. Template expressions and inline event handlers are unchanged: they keep
   `axGet`/`axSet`/`axTypeof` and the build-time refusal of restricted globals.
   `best-practices/guide.md` documents `@click="localStorage.clear()"` as
   "Don't", and it still fails the build.

## Found and fixed in the same branch

Making action bodies compile exposed three silent miscompiles in the acorn
action generator, present on the base branch for any body with statement
syntax:

| Input | Generated before | Result |
|---|---|---|
| `new Date(0)` | `new axGet($s, "Date")(0)` | constructs the lookup helper, then calls it: `d.getTime is not a function` |
| `` tag`x` `` | `` axGet($s, "tag")`x` `` | same precedence problem |
| `{ count }`, `({ a } = v)` | `{ axGet($s, "count") }` | does not parse; destructuring assignment targets were read instead of written |

Identifiers are now rewritten according to their syntactic position: a `new`
callee or template tag is parenthesised, a shorthand property keeps its key, and
a destructuring assignment target is a write.

## Compatibility and migration

- No build that succeeds today fails afterwards; bodies that were refused now
  build.
- No application change is required.
- The behaviour change is documented in
  `core-concepts/template-expressions.md#action-and-resource-bodies`,
  `guides/deployment.md` and `contributing/architecture.md`.

## Evidence

- `test/unit/actionBrowserGlobals.test.js` — resolution order, assignment
  semantics, `eval`/`Function` refusal, unchanged template and handler rules,
  runtime exports, and the README, lifecycle-hook and routing-tutorial examples
  compiled through `ComponentParser`. Fails on the base branch with `AVX_C21`.
- `test/unit/actionCodegenPositions.test.js` — `new`, tagged templates,
  shorthand properties and destructuring assignment, in both modes.
- `test/e2e/specs/actions/browser-apis.spec.js` with fixture app
  `browser-apis` — in the production bundle: a `<resource>` loads JSON with
  `fetch`, `onMount` starts a `setInterval` timer, reads `window.innerWidth` and
  reacts to a real resize, uses `requestAnimationFrame`, `new Date` and shorthand
  objects, and `clearInterval` stops the timer. On the base branch the fixture
  fails to build with `AVX_C21`.

## Follow-up recorded

- `AVX_W26` warns that `<action name="onMount">` "collides with a reserved
  lifecycle hook", while `lifecycle-hooks.md` documents that form as the way to
  define hooks and the hook runs. The warning is wrong for documented lifecycle
  names.
- Trace does not substitute page globals read in step 3; replay of an action
  that depends on them is best-effort.
