---
title: Contributor Architecture Guide
description: Technical architecture, compilation pipeline, runtime module map and test tiers for Avenx-JS contributors.
---

This guide provides a structural breakdown of the Avenx-JS codebase to help contributors understand how compilation, runtime reactivity, and testing are organized across the repository.

---

## 1. Repository Directory Map

| Directory | Purpose | When You Would Touch It |
| :--- | :--- | :--- |
| `lib/compiler/` | Template parsing, AST transformation, style scoping, and bundle packaging. | Adding template syntax, changing bundling, or optimizing CSS hashing. |
| `lib/core/` | Zero-dependency client runtime (`reactive`, `renderer`, `runtime`, `events`, `security`, `diagnostics`). | Modifying reactivity proxies, DOM patcher, component lifecycle, or error codes. |
| `bin/` | CLI command entry points and dispatch logic (`avenx generate`, `build`, `doctor`, etc.). | Adding or modifying CLI flags, subcommands, or scaffolding behavior. |
| `plugins/` | Build tool integration plugins (e.g., Vite plugin). | Fixing development server hooks or HMR behaviors in third-party bundlers. |
| `templates/` | Default code templates used by `avenx generate` for components, pages, guards, and bridges. | Updating boilerplate generator code or testing templates. |
| `test/` | Automated test suites across all 4 tiers (unit, integration, system, e2e). | Writing regression tests for bug fixes or test coverage for new features. |
| `benches/` | Micro-benchmarks for compilation throughput and runtime rendering speed. | Profiling performance bottlenecks in parser or patch algorithms. |
| `docs/` | Documentation website built with Starlight/Astro. | Adding user guides, API reference, or troubleshooting entries. |

---

## 2. Compile Pipeline Walkthrough

When `avenx build` executes, `lib/compiler.js` orchestrates the source-to-bundle process:

* **Source Discovery**: Reads component files and companion stylesheets (`.component.js`, `.component.css`).
* **ComponentParser**: Extracts `<state>`, `<action>`, `<style>`, and template markup into an intermediate representation.
* **StyleProcessor**: Parses companion CSS files, generates deterministic scope IDs, and hashes class names for CSS isolation.
* **ContractValidator**: Performs static analysis against declared state variables, action definitions, and template expressions against `AvenxErrorCodes`.
* **AvenxCompiler / Bundler**: Resolves component dependencies, tree-shakes unreferenced elements, and packages compiled classes and the minimal client runtime into a single IIFE bundle inside `dist/bundle.js`.

---

## 3. Runtime Data Flow

Runtime state updates follow a predictable microtask-batched lifecycle from state mutation to DOM patch:

1. **State Mutation**: Property set occurs (e.g., `state.count++`).
2. **ProxyHandlerFactory / StateFactory**: JavaScript Proxy traps the mutation.
3. **AvenxComponent.scheduleUpdate()**: Flags dirty state on the component instance.
4. **scheduler.js**: Deduplicates updates occurring in the same tick and batches component re-renders into a single microtask queue.
5. **TemplateRenderer**: Re-evaluates dynamic reactive bindings using `DynamicEvaluator` / `AvenxSandbox`.
6. **DomPatcher**: Computes diffs and applies atomic updates directly to target DOM nodes via `ListManager` and `DeferManager`.

---

## 4. "Where Do I Add X?" Decision Table

| I Want To Add... | Primary Target Files / Directories |
| :--- | :--- |
| **New template directive / tag** | `lib/compiler/parser/ComponentParser.js` and `lib/core/renderer/` |
| **New component instance method / API** | `lib/core/runtime/AvenxComponent.js` and `lib/core/index.d.ts` |
| **New CLI command or option flag** | `bin/commands/<command>.js`, `bin/cli.js`, and `bin/commands/help.js` |
| **New diagnostic error / warning code** | `lib/core/runtime/AvenxError.js`, `lib/core/diagnostics/catalogue.js`, and `docs/src/content/docs/troubleshooting/` |
| **New template generator boilerplate** | `templates/` and `bin/commands/generate.js` |

---

## 5. Test Tiers & Local Development Workflow

### Test Suite Structure

Avenx-JS uses a 4-tier testing strategy:

* **Unit (`test/unit/`)**: Tests individual parser, reactivity, and runtime functions. Executes in Node.js using `happy-dom` via the test runner hook (`node test/run-tests.js unit`).
* **Integration (`test/integration/`)**: Tests interactions between compiler output and runtime mount cycles (`node test/run-tests.js integration`).
* **System (`test/system/`)**: Tests CLI commands (`init`, `build`, `generate`, `doctor`) end-to-end (`node test/run-tests.js system`).
* **E2E (`test/e2e/`)**: Browser-level end-to-end tests powered by Playwright (`npm run test:e2e`).

### Standard Development Commands

* `npm test` — Run all unit, integration, and system tests.
* `npm run test:coverage` — Generate code coverage reports.
* `npm run bench` — Run compiler and runtime benchmark suites.
* `node scripts/size-check.js` — Verify bundle footprint constraints.
* `npm run check` — Run linter and formatting checks.

---

## 6. House Rules for Contributors

1. **Zero Runtime Dependencies**: Code inside `lib/core/` must remain pure JavaScript without adding external npm dependencies.
2. **Stable Diagnostic Codes**: Errors must be registered through `AvenxErrorCodes` / `AvenxError` rather than throwing untracked raw errors.
3. **Strict JSDoc**: Public APIs must be fully annotated with JSDoc to satisfy `eslint-plugin-jsdoc`.
