# Changelog

All notable changes to Avenx-JS are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Avenx is pre-1.0, so under SemVer a minor release may change public behaviour;
every such change is listed below with its migration.

(This paragraph used to point at `docs/production-readiness/release-readiness.md`
for the project's SemVer policy. That file was removed in 02bc44b along with the
rest of that directory, and nothing replaced it, so the reference was dead.)

## [Unreleased]

Production-readiness cycle. No public API was removed and no documented feature
was dropped. Behaviour changes are listed with their migration.

### Fixed — the scaffolded first run

The path a new user takes — `avenx init`, `avenx generate page`, `avenx build`,
open the page — produced a blank screen, a successful build and a silent
console. Four separate defects met there, each individually invisible.

- A route pattern was compiled exactly as written while the URL hash was
  normalised to `#/path`, so only a pattern spelled `#/…` could ever match.
  `''`, `'/'` and `'/about'` matched nothing, silently. The scaffolded routing
  template declared the root twice (`'': 'Home'` beside `'#/': 'Home'`), and
  every fixture copied the habit, which is why a green suite never noticed. All
  four spellings now resolve to the same route, as the compiler's own model
  already assumed.
- A bare `#`, which any `<a href="#">` leaves in the URL, matched no pattern and
  fell through to the wildcard. It now resolves to the root.
- `AVX_W53` reports an application whose pages no route names and no
  `mountPage()` call mounts. `avenx generate page` now prints the route line to
  add instead of saying the page "will be automatically registered and routed if
  you update src/main.app.js", which said both that nothing was required and
  that something was.
- The page scaffold shipped `.page-container { … }` with `class="page-container"`.
  An Avenx style block is a name attached with `@css`, not a CSS selector, so
  every generated page carried a stylesheet that emitted nothing. The component
  scaffold beside it had always been correct.

### Fixed — diagnostics that were wrong rather than missing

- `<@if>` and `<@elseif>` conditions were never walked, so a typo in a condition
  compiled clean (`AVX_W03` fires for an interpolation but did not for a
  condition), and state read only by a condition was reported by `AVX_W40` as
  "read nowhere in the application".
- Attributes were located with a regular expression that ends a tag at the first
  `>`. In `<div title="a > b" @click="go()">` the handler was invisible, so
  `AVX_W41` claimed the action it calls is never invoked. The shared template
  walk now reads the markup lexer, as the other front-end passes already did.
- `AVX_W51` and `AVX_W52` were reported in `avenx check --json` against a file
  called `config.js` — a path that exists in no project — because the recovery
  matched `config.js` inside the `avenx.config.json` named in their own remedy
  text. Both now name their template, and no diagnostic is attributed to a file
  the search invented.
- `AVX_W01` weighed source maps against the bundle budget, so every development
  build warned about `bundle.js.map` by default and a project escalating
  `AVX_W01` to `"error"` could not run one at all.

### Fixed — silent failures elsewhere

- A tag whose earlier attribute contains `>` no longer hides what follows it:
  `<slot :label="a > b ? x : y">` now reaches the slot, a scoped slot with such
  an attribute is still recognised as one, and `:[name]="val"` still resolves on
  `<div title="a > b" :[name]="val">`. The last was data-dependent — the `>`
  could come from any rendered value — so a template that worked in development
  broke on the first record containing a greater-than sign.
- `initRouter` replaced the router without destroying the old one, leaking a
  navigation listener per call and leaving every abandoned router handling hash
  changes into the same target.
- The working-tree guard read the process's directory rather than the project,
  leaked git's `fatal: not a git repository` to the terminal, and exited 0 when
  declined — so a declined `avenx build` reported success having built nothing.
- An unrecognised command printed the help text and exited 0, so `avenx buidl &&
  deploy` deployed.

### Added

- `AVX_W53` (no reachable page), `AVX_W54` (unterminated interpolation, which
  was rendered to the page as literal text), and `AVX_W55` (a style block no
  template names), each with a catalogue entry.
- `avenx check`'s exit codes are documented: it fails on a warning, which
  `avenx build` does not.
- The Quick Start tutorial's stylesheet used CSS selectors and class attributes
  throughout, which produces no styles at all. It is corrected, and the
  documentation's stylesheet samples were swept for the same mistake.

### Behaviour changes and migration

| Change | Migration |
|---|---|
| `''`, `'/'` and `'/about'` route patterns now match | None. They previously matched nothing; a table declaring the root twice still works |
| An unrecognised command exits 1 | Fix the typo; the message names the closest command |
| Declining the working-tree prompt exits 1 | Pass `--force`, or commit first |
| `AVX_W53`/`AVX_W54`/`AVX_W55` may appear on an existing project | Each is a warning and silenceable with `"warnings": { "AVX_W55": "off" }` |
| `AVX_W01` no longer counts source maps | None, unless a build relied on failing there |

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
