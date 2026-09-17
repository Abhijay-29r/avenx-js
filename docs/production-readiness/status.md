# Production Readiness — Status

Internal engineering document. Companion to `initial-assessment.md`, which
recorded the baseline. This records what changed, what did not, and why.

Branch: `production-readiness`. Nothing has been published or tagged.

## Verification at the time of writing

| Check | Result |
|---|---|
| `node test/run-tests.js` | **239 files, 239 passed, 0 failed** |
| `npx playwright test` (Chromium) | **152 passed, 0 failed** |
| `npm run lint` | **0 errors**, 11 pre-existing warnings |
| `avenx build` (scaffolded hello-world) | succeeds, 322.45 KB raw / 73.94 KB gzipped |
| `avenx build --dev` | succeeds, 777.33 KB raw / 200.30 KB gzipped |

At the start of this work the E2E suite had 8 permanently failing tests and
`npm run lint` reported 2 errors.

## Blockers from the initial assessment

| # | Blocker | Status |
|---|---|---|
| B1 | Silent miscompile from the regex front-end | **Fixed** — one markup lexer; malformed templates fail with `AVX_C24`/`AVX_C25`/`AVX_C26` |
| B2 | Production build succeeded with expressions it cannot execute | **Fixed** — `AVX_C27`; development keeps `AVX_W48` |
| B3 | npm package does not ship this framework | **Not fixable in-repo** — needs a release; guarded by `packageIntegrity.test.js`, documented in `release-readiness.md` |
| B4 | `main` CI red | **Fixed** — 8 dev-server tests pass; two real product bugs found behind them; size check no longer fails on forks |
| B5 | XSS sinks in compiled bindings | **Fixed** — `srcdoc` (ADR 0003), `on*` (ADR 0004) |
| B6 | `<state>` values silently changing type | **Fixed** — constant literals evaluated; `AVX_W51` for the rest |

## Fixed, by area

### Compiler correctness
- Shared markup lexer for every front-end pass (ADR 0001). Reproduced
  miscompiles: `>` in a handler beside `@css` (both orders), `"` inside a
  single-quoted handler, comment-like attribute text, `<` inside an
  interpolation, `data-ax-bind` beside `>`.
- `<@css />` placement now matches the documentation.
- Unclosed `<action>`/`<resource>`: `AVX_C26` instead of a bare `TypeError`.
- Action-body codegen: `new Date(0)`, tagged templates, shorthand properties and
  destructuring assignment targets were each silently miscompiled (ADR 0002).
- `<@for item="…" in="…">` and `<@loading>` now compile to render programs
  instead of forcing the fallback renderer (ADR 0010).

### Restored functionality
- Browser globals in `<action>`/`<resource>` bodies (ADR 0002) — the README's
  own `<resource>` example did not build.
- `AVX_W26` no longer warns on documented lifecycle hooks (ADR 0005).

### Security
- `srcdoc` treated as HTML, not a URL (ADR 0003).
- Bound `on*` refused (`AVX_C28`), static warned (`AVX_W52`), runtime guard
  (`AVX_R35`) (ADR 0004).
- `avenx trace export` cannot be made to emit executable code; trace ingest is
  same-origin only (ADR 0006).
- The dev-server inspector escapes application data.

### Dev server and CI
- Binds both loopback families; the inspector actually receives data (ADR 0007).
- Bundle Size Monitor no longer fails on fork pull requests.

### Runtime
- A reactive cycle quarantines the looping job instead of discarding every
  unrelated pending update (ADR 0008).
- Dependency tracking O(1) per read; causation path built lazily (ADR 0009).

## Measured

| Benchmark | Before | After |
|---|---:|---:|
| Watcher, 400 tracked reads × 200 evaluations | 54.6 ms | **25.1 ms** |
| 100,000 untracked nested writes | 73.2 ms | **38.0 ms** |
| 1,000 nested writes, 200 sibling watchers | 136.5 ms | 126 ms |
| Hello-world production bundle | 317.6 KB / 72.5 KB gz | 322.45 KB / 73.94 KB gz |

The bundle grew ~5 KB raw: the shared markup lexer and the event-handler set are
now linked (the lexer is reachable from the runtime's `processBindDirectives`).
That is the cost of the correctness and security fixes, and it was not traded
away by removing features.

## Known limitations (unchanged and accepted)

1. **The string renderer is still required** for `<@suspense>`,
   `<@errorBoundary>`, `<@deadlock>`, transitions, refs, dynamic components,
   declarative validation, `<VirtualList>`, template `<resource>` and router
   views. Those components render correctly and report `AVX_W47`. Removing the
   fallback renderer requires IR parity for each, which is not done.
2. **Bundle size.** ~74 KB gzipped for a hello-world. Composition in
   `initial-assessment.md` §8: `AvenxComponent` (55 KB raw) dominates because it
   imports every feature unconditionally. Feature-gating it is worthwhile but is
   a large refactor of the component class, not a size tweak. 5.3 KB of
   compiler-only diagnostic templates could be split out of the runtime; judged
   too small a win for the risk of touching the shared error registry.
3. **Ancestor propagation in reactivity** wakes watchers of a parent key on a
   nested write. Intentional, documented and tested; cost measured in ADR 0009;
   changing it is a major-version concern.
4. **Legacy regex passes remain** for `<@suspense>`, `<@errorBoundary>`,
   `<@deadlock>`, `<@defer>`, component tags and scoped slots. They were probed
   with nested and `>`-bearing input and handled it correctly, so they are not
   currently a source of miscompiles; they are still the reason two template
   readers exist.
5. **The `:[expr]` dynamic attribute name** does not resolve a state-provided
   value through the component runtime. Pre-existing; unrelated to the security
   guard added around it.
6. **npm drift** (B3) can only be closed by a release.

## Not done, and why

- **Removing the fallback renderer** — forbidden without demonstrated parity,
  and parity is not demonstrated.
- **Feature-gating `AvenxComponent`** — the single biggest bundle win, but it
  restructures the class every component inherits from; too large to do safely
  in this cycle without a dedicated parity suite.
- **A release** — out of scope by instruction. The checklist is in
  `release-readiness.md`.
