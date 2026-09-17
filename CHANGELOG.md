# Changelog

All notable changes to Avenx-JS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The SemVer policy for this project is written down in
`docs/production-readiness/release-readiness.md`.

## [Unreleased]

Production-readiness cycle. No public API was removed and no documented feature
was dropped. Behaviour changes are listed with their migration.

### Fixed — compiler correctness

- The template front-end no longer reads expression or attribute content as
  markup. `@css`, `data-ax-bind` and comment stripping were applied with regular
  expressions that ended a tag at the first `>`; a handler such as
  `@click="count > 3 ? a() : b()"` silently produced a component that rendered
  blank in production. All front-end passes now share one markup lexer.
- An unclosed `<action>` or `<resource>` reports `AVX_C26` with a location
  instead of crashing the build with a bare `TypeError`.
- `new Date(0)`, tagged templates, shorthand properties (`{ count }`) and
  destructuring assignment targets are rewritten correctly in action bodies;
  each was silently miscompiled.
- `<@for item="user" in="users">` and `<@loading>` inside `<@defer>` compile to
  render programs instead of falling back to the string renderer.

### Fixed — build reliability

- A production build now fails with `AVX_C27` when it contains an expression it
  cannot execute, instead of succeeding and throwing in the browser.
  Development still builds, reporting `AVX_W48`.
- `<state>` initialisers written as JavaScript object or array literals
  (`{ id: 1, name: 'Ada' }`) are evaluated at build time instead of silently
  becoming strings. A non-constant initialiser keeps its string value and
  reports `AVX_W51`.

### Fixed — restored functionality

- `<action>` and `<resource>` bodies can use browser APIs again (`fetch`,
  `window`, `setInterval`, `requestAnimationFrame`, …), as the documentation has
  always described. They had been refused at build time since 2026-09-10, which
  broke the README's own `<resource>` example.
- `AVX_W26` no longer warns when a documented lifecycle hook (`onMount`,
  `onUnmount`, …) is declared as an `<action>`, which is the supported way to
  define one. Genuine collisions with reserved instance methods still warn.

### Fixed — dev server

- `avenx serve` now answers on both loopback families. Binding the name
  `localhost` resolved to one family, so everything reaching for `127.0.0.1`
  (curl, proxies, containers, CI) was refused while the browser worked.
- The inspector at `/__avenx-inspect` receives data. Its enabling flag was
  injected after the application bundle, so it was always too late.

### Fixed — reactivity and scheduling

- A reactive cycle quarantines the looping job instead of clearing the queue.
  Previously every unrelated component's pending update in that tick was
  silently discarded.
- Dependency tracking is O(1) per read rather than a linear scan, and the
  causation path is built only when read: a watcher with 400 tracked reads
  re-evaluated 200 times went from 54.6 ms to 25.1 ms, and 100,000 untracked
  nested writes from 73.2 ms to 38.0 ms.

### Security

- A bound `srcdoc` is escaped as HTML rather than treated as a URL; markup with
  no scheme used to execute in a same-origin iframe. Trusted HTML is opted in
  with `html(...)`, as for `data-ax-html`.
- A bound inline event handler (`onclick="{{ x }}"`) is refused at build time
  (`AVX_C28`) with the `@click` rewrite; a static inline handler warns
  (`AVX_W52`); the runtime refuses any `on*` attribute reaching it (`AVX_R35`).
  `@event` bindings and `on*` props on components are unaffected.
- `avenx trace export` can no longer be made to emit executable code by a
  recorded value, and the dev server refuses cross-origin trace uploads.

### Added

- Diagnostics `AVX_C24`–`AVX_C28`, `AVX_W49`–`AVX_W52`, `AVX_R35`, each with a
  catalogue entry and an entry in the error reference.
- `test/system/packageIntegrity.test.js`, which asserts that the published
  tarball can actually run.

### Behaviour changes and migration

| Change | Migration |
|---|---|
| A bound `on*` attribute fails the build | Use `@click="handler"`; the message gives the rewrite |
| A plain string bound to `srcdoc` is escaped | Wrap trusted HTML in `html(...)` |
| A JavaScript literal in `<state>` becomes an object/array | To keep a string, quote it (`label="'{ draft }'"`) or set it in `onMount` |
| A production build fails on an expression it cannot execute | Rewrite it, or move the logic into an `<action>`; `--dev` still builds |
| Malformed templates now fail with `AVX_C24`/`AVX_C26` | The diagnostic names the file and line |
