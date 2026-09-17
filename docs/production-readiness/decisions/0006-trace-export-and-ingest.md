# ADR 0006 — Trace export cannot inject code; trace ingest is same-origin only

- Status: accepted
- Branch: `fix/trace-export-injection`
- Evidence: `../initial-assessment.md` S4, `../security-inventory.md` (recorded separately)

## Context

`avenx trace export` turns a recording into a JavaScript test file. Recorded
fields were interpolated into comments verbatim:

```js
` * Recorded ${trace.createdAt}${trace.meta.url ? ` at ${trace.meta.url}` : ''}.`
`      // ${dom.target.selector} showed ${formatCaptured(dom.from)} before this step.`
```

A `createdAt` of `x */ globalThis.INJECTED = 1; /* y`, or a selector containing
a newline, escaped the comment and became executable source. `validateTrace`
checks only `traceVersion` and a `nodes` array, so nothing stopped it.

A trace is not necessarily trustworthy. With `avenx serve --trace` running, the
ingest endpoint `POST /__avenx/trace` accepted a body from **any** origin: a
page the developer visited could plant a trace, which `avenx trace export` would
then turn into source, and `npm test` would run.

## Decision

1. **Comment context is neutralised.** A `comment()` helper replaces every
   JavaScript line terminator — including U+2028 and U+2029, which end a line in
   source — and breaks up `*/` and `/*` so neither can open or close a comment.
   It is applied to every recorded field that reaches a comment: trace id,
   `createdAt`, `meta.url`, determinism reasons, redaction paths, event types,
   selectors, captured values, navigation targets and the final-state line.
   Values are also length-capped.
2. **Identifiers are validated, not escaped.** `componentName` and bridge names
   are written as bindings, so anything that is not a valid identifier falls back
   to `Component` / `bridge` rather than being interpolated.
3. **Ingest is same-origin only.** `isSameOriginRequest` compares the `Origin`
   header against the request `Host`. A missing `Origin` is accepted (not a
   cross-site browser request); a mismatched one, a malformed one, and the
   opaque `null` origin (a sandboxed iframe or `data:` URL) are refused with 403
   and a console warning.

## Compatibility

- No feature changes. A well-formed trace still exports a usable test; the real
  selector, timestamp and assertions are unchanged.
- Recorded text that contained a comment terminator now appears with it broken
  up, inside the comment. It was never meant to be source.
- Recording from the app's own page is unaffected: it is same-origin.

## Evidence

- `test/unit/traceExportInjection.test.js` — payloads in `id`, `createdAt`,
  `meta.url`, determinism reasons, redactions, selectors, navigation targets and
  a U+2028 separator. The generated file is **parsed with acorn** and the AST
  asserted to contain no injected identifier, which is the property that matters
  (the text may remain, inertly, in a comment). A well-formed trace still
  produces the expected assertions. Fails on the base: "a payload became
  executable source".
- `test/unit/traceIngestOrigin.test.js` — same-origin, header-less, differing
  port, suffix-matching host, malformed and opaque origins.

## Known limitation

The origin check is a dev-server hardening measure, not authentication. A
non-browser client can send any `Origin` it likes. The endpoint exists only
under `avenx serve --trace`, binds to the configured host, and never runs in
production.
