# ADR 0003 — A bound `srcdoc` is HTML, not a URL

- Status: accepted
- Branch: `fix/srcdoc-html-safety`
- Evidence: `../security-inventory.md` category D

## Context

`srcdoc` was in `URL_ATTRIBUTES` (`lib/core/security/urlPolicy.js`), so a bound
`srcdoc="{{ value }}"` was passed through `sanitizeUrlAttribute`, which only
checks the URL scheme. `srcdoc` is an HTML document, and `<img src=x
onerror=...>` has no scheme, so the check passed and the markup was set verbatim.
An `<iframe srcdoc>` is same-origin by default, so the markup executed with
access to the parent page.

Runtime evidence (happy-dom):

```
srcdoc set to: "<img src=x onerror=\"parent.__pwn=1\">"
```

`srcdoc` binding is not documented and appears in no fixture, example or test.

## Decision

Treat a bound `srcdoc` exactly as `data-ax-html`: a plain value is escaped, and
only a `SafeHtml` value introduces markup.

- `srcdoc` is removed from `URL_ATTRIBUTES`; a scheme check is meaningless for a
  document.
- `applyAttribute` and `applyAttributeParts` route `srcdoc` through a
  `safeSrcdoc` helper that escapes a plain value and passes a `SafeHtml` value
  through, mirroring `applyHtml`.
- The string-renderer path is already safe: an interpolation in an attribute is
  HTML-escaped by the template escaper before the value reaches the DOM, and
  `{{{ }}}` remains the documented raw opt-in.

A static literal `srcdoc="<b>x</b>"` (no interpolation) is developer-authored
and unchanged.

## Compatibility

- The capability is preserved: bind a `SafeHtml` value to render trusted HTML in
  an iframe.
- Behaviour change: a plain string bound to `srcdoc` is now escaped instead of
  rendered. Documented in `core-concepts/templates.md` with the `html` migration.
- No build failure is introduced.

## Evidence

- `test/unit/srcdocSafety.test.js` — `isUrlAttribute('srcdoc')` is false; a
  bound string is escaped; a `SafeHtml` value passes through; parts are escaped;
  `null` clears; URL attributes are still scheme-checked. Fails on the base.
- `test/e2e/specs/security/srcdoc.spec.js` with fixture app `security` — in a
  real browser: an untrusted string in `srcdoc` does not execute and its `<img>`
  never exists; a `SafeHtml` value renders. Both fail on the base runtime.
