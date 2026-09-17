# Build Validation — Inventory

Internal engineering document. Written before `fix/build-validation` changed any
behaviour, to decide which build outcomes are compiler limitations to fix and
which are genuinely invalid input to refuse.

Rule applied throughout: valid, documented Avenx.js functionality is never
turned into an error because the current compiler cannot handle it. A compiler
limitation is fixed in the compiler.

## Method

1. **Harvest.** Every template the project documents or ships was compiled with
   `ComponentParser` in production mode, collecting expression gaps (`AVX_W48`),
   security refusals (`AVX_C21`), render fallbacks (`AVX_W47`) and thrown
   errors:
   - 367 `html` code blocks in `README.md` and `docs/src/content/docs/**`
   - 42 component and page files under `test/e2e/apps`, `test/fixtures`,
     `templates`, `plugins`
   - total 409 units
2. **Expression battery.** 53 expressions covering the documented expression
   language and common JavaScript syntax outside it were evaluated through the
   development interpreter and through the production code generator, and the
   results compared.
3. **State harvest.** Every `<state>` attribute value in the repository (docs,
   tests, fixtures, templates, CLI generators, benchmarks) was coerced with the
   compiler's `coerceValue` and classified.
4. **History.** Behaviour at the published `avenx-core@0.4.3` (`1fe5bcd9`) and
   before `2a825e34` was read from git to establish what used to work.

Harvest results: `AVX_W48` 3, `AVX_C21` 27, `AVX_W47` 47, thrown 5.

---

## 1. `AVX_W48` — expressions the code generator did not compile

### How a gap arises

`buildExpressionTable` (`lib/compiler/codegen/table.js`) records a gap when:

- a template expression, computed value, directive value or prop fails
  `compileExpressionToSource` (the Avenx expression parser), or
- an event handler, `<action>` or `<resource>` body fails both the
  expression-statement compiler and acorn (`compileActionToSource`).

The production bundle links no interpreter, so every gap throws `AVX_R32` when
it is evaluated. The warning text says the expression "will be interpreted at
runtime", which is only true of a development build.

### Development vs production

The battery found **no expression that works in development and fails in
production.** The development interpreter parses with the same parser the code
generator uses (`lib/core/expression/parser.js`) and refuses the same inputs;
action bodies fall back to `new Function` in development and to acorn in
production, which accept the same JavaScript.

| Syntax | Documented? | Development | Production |
|---|---|---|---|
| member access, optional chaining, calls, callbacks, `function` expressions, arithmetic/logical/nullish, ternary, template literals, array/object literals, spread, `new`, assignment/update, `typeof`, `in`, `instanceof`, `void`, `**`, `>>>`, `\|\|=`, numeric separators, sequence | supported (`template-expressions.md`) | works | works, identical results |
| destructuring parameters `({ id }) => id`, `([k, v]) => …`, default parameters | listed as **not supported** | refused (`AVX_R32`) | refused |
| regular-expression literals `/h/.test(s)` | not mentioned | refused | refused |
| `delete`, BigInt literals, tagged templates, `async` arrows | not mentioned | refused | refused |

### The three harvested gaps

| Source | What it is | Category |
|---|---|---|
| `core-concepts/components.md:41` | an `onMount` action containing `new Chart(…, { ... })` | illustrative placeholder in a doc snippet; not valid JavaScript anywhere |
| `core-concepts/rewind.md:169` | `<action …> ... </action>` | illustrative placeholder |
| `core-concepts/defer.md:149` | `<@defer when="visible; interaction">` | documented on that page as **not supported**; it fails in both modes, and the deferred content never renders |

All documented `when` triggers (`idle`, `visible`, `interaction`, `hover`,
`click`, `timer(n)`, `500ms`, and expressions such as `state.isReady`) compile
without a gap.

### Decision

| Category | Action |
|---|---|
| Syntax outside the expression language (fails in both modes) | **Production build error.** Development keeps the warning and renders what it can. This is what `template-expressions.md` already promises: "an unsupported expression is a build failure with a file, a line and a reason — never a blank value discovered in production." |
| Placeholders in documentation | Leave as illustrative, but mark them so readers do not copy them. |
| Documented-unsupported multi-trigger `<@defer>` | Covered by the production error; the diagnostic names the construct. |
| Correct the `AVX_W48` message | It must not claim the expression will be interpreted in production. |

Extending the expression language (regex literals, destructuring parameters)
would be a feature addition, not a restoration; it is recorded as follow-up
work.

---

## 2. `AVX_C21` — refusals of browser globals (a regression)

### Harvest

All 27 refusals by global and context:

| Context | Global | Count |
|---|---|---:|
| `<action>` / `<resource>` body | `fetch` | 18 |
| `<action>` body | `window` | 4 |
| `<action>` body | `setInterval` | 2 |
| `<action>` body | `clearInterval` | 2 |
| template event handler | `localStorage` | 1 |

The README's headline async-data example fails to build:

```
[AVX_C21] The expression "return fetch('/api/users').then(res => res.json());" cannot be compiled:
"fetch" is a restricted global and cannot be used in an action body.
```

Pages affected: `README.md`, `api-reference/virtuallist.md`,
`best-practices/guide.md`, `core-concepts/components.md`,
`core-concepts/lifecycle-hooks.md`, `core-concepts/resources.md`,
`getting-started/routing-tutorial.md`, `guides/virtual-list.md`,
`migration/angular.md`, `migration/nextjs.md`, `migration/overview.md`,
`migration/react.md`.

A runtime probe confirmed the restriction is broader than the compile-time list:
any global outside the expression allow-list (`requestAnimationFrame`, a
page-provided `window.AppUtils` read as `AppUtils`) throws `AVX_R15` inside an
action body at runtime.

### History

| Version | Action bodies | Resource bodies |
|---|---|---|
| `avenx-core@0.4.3` (published) | `new Function(…, 'with(this) { … }')` — full JavaScript, all globals | same |
| sandbox era (July–Aug 2026) | run inside `AvenxSandbox.createProxy`; non-allow-listed globals throw at runtime | scope explicitly given `fetch`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `Promise` — `fetch` worked |
| `2a825e34` (2026-09-10) and later | refused at build time | refused at build time |

### What the documentation says

- `template-expressions.md`: "an `<action>` body is ordinary JavaScript" and
  "Move the browser API into a component action".
- `lifecycle-hooks.md`: `onMount` is for "fetching initial API data … attaching
  global event listeners, or starting timers", with examples using `fetch`,
  `setInterval` and `window`.
- `best-practices/guide.md`: `@click="localStorage.clear()"` is shown as
  **Don't**, with "Move such behavior into component actions".
- The expression boundary is documented as "not isolation"; action bodies are
  developer-authored JavaScript and can already reach every global through
  `this.$element.ownerDocument.defaultView`.

### Decision

| Context | Current | Decision |
|---|---|---|
| Template expressions and event handlers | restricted globals refused | **Unchanged.** Documented rule; the `localStorage` refusal above is the documented "Don't". |
| `<action>` and `<resource>` bodies | restricted globals refused at build time; other globals refused at runtime | **Restore** ordinary JavaScript global resolution: scope first, then the allow-listed globals through Trace's substitution point, then the real global. `eval` and `Function` remain refused so the documented "no `'unsafe-eval'`" property of the bundle holds. |

This removes a restriction; no build that succeeds today fails afterwards.

---

## 3. Thrown errors

| Source | Error | Category | Action |
|---|---|---|---|
| `best-practices/guide.md:34` | `TypeError: Cannot read properties of null (reading 'end')` | **Compiler crash**: `scanTags` (`lib/compiler/parser/tokenizer.js`) dereferences the `null` returned by `findRawTextClose` when an `<action>`, `<resource>`, `<script>` or `<style>` tag is never closed | Fix: report `AVX_C26` with a location |
| `core-concepts/styling.md:364` | `AVX_C24` | Doc snippet places a `<@css>` stylesheet block inside `ParentComponent.component.js`. No version of `ComponentParser` in the history reads `<@css>` from a component file; the page itself opens with "Styling is defined in the companion `.component.css` stylesheet". | Correct the doc example (split into `.css` and `.js`) |
| `core-concepts/templates.md:257` | `AVX_C22` | Intentional example of the refused `<@if count > 3>` form | none |
| `troubleshooting/errors.md:443`, `:468` | `AVX_C04`, `AVX_C05` | Intentional contract-violation examples | none |

---

## 4. `AVX_W47` — render fallbacks

Not errors: each renders through the string renderer, which production links
when needed. Listed for the feature inventory; none changes in this work.

| Construct | Count | Note |
|---|---:|---|
| `<@errorBoundary>` | 10 | IR does not model it yet |
| `<@deadlock>` | 6 | IR does not model it yet |
| `<VirtualList>` | 6 | IR does not model it yet |
| `<@suspense>` | 5 | IR does not model it yet |
| `<transition>` / `data-ax-transition` | 8 | IR does not model it yet |
| `data-ax-validate` | 4 | IR does not model it yet |
| `data-ax-ref` | 1 | IR does not model it yet |
| `<@defer>` with `<@loading>` | 1 | **Compiler limitation**: the IR's defer lowering does not recognise `<@loading>`, which `defer.md` documents |
| `<@for item="x" in="y">` | 4 | **Compiler limitation**: attribute-form loop header used in `api-reference/component.md` and `troubleshooting/errors.md`; the IR refuses it as malformed while the string renderer accepts it |
| expression gaps | 2 | the `W48` cases above |

The two compiler limitations are recorded for the renderer-unification work.

---

## 5. `<state>` values

432 values harvested.

| Category | Count | Example | Coerced to | Documented behaviour | Decision |
|---|---:|---|---|---|---|
| strict JSON number / boolean / null | 223 | `"0"`, `"false"`, `"null"` | number / boolean / null | yes | unchanged |
| strict JSON array / object | 46 | `'["work", "urgent"]'` | array / object | yes (`components.md`) | unchanged |
| plain text | 126 | `"Guest"`, `"Home"` | string | yes | unchanged; **no diagnostic** |
| single-quoted JS string | 23 | `"'My Counter App'"`, `"''"` | string without quotes | yes (`state-management.md`, routing tutorial) | unchanged |
| JS literal with quoted keys and single-quoted strings | 4 | `"['apple']"`, `"{'name': 'avenx'}"` | array / object (via quote swap) | used by E2E apps and unit tests | unchanged |
| **JS object/array literal with unquoted keys** | 5 | `"{ id: 1, name: 'Avenx Framework' }"` | **string** | contradictory: `components.md` says it "silently falls back to a raw string"; `state-management.md` says values are "evaluated as JSON/JavaScript expressions"; `api-reference/virtuallist.md`, `components.md` and `troubleshooting/errors.md` examples use such values as arrays/objects | **Compiler limitation — fix**: evaluate constant JavaScript literals at build time |
| bracketed prose or placeholder | 2 | `"[ ... 500 products ... ]"`, `"{{ name }}"` (generator placeholder) | string | — | unchanged |
| text that parses as an expression but is not a literal | 1 | `"a > b"` (tokenizer test) | string | — | unchanged; no diagnostic (not bracketed) |

### Decision for object/array literals

- A value that starts with `{` or `[` and parses as a JavaScript expression made
  only of constant literals (objects, arrays, strings, numbers, booleans,
  `null`, unary `-`/`+`, template literals without substitutions) is evaluated
  at build time.
- A value that starts with `{` or `[`, parses as an expression, but is **not**
  constant (for example `{ items: list }` or `[Date.now()]`) stays a string, as
  today, and the build warns (new code) because the author almost certainly
  meant an initialiser the compiler cannot evaluate.
- Any other value keeps its current coercion. Plain text is never diagnosed.

Behaviour change: the five unquoted-key literals become objects/arrays instead of
strings. The documentation that describes the string fallback is updated.
