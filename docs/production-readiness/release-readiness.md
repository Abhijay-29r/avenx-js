# Release Readiness Checklist

Internal engineering document. Nothing here authorises a publish; it is the
list of things that must be true before one.

## The drift this exists to prevent

| | npm | repository |
|---|---|---|
| Version | `0.4.3` | `0.4.3` |
| Published | 2026-06-18 | — |
| Commits since | — | ~2,300 |
| Contents | 34 files, 92 KB unpacked | 147 `lib/` files |

`avenx-core@0.4.3` predates the IR, render programs, the bundler, Atlas, Trace
and Rewind. Everything the README describes is absent from the package a user
installs, and `avenx init` scaffolds `"avenx-core": "^0.4.3"`, so a new project
gets that package. This is the single largest gap between the project and its
documentation, and it cannot be closed by any change inside the repository — it
needs a release.

## Before any release

### Automated (run these)

- [ ] `npm test` — full Node suite, 0 failures.
- [ ] `npm run test:plugins` — the three official plugin suites.
- [ ] `npx playwright test` — full E2E suite, 0 failures.
- [ ] `npm run lint` — 0 errors.
- [ ] `node test/run-tests.js test/system/packageIntegrity.test.js` — the
      tarball contains every declared entry point, the runtime, compiler,
      bundler, CLI and templates, ships no tests/docs/benches, and `avenx init`
      derives its dependency from `package.json`.
- [ ] `node benches/run.js` — no benchmark crashes.

### Manual

- [ ] **Decide the version.** The public API has not broken, but behaviour has
      changed in ways users can observe (see *Behaviour changes* in
      `../production-readiness/` decision records 0001–0010). A `0.5.0` minor is
      the honest floor; `1.0.0` should not be chosen until the items under
      *Known limitations* below are accepted.
- [ ] **Write the changelog entry** (see `CHANGELOG.md`), grouping: fixed
      miscompiles, security, dev server, scheduler, reactivity, diagnostics.
- [ ] **Tag the release.** The repository has no tags at all; `npm-publish.yml`
      triggers on a GitHub release, so a tag plus release is the trigger.
- [ ] **Check the README against the built package**: every feature the README
      claims must work from a project created with `npx avenx init` against the
      packed tarball, not against the repository.
- [ ] **Smoke-test the tarball**: `npm pack`, install it into an empty project,
      `avenx init`, `avenx build`, `avenx serve`, load the page.

### Diagnostics added in this cycle

New codes must appear in `AvenxErrorCodes`, `AvenxErrorMessages`, the
`DIAGNOSTIC_CATALOGUE` and `troubleshooting/errors.md`:

`AVX_C24`, `AVX_C25`, `AVX_C26`, `AVX_C27`, `AVX_C28`, `AVX_W49`, `AVX_W50`,
`AVX_W51`, `AVX_W52`, `AVX_R35`.

## SemVer policy

- **Patch** — a fix with no observable change for a correct program.
- **Minor** — new diagnostics, new accepted syntax, a build that now refuses
  output that was already broken at run time.
- **Major** — any change to reactivity semantics (for example the ancestor-
  propagation change proposed in ADR 0009), removal of the fallback renderer, or
  a change to the component authoring format.

## Known limitations to state in the release notes

1. The string renderer is still required for `<@suspense>`, `<@errorBoundary>`,
   `<@deadlock>`, transitions, refs, dynamic components, declarative validation,
   `<VirtualList>`, template `<resource>` and router views. Components using
   them render correctly on the fallback path and report `AVX_W47`.
2. A hello-world production bundle is ~322 KB raw / ~74 KB gzipped. See
   `../production-readiness/initial-assessment.md` §8 for the composition.
3. Ancestor propagation in reactivity wakes watchers of a parent key on a nested
   write. Intentional and tested; the cost is measured in ADR 0009.
4. `avenx serve --trace` writes files; its ingest endpoint is same-origin only
   but is not authenticated, and is development-only.
