# ADR 0001 — One markup lexer for the template front-end

- Status: accepted
- Branch: `fix/compiler-front-end`
- Addresses: blocker B1 in `../initial-assessment.md`

## Context

The template front-end applied its rewrites with regular expressions over
markup:

| Pass | Pattern |
|---|---|
| `StyleProcessor.process` (`@css name`) | `/<([^>]+)\s+@css\s+([\w-]+)([^>]*)>/g` |
| `StyleProcessor.process` (`<@css name />`) | `/<@css\s+([\w-]+)?\s*\/?>/g` plus `lastIndexOf('<')` |
| `processBindDirectives` | `/<(input\|textarea\|select)\b([^>]*?)>/gi`, then `.replace(/\s+/g, ' ')` on the whole tag |
| Comment stripping | `/<!--[\s\S]*?-->/g` |

The tree parser (`parseHTML`) had its own tag-end and attribute scanners, and
the declaration scanner (`parser/tokenizer.js`) a third.

Reproduced consequences, each a successful build:

1. `<button @click="count > 3 ? a() : b()" @css button>` — the class was not
   applied, its CSS rule was dropped, the IR read `@css` as an event named
   `css`, Atlas reported a false `AVX_W41`.
2. The same tag with `@css` first — the handler became `count class=`; the
   production bundle rendered an empty element and, in the E2E styling app,
   **blanked the whole page**; the development bundle rendered
   `3="true" add="true" :="true"`.
3. `@click='msg = "hi"'` — the static-subtree pass serialised the value as
   `msg = &quot;hi&quot;` and re-parsed it; the expression no longer compiled
   and the component fell back to the string renderer.
4. `title="<!-- not a comment -->"` — emptied to `title=""`.
5. `<p>{{ a <b }}</p>` — an element `<b>` was invented and the interpolation
   lost.
6. `<input title="a > b" data-ax-bind="v" />` — the binding was silently not
   expanded.
7. `<section><div>…</div><@css card /></section>` — documented to style the
   `<div>` (`core-concepts/styling.md` §2); the class was silently dropped.

## Decision

Introduce `lib/core/utils/markupLexer.js`, a single lexer whose tokens tile the
source exactly, and make every front-end consumer use it:

- `parseHTML` and `scanTagEnd` (`lib/compiler/parser/htmlTree.js`)
- `StyleProcessor.process`
- `processBindDirectives` (`lib/core/utils/templateUtils.js`, shared with the
  runtime)
- comment stripping in `ComponentParser.extractTemplate`

Consumers edit the template by the spans the lexer reports (`applyEdits`), so
every character outside the edited spans is preserved verbatim.

The lexer lives under `lib/core` rather than `lib/compiler` because
`processBindDirectives` also runs in the runtime for components constructed
directly from a template string.

### Grammar

Documented in the module header. The decisions that differ from the regex
front-end:

- A quote opens an attribute value only after `=` (HTML). Inside a quoted value
  a backslash escapes the next character (kept for compatibility).
- `{{ }}`, `{{{ }}}` and `{% %}` are opaque in text and in unquoted attribute
  positions. An opener without a terminator, or whose terminator follows another
  opener, is text — a stray `{{` cannot swallow the tags after it.
- Directive tags (`<@…>`) end at the first `>` outside quotes and brackets; `=>`
  never ends a tag. (Unchanged from `scanTagEnd`.)
- `<script>` and `<style>` contents are raw text.
- A tag name starts with a letter or `@`.

### Serialisation

`HTMLNode.attrQuotes` records each parsed attribute's quote. `serializeHTML`
writes a single-quoted attribute back in single quotes when its value does not
contain one, so values round-trip. Attributes created by compiler passes keep
the historical escaped double-quoted form.

Character references in attribute values are **not** decoded, as before.
Decoding them for expression attributes (so `@click="a &amp;&amp; b"` means
`a && b`, as it does on the string renderer, which reads through `DOMParser`)
is a separate semantic change and is tracked as follow-up work.

### Build-time guarantees

| Code | When | Previously |
|---|---|---|
| `AVX_C24` error | `@css` without a block name or with a value; `<@css />` without a name; a `<@css> … </@css>` stylesheet block written in the template | `@css` compiled as an event handler; an inline block fell back to the string renderer and printed the CSS as page text |
| `AVX_C25` error | After the front-end, an `@css` attribute, `<@css />` tag or `data-ax-bind` on a form control remains (post-condition; a compiler defect) | not checked |
| `AVX_C26` error | A tag or comment is never terminated | read as text; build succeeded |
| `AVX_W49` warning | A style block name is not declared in the stylesheet | silently dropped |
| `AVX_W50` warning | `<@css />` has no element to style | silently dropped |

## Behaviour changes

All of these correct output that was previously wrong. None changes output for a
template the previous front-end handled correctly; the existing unit, integration
and E2E suites pass unchanged except for one test fixture that relied on an
inline `<@css>` block (moved to a `.component.css` file).

1. `<@css name />` immediately after an element now styles that element, as
   documented.
2. Several `@css` attributes on one element all apply.
3. Builds that previously succeeded now fail with `AVX_C24` or `AVX_C26` when
   the template was malformed in those ways.
4. `data-ax-bind` expansion keeps whitespace inside other attribute values and
   quotes generated attributes with a quote the expression does not contain.

## Evidence

- `test/unit/templateFrontEnd.test.js` — every reproduced case, attribute-order
  independence, rejection codes, deterministic output. Fails on the previous
  front-end.
- `test/unit/markupLexer.test.js` — grammar cases and a 3,000-input randomised
  tiling check.
- `test/e2e/specs/styling/attribute-content.spec.js` — the reproduced cases in
  the production build of the styling fixture app, in Chromium. On the previous
  front-end all 12 styling tests fail (the page renders blank); with the lexer
  all pass.
- Full Node suite: 224/224. E2E: 131 passed; the 8 failures are the dev-server
  spec, which fails identically on the unmodified baseline (blocker B4).

## Remaining regex in the front-end

These passes run after the IR snapshot is taken and only shape the template for
the **string renderer** (fallback components and development builds). They are
not fixed by this ADR:

| Pass | Technique | Known weakness |
|---|---|---|
| `processSuspense`, `processErrorBoundary`, `processDeadlock`, `processDefer` | `/<@x>([\s\S]*?)<\/ ?@x>/` | no nesting; first close tag wins |
| `processComponentTags` | hand scanner with its own quote handling | independent of the lexer |
| `processSlotProps`, `escapeScopedSlots` | regex over attributes and `<template>` | `>` in attribute values |
| `processForLoops` | `scanTagEnd` (now lexer-backed) plus string slicing | partially migrated |
| `extractStylesAndVars` | regex over the stylesheet (`<@global>`, `<@css>`) | CSS, not markup |
| import stripping, `<template lang>` detection | line-anchored regex | low risk |

Migration plan: move each legacy pass onto lexer tokens (or the tree) in
`refactor/legacy-front-end`, with parity fixtures for the construct alone and
nested inside `<@for>`, `<@if>` and slots, before any construct moves into the
IR. The string renderer stays until every refused construct has IR parity (see
`../feature-inventory.md`).
