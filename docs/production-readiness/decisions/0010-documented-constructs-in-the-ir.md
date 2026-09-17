# ADR 0010 — Two documented constructs move off the fallback renderer

- Status: accepted
- Branch: `fix/legacy-directive-passes`
- Evidence: `../build-validation-inventory.md` §4

## Context

The `AVX_W47` inventory listed two entries that were **compiler limitations**
rather than constructs the IR genuinely cannot model. Both are documented, both
worked, and both forced the whole component onto the string renderer:

| Construct | Documented in | IR behaviour |
|---|---|---|
| `<@for item="user" in="users">` | `api-reference/component.md`, `troubleshooting/errors.md` | refused: `has no "in" clause` |
| `<@loading>` inside `<@defer>` | `core-concepts/defer.md` | refused: `an unrecognised directive` |

A fallback is not a bug — the output is correct — but it costs a full
re-render-and-diff on every update, reports `AVX_W47` on every build, and links
the string renderer into bundles that would not otherwise carry it.

## Decision

Model both in the IR.

- `parseForHeader` recognises the attribute spelling
  (`item="user" in="users" key="user.id"`) and returns the same parts as the
  header spelling, so both lower to an identical program. Only the fully-quoted
  form is accepted, so a header that merely contains the word `in` still goes to
  the header parser. A header missing either half is still refused.
- `buildDefer` accepts `<@loading>` as a spelling of the placeholder block, as
  the string renderer always did. `<@placeholder>` wins if a template carries
  both, matching the previous resolution order, and two `<@placeholder>` blocks
  are still refused. `<@loading>` outside a `<@defer>` is reported like a stray
  `<@placeholder>`.

Nothing is removed: the header spelling, `<@placeholder>`, and the string
renderer itself are all unchanged.

## Result

All four spellings now compile to a render program:

```
for-attribute-form     fallbacks=[]
for-header-form        fallbacks=[]
defer-loading          fallbacks=[]
defer-placeholder      fallbacks=[]
```

## Evidence

`test/unit/irDocumentedConstructs.test.js` — both loop spellings parse to the
same parts and lower to byte-identical programs; keys are read; malformed
headers are still refused; `<@loading>` lowers to a defer op with a placeholder;
`<@placeholder>` still works and still wins when both appear. Fails on the base
branch with the two refusals above.
