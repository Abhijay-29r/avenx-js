# Production Readiness — Initial Technical Assessment

Internal engineering document. Status: **baseline**, written before any
production-readiness change landed.

- Branch base: `production-readiness`, created from `develop` (`9bc1822`) and
  fast-forwarded to `main` (`06d55d3`) through `chore/sync-main`. `develop` was
  strictly behind `main` by 37 commits (no divergence); starting from `develop`
  alone would have dropped the fallback-renderer and unhandled-error fixes those
  commits contain.
- Package version in `package.json`: `0.4.3`.
- Evidence tags: **[Ran]** reproduced by executing it, **[Code]** read in source,
  **[CI]** GitHub Actions logs.

---

## 1. Current architecture

### 1.1 Build pipeline

`AvenxCompiler.build()` (`lib/compiler.js`):

1. Bridges are analysed (`BridgeParser`), then every component and page name is
   collected up front so template tags can be validated project-wide.
2. Guards, components and pages are compiled one file at a time by
   `ComponentParser.parse()`.
3. An entry module is synthesised (`main.app.js` + discovered pages and bridges
   + a prelude of optional runtime modules) and linked by the in-house bundler
   (`lib/bundler`).
4. CSS, the Atlas model and the trace sidecar are produced; output is validated
   (`assertValidOutputs`, `assertRuntimeCapabilities`), written to a staging
   directory and promoted atomically.

### 1.2 Template compilation — two front-ends in series

`ComponentParser.extractTemplate()` [Code]:

```
component source
  └─ readDeclarations()           scanner (parser/tokenizer.js)   ← sound
  └─ regex: strip imports, strip <!-- -->                          ← regex
  └─ preprocessTemplate()         user hook
  └─ StyleProcessor.process()     regex over markup (@css)         ← UNSAFE
  └─ processBindDirectives()      regex over markup (data-ax-bind) ← regex
  └─ validateTemplate()
  ├─ lastSemanticTemplate ──► optimizeStaticSubtrees ─► buildTemplateIR ─► lowerToProgram
  │                            (parseHTML)              (IR)             (render program)
  └─ processForLoops / processSuspense / processErrorBoundary / processDeadlock /
     processDefer / processTransitionTags / processEventDelegation /
     processComponentTags          regex + ad-hoc scanning             ← legacy
        └─► string-renderer template (shipped only for fallback components or dev)
```

The IR path is the primary renderer. The IR refuses a set of constructs
(`RefusalReason` in `lib/compiler/ir/nodes.js`); a refused component is rendered
by the **string renderer** (template → HTML string → `DOMParser` → DOM diff),
which is linked into the bundle only when some component needs it
(`AVX_W47`).

Both paths consume the output of the regex front-end. A defect there corrupts
both renderers, differently.

### 1.3 Expressions

Template expressions and computed values are parsed at build time by
`lib/core/expression/parser.js` and emitted as closures
(`lib/compiler/codegen/expression.js`); action bodies are parsed with acorn
(`lib/compiler/codegen/actions.js`). Every identifier read is emitted as
`axGet($s, "name")` and resolved at runtime through a layered scope Proxy
(`lib/core/reactive/scopeProxy.js`). A development build also links the
interpreter (`lib/core/expression/interpreter.js`), which evaluates anything the
generator could not compile, including a `new Function` + `with` path for
statement bodies. A production build links no interpreter.

### 1.4 Runtime

- `AvenxComponent` (3,051 lines, 95 methods) owns rendering for both renderers,
  slots and scoped slots, refs, provide/inject, keep-alive, mixins, form
  validation, resources, suspense, deadlock boundaries, error reporting, props
  and lifecycle.
- Reactivity: Proxy + `track`/`trigger` over a global
  `WeakMap<target, Map<key, Set<watcher>>>`, lazy computed watchers, Map/Set
  instrumentation (`lib/core/reactive/proxyHandler.js`, `watcher.js`).
- Scheduler: microtask queue sorted by job id (`scheduler.js`).
- Router, guards, navigation delegates, VirtualList, logger, diagnostics
  catalogue.

### 1.5 Tooling

Atlas (`lib/compiler/atlas`), Trace (`lib/core/trace`), Rewind
(`lib/core/reactive/journal.js`, `lib/compiler/rewind`), CLI (`bin/`), dev
server with live reload and trace ingest (`bin/commands/serve.js`), Vite plugin
and three official plugins (`plugins/`).

---

## 2. Critical production blockers

Ordered by severity. Each has a reproduction.

| # | Blocker | Evidence |
|---|---|---|
| B1 | **Silent miscompile from the regex front-end.** `<button @click="count > 3 ? add() : null" @css button>` builds successfully: the scoped class is not applied, its CSS rule is dropped, the IR reads `@css` as an event named `css`, Atlas reports a false `AVX_W41`. With the attributes reordered the handler becomes `count class=`; the production bundle renders the component as an empty element with no console error and the development bundle renders `3="true" add="true" :="true"`. | [Ran] scaffolded app, production and development builds, Chromium |
| B2 | **A production build succeeds with expressions it cannot execute.** `AVX_W48` ("will be interpreted at runtime") is a warning, but a production bundle links no interpreter, so every such expression throws at render or event time. | [Code] `reportExpressionGaps` in `lib/compiler.js`, `evaluateExpression` in `lib/core/security/evaluator.js`; [Ran] as part of B1 |
| B3 | **npm does not ship this framework.** `avenx-core@0.4.3` on npm was published 2026-06-18 (34 files, 92 KB unpacked). The repository has ~2,300 commits since then and still says `0.4.3`. Atlas, Trace, Rewind, the IR, render programs and the bundler are not in the published package. `avenx init` pins `^0.4.3`. | [Ran] `npm view avenx-core` |
| B4 | **`main` CI is red.** Four `test/e2e/specs/serve/dev-server.spec.js` tests fail with `ERR_CONNECTION_REFUSED`; the PR that added them (#1303) was merged with failing checks. The Bundle Size Monitor fails on fork PRs (`Resource not accessible by integration`). | [CI] run 35140667608, 35119300734 |
| B5 | **XSS sinks in compiled bindings.** `srcdoc="{{ x }}"` executes script in a same-origin iframe because `srcdoc` is treated as a URL attribute; `onclick="{{ x }}"` compiles to `setAttribute('onclick', x)`. | [Ran] Chromium |
| B6 | **State initialisers silently change type.** `items="[{ id: 1 }]"` (not strict JSON) becomes the *string* `"[{ id: 1 }]"` with no diagnostic. | [Ran] |

---

## 3. Architectural inconsistencies

1. **Two template front-ends.** Regex/string rewriting for the legacy renderer,
   IR for the compiled renderer, and the IR's input is itself produced by regex
   passes.
2. **Two renderers.** The string renderer is still the only implementation of
   suspense, error boundaries, deadlock boundaries, transitions, refs, virtual
   lists, template resources, dynamic components, router views and declarative
   validation. It cannot be removed without migrating each (see the feature
   inventory).
3. **Eight or more lexers for overlapping inputs**: `parser/tokenizer.js`,
   `parser/htmlTree.js` (its own tag-end and attribute scanners),
   `StyleProcessor` regexes, `templateUtils.processBindDirectives` regexes,
   `ComponentParser.process*` regexes, the expression parser, acorn, the Atlas
   reference scanner (`atlas/resolve.js`) and the bundler module scanner.
   `tokenizer.parseAttributeRegion` and `htmlTree.parseAttributes` implement the
   same grammar twice.
4. **Static knowledge discarded.** The compiler knows every state, computed and
   method name but emits dynamic `axGet(scope, "name")` lookups; computed values
   are keyed by source text; components are linked at runtime by string name.
5. **Runtime depends on a compiler module** (`AvenxComponent` imports
   `lib/compiler/render/program.js`).
6. **Dev/prod divergence by design** (interpreter only in development) without a
   build-time guarantee that production refuses what only development can run
   (B2).

---

## 4. Compiler risks

| Risk | Detail |
|---|---|
| Regex markup rewriting | `StyleProcessor.process` (`<([^>]+)\s+@css…>`), `<@css />` placement by `lastIndexOf('<')`, comment stripping by `<!--[\s\S]*?-->` (also strips comment text inside attribute values and expressions), `processBindDirectives`, suspense/errorBoundary/deadlock/defer by non-nesting `[\s\S]*?` patterns. |
| Attribute order loss | `htmlTree.parseAttributes` returns a plain object: integer-like attribute names reorder, duplicates collapse. |
| Entity round-trip | `serializeHTML` escapes `"` as `&quot;`; `parseAttributes` does not decode entities, so a second parse of a serialised expression sees `&quot;`. The static-subtree pass serialises before the IR parses. |
| Text scanning | `parseHTML` treats any `<` followed by a tag-name character as a tag, including inside `{{ a <b }}`. |
| Unclosed / mismatched tags | Silently tolerated (`parseHTML` skips unmatched closers). |
| Warnings that describe broken output | `AVX_W48` in production (B2). |
| Determinism | Not tested. `styleProcessor` and parser caches are per-instance; ordering of `Map`/object iteration is stable, but there is no test that builds twice and compares bytes. |

## 5. Runtime risks

| Risk | Detail |
|---|---|
| Scheduler drops work | `handleDeadlock` clears the entire queue (`queue.length = 0`) when one job exceeds the per-flush limit of 10, discarding unrelated pending updates. |
| Broad invalidation | `trigger` recursively triggers every ancestor key, so writing `rows[i].label` wakes every watcher reading `rows`, including the list op. |
| Hot-path cost | `AvenxWatcher.addDep` scans all deps linearly on every tracked read; `trigger` builds a property path string on every write to maintain `causationTrace`, even with tracing off. |
| Single-parent ancestry | `parentMap` records one parent per raw object; a shared object reports ancestry through whichever parent was set last. |
| God class | `AvenxComponent` couples every feature; everything is linked into every bundle. |
| Size | Production hello-world: 317.6 KB raw / 72.5 KB gzip; 380.8 KB once one component falls back; development 848 KB. The minifier only strips comments and indentation. |

## 6. Security risks

| # | Issue | Severity | Evidence |
|---|---|---|---|
| S1 | `srcdoc` binding XSS (classified as URL) | Medium | [Ran] |
| S2 | Dynamic `on*` attribute bindings accepted | Medium-Low | [Ran] |
| S3 | Expression "sandbox" bypass reaches `Function` via native callbacks and an unchecked `thisArg`; contradicts the documented guarantee in `lib/core/expression/ops.js` | Low (claim integrity) | [Ran] |
| S4 | `generateTest` interpolates trace fields into comments without escaping → code injection in exported tests; `POST /__avenx/trace` has no Origin check | Low-Medium | [Ran] |
| S5 | Dev-server inspector renders state/config unescaped (issue #1264) | Low (dev only) | issue, not re-verified |
| S6 | Development interpreter uses `new Function` + `with` | Informational (dev only) | [Code] |

Done well: dev-server path containment (`resolveRequestPath`), trace id
validation, default text escaping, URL scheme filtering.

## 7. Testing gaps

- `test/unit/xss.test.js` exercises the legacy `TemplateRenderer`, not compiled
  bindings. No test covers `srcdoc` or `on*` bindings.
- No test combines `@css` with `>` in attribute values, reorders attributes, or
  checks that a successful production build renders every component.
- No build-determinism test.
- No invalid-state-initialiser test.
- Benchmarks install the interpreter and string renderer and run in happy-dom,
  so they do not measure production bundles.
- The custom runner reports per file, not per case; one failing assertion hides
  the rest of the file.
- Coverage artefacts in `coverage/` predate the IR and bundler.
- E2E runs Chromium only on PRs; the dev-server spec is failing.

## 8. Performance risks

No cross-framework or real-browser benchmark exists. Indicative Chromium numbers
for a 1,000-row keyed table (one machine, production bundle): create ≈ 40–55 ms,
replace-all 8–9 ms, update every 10th row 8–16 ms, swap two rows ≈ 13 ms. The
update and swap figures are consistent with ancestor-triggered list
re-reconciliation. Bundle size is dominated by `AvenxComponent` (55 KB raw),
`AvenxError` message catalogue (24 KB), proxy handler (18 KB), `AvenxApp`
(16 KB), router (15 KB). Dev-server rebuilds recompile the whole project (issue
#1273).

## 9. Release and distribution risks

- No git tags, no GitHub releases, no changelog.
- `npm-publish.yml` publishes on a GitHub release event only; nothing verifies
  that the tarball matches the repository or that `package.json` version moved.
- The version has not changed across a complete architecture replacement.
- `package.json` `repository`/`bugs`/`homepage` point at `avenx-js/avenx-js`;
  the repository is `Avenx-JS/avenx-js` (redirects today).
- `docs/` contains 43 committed JSDoc HTML files, some for modules that no
  longer exist (`AvenxBridge.html`).
- Every CLI command prints `fatal: not a git repository` outside git.

---

## 10. Recommended implementation order

Each step is a separate working branch merged into `production-readiness`.

1. **`fix/compiler-front-end`** — B1. One quote- and interpolation-aware markup
   lexer shared by the tree parser and every pre-IR rewrite; `@css` application,
   comment stripping and `data-ax-bind` expansion move from regex to token
   spans; post-conditions that fail the build if a reserved token survives.
2. **`fix/build-validation`** — B2 and B6. Production builds refuse expressions
   they cannot execute; invalid state initialisers are diagnosed.
3. **`fix/security-boundaries`** — S1, S2, S4, S5; correct the sandbox claims
   (S3) rather than extending a boundary that cannot be made sound.
4. **`fix/ci-dev-server-e2e`** — B4. Diagnose the connection-refused failures;
   make the bundle-size workflow safe on fork PRs.
5. **`fix/runtime-scheduler`** — never discard unrelated pending jobs; document
   ordering and deadlock semantics.
6. **`test/production-parity`** — dev/prod DOM parity and build determinism
   through the real CLI.
7. **`chore/release-integrity`** — package-content check, changelog, SemVer
   policy, release checklist, version decision (**requires approval to
   publish**).
8. **`refactor/legacy-front-end`** — migrate suspense, error boundary, deadlock,
   defer and transition rewrites from regex to the tree; this is the precondition
   for moving each construct into the IR.
9. **`fix/runtime-reactivity`** — ancestor triggering, `addDep`, trace-path cost,
   with before/after measurements.
10. **`refactor/runtime-size`** — feature-gate `AvenxComponent` subsystems,
    measured per module.
11. **Renderer unification** — construct by construct, keeping the string
    renderer until each replacement demonstrates parity (see feature inventory).
12. **Static scope resolution, direct component references, bundler/minifier
    decision, component authoring direction (TypeScript)** — design documents
    first; these carry long-term consequences and need approval.

## 11. Risks per proposed refactor

| Refactor | Risk | Mitigation |
|---|---|---|
| Shared markup lexer | Existing templates that relied on regex leniency may now parse differently (e.g. unquoted values containing `>`) | Snapshot the compiled output of every fixture and E2E app before and after; any difference must be explained |
| Production refuses uncompiled expressions | Builds that "succeeded" before now fail | Only output that already threw at runtime is refused; diagnostic names file, expression and fix |
| Rejecting `on*` bindings | A project binding `onclick="{{ }}"` intentionally would fail to build | Diagnostic points to `@click`; static `onclick="…"` literals remain allowed |
| Scheduler change | Update ordering visible to applications may shift | Keep id ordering; only change what is dropped; tests for ordering |
| Reactivity granularity | Watchers that relied on ancestor wake-ups (deep watchers, list ops over mutated items) could stop updating | Keep ancestor notification for `deep` watchers and collection structure changes; E2E list specs as a gate |
| Legacy front-end migration | Fallback constructs are covered mainly by unit tests; nested/combined usage is untested | Add parity fixtures before migrating each construct |
| Runtime splitting | Public exports from `avenx-core/runtime` must not disappear | `publicApiSurface.test.js` as a gate; subsystems move behind imports, not out of the API |
| Replacing the bundler/minifier | New dependency, different output shape, source-map changes | Decision document with measurements; approval before implementation |
| Version and publish | Users on `^0.4.3` would receive a different framework | SemVer decision and migration guide; approval before any publish |
