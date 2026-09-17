# Branch Baseline

Internal engineering document.

## Policy

- `production-readiness` is based on `develop`.
- It does not merge `main`, or anything else outside `develop`, unless the
  difference has been analysed and recorded here first.
- All work reaches `production-readiness` through small working branches.

## How the branch was created

1. `develop` at `9bc1822` (identical to `origin/develop`).
2. `production-readiness` was created from it.
3. Working branch `chore/sync-main` fast-forwarded to `origin/main` at `06d55d3`
   and was merged (fast-forward) into `production-readiness`.

Step 3 was done **before** this analysis existed. It is recorded here after the
fact, as required.

At that point `develop` was an ancestor of `main`: `main` contained 37 commits
not in `develop`, and `develop` contained nothing not in `main`. The import was
therefore conflict-free, and no `develop` work was lost or reordered.

## Why `main` was ahead of `develop`

| PR | Head → base | Content | Checks at merge |
|---|---|---|---|
| #1300 | `develop` → `main` | Release of `develop` into `main` (already contained in `develop`) | `test (18/20/22)` failed, E2E passed |
| #1301 | `fix/fallback-renderer-blank-page` → `main` | Fallback renderer and unhandled-error fixes | `test (20/22)` failed, E2E passed |
| #1302 | `docs/fix-diagnostic-documentation-1258` → `main` | Diagnostic documentation | Bundle Size failed |
| #1303 | `aaditya755:main` → `main` | Dev-server E2E fixture and spec | `test (20/22)`, E2E and Bundle Size failed |
| #1304 | `docs/fix-diagnostic-documentation-1258` → `main` | Contributing guide | Bundle Size failed |

PRs #1301–#1304 targeted `main` directly and were never merged back into
`develop`. That is the entire difference.

Process finding: all five were merged with failing checks. This is tracked
under the CI work (blocker B4 in `initial-assessment.md`).

## The 37 imported commits

Merge commits are listed with the PR they belong to; they carry no content of
their own.

### Group A — PR #1301: fallback rendering and unhandled errors (27 commits)

| Commit | Kind | Change |
|---|---|---|
| `b503a7d` | test | E2E fixture app `fallback` for IR-refused constructs |
| `008013f` | test | E2E spec driving the fallback renderer in Chromium |
| `52a7d67` | test | Pins module identity across symlinked packages |
| `eb8aefd` | test | Pins that an unhandled component error is never silent |
| `35ab574` | test | System test for the fallback bundling contract |
| `cffe1ae` | **fix** | `lib/bundler/resolve.js`: one file, one module identity (canonicalises symlinked `avenx-core`, which previously split the renderer registry and produced a blank page) |
| `d2cf81f` | **fix** | `lib/compiler/bundle/validate.js`: the build fails (`AVX_C23`) when a linked runtime capability is missing from the output |
| `a9b734c` | **fix** | `AvenxApp`/`AvenxComponent`: an unhandled component error is reported (`AVX_R33`) instead of leaving a blank page |
| `a218e7b` | **fix** | Renderer unavailability gets its own diagnostic (`AVX_R34`) and catalogue entry |
| `c4bbc08` | test infra | `test/run-tests.js` can run a file in a process shaped like a production bundle |
| `7cc6636` | **fix** | An unhandled error is reported once, under its most specific code |
| `5697cf1` | test | Pins the bundle cost of needing the fallback renderer |
| `c350f24` | **fix** | Teardown no longer reaches for a renderer a compiled app does not carry |
| `1212d07` | style | Lint fixes in the new tests |
| `707aef2` | docs | Describes what a render fallback does |
| `c9f4d1b` | test | Symlink chain coverage |
| `f4f5793` | test | Integration test for renderer selection |
| `9421a7a` | test | Fails if a new construct joins the fallback path unnoticed |
| `fd07ec7` | docs | E2E README: only pages mount child components |
| `9bf0d66`, `bd16838`, `3c46eaf`, `cb07174`, `9c73a79`, `0d7acf5`, `0c90615`, `536c0fc`, `d5c6402` | merge | — |

### Group B — PR #1302 and #1304: documentation (5 commits)

| Commit | Change |
|---|---|
| `df7e2a8` | `troubleshooting/errors.md`: aligns documented compiler codes with the implementation |
| `82869b9` | `CONTRIBUTING.md`: the diagnostic-code workflow (registry → messages → catalogue → docs → tests) |
| `fe94f8a`, `06d55d3` | merge |

### Group C — direct formatting commits on `main` (2 commits)

| Commit | Change |
|---|---|
| `066a0e5` | `eslint.config.mjs` and `lib/core/testing/snapshot.js`: quote and formatting normalisation, JSDoc |
| `bed6ae5` | JSDoc nullable-type syntax in `ir/nodes.js`, `TemplateInstance.js`, `blocks.js` (comments only) |

### Group D — PR #1303: dev-server E2E (3 commits)

| Commit | Change |
|---|---|
| `165231b` | `test/e2e/support/dev-server.js` |
| `aa2283d` | `test/e2e/specs/serve/dev-server.spec.js` |
| `b12594b` | merge |

## Were they required?

Assessed honestly, per group:

| Group | Required? | Reason |
|---|---|---|
| A — #1301 | **Yes, for the production-readiness baseline.** | The initial assessment and every reproduction in it were made against `main`. These are production-correctness fixes for failures the assessment would otherwise have to re-report: a blank page on an unhandled render error, a split renderer registry under symlinked installs, and a build that succeeded without a capability it linked. Leaving them out would mean re-fixing them on `production-readiness` and diverging from `main` on the same lines. |
| B — #1302, #1304 | **Partly.** | `82869b9` defines the diagnostic-code workflow that `fix/compiler-front-end` followed. `df7e2a8` edits the same error reference that branch extends. Neither is required for runtime behaviour. |
| C — formatting | **No.** | Carried along by the fast-forward. Formatting and comments only; no behaviour change. |
| D — #1303 | **No.** | Carried along by the fast-forward. It adds a failing spec (8 tests fail locally and in CI) and two lint errors in `test/e2e/support/dev-server.js`. It does add coverage the project lacked, and fixing it is part of the CI work, but it was not a prerequisite. |

### Dependency of later work on the import

Replaying `fix/compiler-front-end`'s commits directly onto `develop` was tested
in a temporary worktree:

- The code changes (`markupLexer.js`, `htmlTree.js`, `templateUtils.js`,
  `StyleProcessor.js`, `ComponentParser.js`, tests) apply without conflict.
- `lib/core/diagnostics/catalogue.js` and
  `docs/src/content/docs/troubleshooting/errors.md` conflict, because Groups A
  and B edited the same registries.

So the front-end fix does not depend on the imported behaviour, only on the
imported text of the diagnostic registries.

## Options if the import should be narrowed

Recorded for a decision; not acted on.

1. **Keep as is (current).** `production-readiness` = `develop` + the 37
   commits + working branches. Groups C and D are harmless or tracked for
   fixing.
2. **Rebuild on `develop` with Group A only.** Recreate `production-readiness`
   from `develop`, merge PR #1301's head, then replay the working branches,
   resolving the two registry conflicts. This rewrites a local branch that has
   not been pushed.
3. **Ask for `main` to be merged into `develop` upstream.** The difference
   disappears at the source, and `production-readiness` is again a strict
   descendant of `develop` with no extra imports.

## Going forward

- No further merges from `main` into `production-readiness`.
- Each working branch starts from the current `production-readiness`.
- If `develop` advances, it is merged into `production-readiness` in a
  dedicated branch, and the difference is recorded here.
