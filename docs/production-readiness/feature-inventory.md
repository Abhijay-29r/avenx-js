# Feature Inventory

Internal engineering document. Baseline: `production-readiness` at `06d55d3`.

Every feature listed here must keep working through the production-readiness
work. No feature removal is authorised; a feature that cannot be migrated keeps
its current implementation until a replacement demonstrates parity.

## Legend

**Docs** — publicly documented under `docs/src/content/docs` (path given) or in
`README.md`.

**Renderer** — which template renderer implements it:
- *IR* — compiled render program (`lib/compiler/ir`, `lib/core/renderer/program`)
- *String* — legacy string renderer; a component using it is refused by the IR
  and falls back (`AVX_W47`)
- *n/a* — not a template construct

**Production status** — what has been shown to work in a production bundle:
- *E2E-prod* — a Playwright spec drives it in a production build
- *E2E* — a Playwright spec drives it, but only against a build whose mode is not
  asserted to be production for that feature specifically (all E2E fixture apps
  are production builds unless listed in `developmentBuild`)
- *Unit* — only unit/integration tests (happy-dom, often with the interpreter
  and string renderer installed); **production behaviour unverified**
- *System* — a system test builds a real project through the CLI

**Migration plan** — how the feature survives the refactors in
`initial-assessment.md` §10.

---

## 1. Component model

| Feature | Public API | Current implementation | Tests | Production status | Renderer | Migration plan |
|---|---|---|---|---|---|---|
| Components (`*.component.js` + `.component.css`) | README; `core-concepts/components.md` | `ComponentParser.parse`, `AvenxComponent` | `componentParser`, `compiler`, E2E `components/composition` | E2E | IR | Preserved; front-end lexer change must produce identical output for existing fixtures |
| Pages (`*.page.js`) | README; `core-concepts/routing.md` | `ComponentParser.parse(type='page')`, `AvenxPage`, auto-registration in `processPages` | E2E `routing/*`, `smoke` | E2E | IR | Preserved |
| `<state>` | README; `components.md` §Single state tag, §Attribute coercion | `parser/declarations.js`, `ExpressionParser.parseState` | `declarationParser`, E2E `rendering/multiline-state` | E2E | n/a | Add diagnostic for non-JSON initialisers that silently become strings (B6); valid initialisers unchanged |
| `<computed>` | README; `core-concepts/computed.md` | `parseComputed`, `buildExpressionTable`, `ProxyHandlerFactory.evaluateComputedWatcher` | `computed_cache`, `reactivity_lazy`, E2E `reactivity/state-drives-dom` | E2E | n/a | Preserved |
| `<action>` | README; `components.md` | `parseMethods`, `codegen/actions.js` (acorn), interpreter in dev | `actionCodegen`, E2E counter | E2E | n/a | Production build must refuse actions it cannot compile (B2) |
| Atomic actions (`<action atomic onConflict>`, `atomic()`) | README (Rewind); `core-concepts/rewind.md` | `buildAtomicSpec`, `runtime/atomic.js`, `reactive/journal.js` | `rewindJournal`, `rewindTrace`, integration `rewind`, system `rewindCli` | Unit + System (E2E missing, issue #1267) | n/a | Preserved; add E2E-prod |
| Props | `components.md` | `processComponentTags`, IR `COMPONENT`/`PROP` op, `setProps` | integration `component_props`, E2E `composition` | E2E | IR | Preserved |
| `$emit` / component events | `api-reference/component.md` | `AvenxComponent.emit/$emit` | `componentEventEmission` | Unit | n/a | Preserved |
| Lifecycle hooks (`onMount`, `onBeforeMount`, `onBeforeUpdate`, `onUnmount`, `onErrorCaptured`…) | `core-concepts/lifecycle-hooks.md`; `components.md` | `LifecycleManager`, `#triggerLifecycle` | `lifecycle_error`, `onBeforeMount`, `onBeforeUpdate`, integration `lifecycle`, `child_component_lifecycle` | Unit | both | Preserved |
| `$watch`, `$watchEffect`, `watch()` | `api-reference/component.md` | `AvenxWatcher`, `watchEffect` | `componentWatch`, `watchEffect`, `watcher` | Unit | n/a | Preserved; scheduler/reactivity fixes gated by these tests |
| `$nextTick` | `api-reference/component.md` | scheduler `nextTick` | `nextTick` | Unit | n/a | Preserved |
| `AvenxComponent.extend` | `api-reference/component.md` | `static extend` | `avenxComponentExtend` | Unit | n/a | Preserved |
| Mixins (`app.mixin`, `AvenxComponent.mixin`) | `core-concepts/plugins-and-mixins.md` | `static mixin`, `AvenxApp.mixin` | `globalMixinsPlugins` | Unit | n/a | Preserved |
| Plugins (`app.use`) | `plugins-and-mixins.md` | `AvenxApp.use` | `globalMixinsPlugins`, `pluginInstallErrors`, `test:plugins` | Unit | n/a | Preserved |
| Provide / inject | `core-concepts/provide-inject.md` | `__initProvide`, `__initInjection` | integration `provide_inject` | Unit | both | Preserved |
| Keep-alive (`keepAlive`, `keepAliveLimit`) | `api-reference/app.md` | `AvenxApp` page LRU cache | `keepAlive` | Unit | n/a | Preserved |
| Compiler contracts (`<contract static pure deterministic isolated />`) | `core-concepts/compiler-contracts.md` | `ContractValidator`, `componentParserContracts` | `contractParser`, `contractValidation`, `isolatedContract`, `memoizationContract`, `staticContractOptimization` | Unit | n/a | Preserved |
| Template preprocessors (`preprocessors` config, `<template lang>`) | `guides` / config | `ComponentParser.preprocessTemplate` | `templatePreprocessors`, `preprocessors` | Unit | n/a | Preserved; runs before the shared lexer |
| Imports inside component files | README (bridges) | `collectImportBindings`, `collectImportStatements` | system `moduleResolution` | System | n/a | Preserved; import stripping must stay line-scoped |
| Environment variables (`AVX_PUBLIC_*`, `.env`) | `guides` | `lib/env.js`, `replaceEnvVariables` | `env`, `envInterpolation`, `cliEnvCommand` | Unit | n/a | Preserved |
| Path aliases | config docs | `resolvePathAlias` | `pathAlias` | Unit | n/a | Preserved |

## 2. Templates and directives

| Feature | Public API | Current implementation | Tests | Production status | Renderer | Migration plan |
|---|---|---|---|---|---|---|
| Interpolation `{{ }}` (escaped) | `core-concepts/templates.md` §1 | IR `INTERPOLATION` → `text` op; string renderer | `renderProgramCompile`, `multilineInterpolation`, E2E `rendering` | E2E | both | Preserved |
| Raw interpolation `{{{ }}}` | `templates.md` §1 | `raw` op / string renderer | `xss` (string renderer only) | Unit | both | Preserved; add compiled-path test; documented as unsanitised |
| `SafeHtml` / `html` / `Sanitizer` | `templates.md` | `security/escapeHtml.js`, `security/sanitize.js` | `sanitize`, `xss` | Unit | both | Preserved |
| Bound attributes `attr="{{ }}"` and mixed parts | `templates.md` | `attr` / `attrp` ops, `urlPolicy` | `renderProgramRuntime`, E2E counter | E2E | both | Preserved; `srcdoc` and `on*` handled per security fixes (S1, S2) |
| Boolean attribute coercion | `templates.md` §3 | `bool` op | integration `boolean_attributes`, E2E `compiled-rendering` | E2E | both | Preserved |
| `data-ax-show` | `templates.md` §4b | `show` op | E2E `rendering` | E2E | both | Preserved |
| `data-ax-class` | `directives` docs | `class` op | `directives` | Unit | both | Preserved |
| `data-ax-style` | `directives` docs | `style` op | E2E `styling` | E2E | both | Preserved |
| `data-ax-html` | `templates.md`; `directives.md` §HTML sanitization | `html` op (escapes non-`SafeHtml`) | `directives` | Unit | both | Preserved |
| Two-way binding `data-ax-bind` (text, textarea, select, checkbox, checkbox arrays, radio) | `templates.md` §2 | `processBindDirectives` (regex, `lib/core/utils/templateUtils.js`) | `twoWayBinding`, integration `form_bindings`, E2E `forms/*` | E2E | both | **Move expansion from regex to the shared lexer**; E2E forms specs are the gate |
| `<@if>` / `<@elseif>` / `<@else>` | `templates.md` §4; README | IR `IF` (compiled only; `COMPILER_COMPILED_ONLY_CONSTRUCT` if the template falls back) | `templateIr`, `irLowering`, `programBlocks`, E2E `lists-and-conditionals` | E2E | IR only | Preserved; must stay an error, not a silent literal, on fallback |
| `<@for item in list key="…">` / `<@empty>` | `templates.md` | IR `FOR`, `blocks.js`; string `listManager` | integration `list_*`, E2E `rendering`, `events/loop-scope` | E2E | both | Preserved |
| Event handlers `@event="…"` | README; `core-concepts/events.md` | IR `event` op; `processEventDelegation` (string) | `eventBinder`, `eventExecutor`, E2E `events` | E2E | both | Preserved; `@css` must never be read as an event (B1) |
| Event modifiers (`.prevent .stop .once .self .enter` …) | `events.md` | `bindEvents.js` | `eventModifiers`, E2E `bindings-and-modifiers` | E2E | both | Preserved |
| Components in templates `<Child />` | README | `processComponentTags`, IR `COMPONENT` | E2E `composition` | E2E | both | Preserved |
| Dynamic components `<Component is="…">` | `components` docs | `data-avenx-comp-dynamic` | `dynamicComponent` | Unit | **String** | Keep fallback; IR migration later |
| Slots, named slots, slot fallback | `components.md` | IR `SLOT`; string `#fillSlots` | integration `slots`, `slots_fallback`, E2E `composition` | E2E | both | Preserved |
| Scoped slots (`<slot :prop>`, `data-slot-props`) | `components.md` §Scoped slots | `processSlotProps`, `escapeScopedSlots` (regex), `#renderScopedSlot` | `scopedSlots` | Unit | String (scoped part) | Move regex to lexer; keep behaviour |
| Refs `data-ax-ref`, `$refs` | `directives.md` | `#collectRefs` | `componentRefs` | Unit | **String** | Keep fallback; IR migration later |
| Custom directives (`app.directive`, `AvenxComponent.directive`) | `directives.md` | `AvenxApp` / component directive registry | `directives_custom` | Unit | both | Preserved |
| Static subtree optimisation / `static` contract | `compiler-contracts.md` | `optimizeStaticSubtrees` | `staticSubtrees` | Unit | both | Preserved; its serialise/re-parse round trip is on the risk list |
| `<@defer when>` + `<@placeholder>` / `<@loading>` | `core-concepts/defer.md` | IR `DEFER`; string `deferManager` | `deferCompiler`, `deferManager`, E2E `performance/defer` | E2E | both | Preserved |
| `<@suspense>` + `<@fallback>` | README; `core-concepts/resources.md` | `processSuspense` (regex), `#suspend` | `suspense`, E2E `fallback-renderer` | E2E-prod | **String** | Regex → tree first, then IR |
| `<@errorBoundary>` + `<@fallback as>` | README | `processErrorBoundary` (regex) | integration `errorBoundary`, E2E `fallback-renderer` | E2E-prod | **String** | Regex → tree first, then IR |
| `<@deadlock name>` + `$tripDeadlockBoundary` | README; `core-concepts/deadlock.md` | `processDeadlock` (regex), `DeadlockManager` | `deadlock`, `compilerDeadlock`, E2E `fallback-renderer` | E2E-prod | **String** | Regex → tree first, then IR |
| `<resource>` declarations | README; `resources.md` | `parseResources`, `reactive/Resource.js` | `resource`, `resourcePollInterval`, integration `resourcePollingIntegration` | Unit (E2E missing, issue #1266) | **String** when in template | Preserved; add E2E-prod |
| Transitions `<transition>` / `data-ax-transition` | `core-concepts/transitions.md` | `processTransitionTags`, `DomPatcher` | `transition`, `component_transition` | Unit | **String** | Keep fallback; IR migration later |
| Declarative form validation `data-ax-validate` | `core-concepts/form-validation.md` | `validation/validator.js`, `#validateFormElements` | `declarative_validation` | Unit | **String** | Keep fallback; IR migration later |
| `<VirtualList>` | `api-reference/virtuallist.md` | `runtime/VirtualList.js`, built-in registry | `virtualList`, `virtualListPagination` | Unit | **String** | Keep; linked only when referenced |
| SVG namespace handling | — | `bindings`, `domPatch` | `svgNamespace` | Unit | both | Preserved |
| HTML comments in templates | — | stripped by regex in `extractTemplate` | — | — | both | Strip by lexer span (regex also strips comment-like text inside attribute values) |

## 3. Styling

| Feature | Public API | Current implementation | Tests | Production status | Renderer | Migration plan |
|---|---|---|---|---|---|---|
| Scoped CSS `@css name` attribute | README; `core-concepts/styling.md` | `StyleProcessor.process` (regex over markup) | `styleProcessor`, `componentStyles`, E2E `styling` | E2E (broken with `>` in the same tag, B1) | n/a | **Replace regex with lexer spans; same generated class names** |
| `<@css name />` element form | `styling.md` | `StyleProcessor.process` (regex + `lastIndexOf('<')`) | `styleProcessor` | Unit | n/a | Same placement rule, implemented on tokens |
| `<@global>` / `@def` variables | README; `styling.md` | `ComponentParser.extractStylesAndVars`, `applyVariables` | E2E `styling` | E2E | n/a | Preserved |
| CSS custom-property scoping, `:deep` | `styling.md` | `scopeCustomProperties`, `scopeSelectorList` | `styleProcessor` | Unit | n/a | Preserved |
| `@media` / `@supports` / `@container` / `@keyframes` | `styling.md` | `extractRules` | `styleProcessor` | Unit | n/a | Preserved |
| Sass / SCSS / Less / PostCSS preprocessors | README | `StyleProcessor.preprocessCss` | `vitePluginScopedCss`, `styleProcessor` | Unit | n/a | Preserved |
| CSS source maps | — | `StyleProcessor.getSourceMap` | `cssSourceMap` | Unit | n/a | Preserved |
| Style mounting / CSP nonce | `api-reference` | `StyleMountManager` | `styleMountManager` | Unit | n/a | Preserved |

## 4. State sharing, routing

| Feature | Public API | Current implementation | Tests | Production status | Migration plan |
|---|---|---|---|---|---|
| Bridges (`bridge()`, state, getters, actions, `emit`/`on`, `$dispose`) | README; `core-concepts/bridges.md` | `runtime/bridge.js`, `BridgeParser` | `bridge`, `bridgeCompiler`, `bridgeComponent`, E2E `routing` | E2E | Preserved |
| Bridge build-time validation (unused bridges dropped, mistyped members) | README | `validateBridgeUsage` | `bridgeCompiler` | Unit | Preserved |
| Router (`initRouter`, hash routes, params, query, wildcard, redirects, meta, title, scroll restoration, a11y, programmatic history) | README; `routing.md` | `AvenxRouter`, `RouteMatcher`, navigation delegates, `A11yManager` | `router*`, integration `router*`, E2E `routing/navigation` | E2E | Preserved |
| Route guards (`AvenxGuard`, `GuardContext`, control objects) | `routing.md` | `AvenxGuard.js`, `processGuards` | `guardContext`, `router_global_guards`, system `guardBridges`, E2E `guards`, `guard-gaps` | E2E | Preserved |
| SSR-style memory navigation | — | `MemoryNavigationDelegate` | `ssrRouter` | Unit | Preserved |

## 5. Tooling features

| Feature | Public API | Current implementation | Tests | Production status | Migration plan |
|---|---|---|---|---|---|
| Atlas (`avenx atlas`, `impact`, `why`, `bundle.atlas.json`, W40/W41) | README; `core-concepts/atlas.md` | `lib/compiler/atlas`, `bin/commands/atlas.js` | `atlas*`, system `atlasCli` | System | Preserved; must not report false positives from front-end corruption (B1) |
| Trace (`serve --trace`, `trace list/view/export/prune`, redaction, replay) | README; `core-concepts/trace.md` | `lib/core/trace`, `bin/commands/trace.js` | `trace*`, system `traceCli`, `traceExport`, `traceServe`, `traceBundleBoundary` | System (dev-only by design) | Preserved; export must escape generated source (S4) |
| Rewind diagnostics (W42–W44) | README | `lib/compiler/rewind` | `rewindDiagnostics` | Unit | Preserved |
| Diagnostics catalogue, `avenx explain` | `troubleshooting/errors.md` | `AvenxError.js`, `diagnostics/catalogue.js`, `bin/commands/explain.js` | `diagnosticCatalogue*`, `contractErrorCodes` | Unit | New codes added through the documented workflow in CONTRIBUTING.md |
| Warning configuration (`warnings: { AVX_Wxx: off/error }`) | `troubleshooting` | `warningReporter.js` | `warningSettings` | Unit | Preserved |
| Logger | `api-reference/utils.md` | `AvenxLogger.js` | `logger` | Unit | Preserved |
| Profiler | `api-reference/utils.md` | `utils/profiler.js` | `performanceProfiling` | Unit | Preserved |
| Reactivity debugging | `reactivity.md` | `setDebugReactivity` | `debugReactivity` | Unit | Preserved |
| Testing helpers `avenx-core/testing` (`mountTestComponent`, snapshots, mocks) | `guides` | `lib/core/testing.js`, `AvenxMock.js` | `mock*`, `snapshot`, `mountTestComponentQueryHelpers` | Unit | Preserved |
| ESLint tooling `avenx-core/tooling` | — | `lib/core/tooling` | `eslintComponentTagNaming`, `avenxComponentTagNaming` | Unit | Preserved |
| Inspector (`initInspector`, `/__avenx-inspect`, `avenx inspect`) | `cli-reference` | `tooling/inspect.js`, `serve.js`, `bin/commands/inspect.js` | `componentInspect`, `inspectCommand` | Unit | Preserved; escape rendered state (S5, issue #1264) |
| Vite plugin | `plugins/avenx-vite` | `plugins/avenx-vite/src` | `vitePluginScopedCss`, `vitePluginSourceMap` | Unit | Preserved |
| Official plugins (i18n, persistence, charts) | plugin READMEs | `plugins/*` | `npm run test:plugins` | Unit | Preserved |

## 6. CLI and build

| Feature | Public API | Current implementation | Tests | Production status | Migration plan |
|---|---|---|---|---|---|
| `init` (layouts, styles, VS Code config) | README; `cli-reference` | `bin/commands/init.js`, `templates/` | system `cli` | System | Preserved; silence git noise outside a repository |
| `generate` / `destroy` (component, page, bridge, guard; `--dry-run`) | README | `generate.js`, `destroy.js` | system `cli` | System | Preserved |
| `build` (production default, `--dev`), `clean`, `watch` | README | `compiler.js`, `build.js` | system `productionBuild`, `buildExitCode`, `bundleIntegrity` | System | Preserved; production refuses what it cannot run (B2) |
| `check` / `lint` (`--json`) | README | `build.js` | `cliCheckJson`, `cliCheckWatch` | Unit | Preserved |
| `doctor`, `env`, `stats`, `inspect`, `help` | README | `bin/commands/*` | `statsCommand`, `cliEnvCommand`, `inspectCommand` | Unit | Preserved |
| Dev server (`serve`, port/host, custom headers, SPA fallback) | README | `serve.js` | `serve`, `servePathTraversal`, E2E `serve/dev-server` (failing on `main`) | E2E (red) | Fix CI (B4); preserved |
| Live reload | README | `serve.js` SSE `/__avenx_live_reload__` | E2E `serve/dev-server` | E2E (red) | Preserved |
| Atomic build output (staging + promote) | — | `writeStaging`, `promoteStaging` | `buildExitCode` | System | Preserved |
| Output validation (parse check, capability postcondition) | — | `compiler/bundle/validate.js` | `runtimeCapabilityValidation` | Unit | Extend with front-end post-conditions |
| Bundler (ESM + CJS npm packages, module identity, tree-shaking, source maps) | README §Production builds | `lib/bundler` | `bundler*`, system `moduleResolution` | System | Preserved; replacement is a decision requiring approval |
| Fallback rendering (string renderer linked on demand, `AVX_W47`) | README | `stringRenderer.js`, `installStringRenderer.js` | system `fallbackRendererBundle`, integration `renderer_selection`, E2E `fallback-renderer` | E2E-prod | **Must remain until every refused construct has an IR implementation with parity tests** |
| Development interpreter (`AVX_W48`) | README | `expression/interpreter.js` | `evaluator*`, system `expressionCoverage` | Dev only | Preserved for development; production refuses instead of shipping broken output |
| Bundle size warning (`AVX_W01`, `bundleSizeWarningKb`) | README | `compiler.js` | `productionRuntimeShape` | System | Preserved |

---

## Legacy-renderer dependency summary

Constructs that today exist **only** on the string renderer:
suspense, error boundaries, deadlock boundaries, transitions, refs, dynamic
components, declarative validation, VirtualList, template-level resources,
router views, dynamic attribute names, scoped-slot props.

Removal of the string renderer is blocked until each of these has:

1. an IR node and lowering case,
2. a runtime implementation on the program renderer,
3. parity tests (dev and production) covering the construct alone and nested
   inside `<@for>`, `<@if>` and slots.
