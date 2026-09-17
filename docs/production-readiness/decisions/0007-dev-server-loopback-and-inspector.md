# ADR 0007 — Dev server binds both loopback families; the inspector receives data

- Status: accepted
- Branch: `fix/dev-server-e2e`
- Addresses: blocker B4 in `../initial-assessment.md`

## Context

Eight `test/e2e/specs/serve/dev-server.spec.js` tests failed with
`ERR_CONNECTION_REFUSED`, on `main` and locally, since PR #1303 was merged with
failing checks. The spec was treated as flaky test infrastructure. It was not:
it had found two real defects in `avenx serve`.

### 1. The dev server was reachable at only one loopback address

`server.listen(port, 'localhost')` resolves a **name**, and Node binds the first
family the resolver returns. On a machine that answers `::1` first:

```
🚀 Dev-Server running at http://localhost:4321
IPv4 (127.0.0.1): refused
IPv6 ([::1]):     200
```

A browser recovers, because it tries both. Everything that reaches for
`127.0.0.1` — `curl`, a proxy, a container, a script, the E2E harness — does
not. The announced URL claimed a server that half the tooling could not reach.

### 2. The inspector never received any data

The dev server injects `window.__avenx_inspect_enabled = true` and the
live-reload client immediately before `</body>` — that is, **after** the
application bundle's `<script>`. `new AvenxApp()` calls `initInspector`, which
returns immediately when the flag is not set, so the `BroadcastChannel` the
`/__avenx-inspect` page polls was never opened. The inspector rendered its empty
state forever.

## Decision

1. **`bindAddressFor(host)`** — the default `localhost` binds `127.0.0.1`
   explicitly. An explicitly configured host is bound exactly as asked, so
   `--host 0.0.0.0` and a specific interface are unchanged.
2. **`listenLoopbackAlias(handler, host, port)`** — for `localhost` only, a
   second listener shares the same request handler on `[::1]` at the same port.
   Failure is ignored: a machine without IPv6, or one where something already
   holds that address, keeps the IPv4 listener. Both families now answer, and
   the server is still not exposed beyond loopback.
3. **The inspector flag moves to `<head>`**, before the bundle. Everything that
   only reacts to later events (the live-reload `EventSource`, the trace
   recorder) stays at the end of the body.

## Test-side defects fixed alongside

Both were genuine faults in the merged spec, not weakened assertions:

- `startServer()` returned no `url`, so the `server.headers` test built
  `undefined/index.html`. It now reports the URL it started, and the fixture
  reuses it.
- The `components` fixture mounts **two** `StatCard`s, so `getByTestId('card')`
  matched twice and Playwright's strict mode failed. The assertions are scoped
  to the `filled` card, which is the one the test edits.
- Two lint errors introduced with the spec (`fsSync` unused, an empty fixture
  pattern) are fixed, so `npm run lint` reports no errors.

## Evidence

- `test/e2e/specs/serve/dev-server.spec.js` — 8/8 pass; previously 0/8.
- `test/unit/serve.test.js` — port fallback now asserts the `127.0.0.1` bind,
  plus direct coverage of `bindAddressFor`.
- Manual: with the fix, `127.0.0.1`, `[::1]` and `localhost` all return 200.
- Full E2E suite: 152 passed, 0 failed.
