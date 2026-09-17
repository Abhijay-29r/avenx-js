---
title: 'Template Expressions & Data Binding'
description: 'Learn how to use template expressions, event binding syntax, and structural directives inside Avenx-JS component templates.'
---

Avenx-JS templates use a small, declarative expression syntax to bind state, handle events, and control structure directly inside your HTML.

## Interpolation

Use double curly braces `{{ }}` to interpolate reactive state or computed values directly into your markup:

```html
<state name="Ada" />
<p>Hello, {{ state.name }}!</p>
```

Bare state keys work, and are reactive:

```html
<state price="100" />
<p>Total: {{ price * 1.1 }}</p>
```

`state.price` means the same thing. Either form registers a dependency on
`price` and on nothing else, so a change to an unrelated state key does not
re-render this component.

---

## What an expression may contain

Template expressions, computed values, directive bindings and list keys are
**parsed and compiled by Avenx at build time**, into ordinary JavaScript
functions that go into your bundle. `{{ price * 1.1 }}` becomes a closure the
browser's own engine compiled when it compiled the rest of your code. Two
things follow from that, and both are worth knowing before you write one.

**They need no `'unsafe-eval'`.** Nothing calls `eval` or `new Function`, in the
compiler or in the runtime, so a production page runs under `script-src 'self'`.
This is checked on the emitted bundle by the test suite rather than asserted
here. See [Deployment](/guides/deployment/).

**Every property access is still checked.** Compiling does not hand the
expression to the engine unsupervised: a member read is emitted as a call that
receives the key already resolved, so `x.constructor` and `x['const'+'ructor']`
arrive at the same check as the same string, and neither reaches the `Function`
constructor or a built-in prototype. Naming a restricted global such as `window`
or `fetch` in a template expression or inline event handler is refused **at
build time**, with the file and the line, rather than when that branch first
runs. `<action>` and `<resource>` bodies are different; see
[Action and resource bodies](#action-and-resource-bodies).

**They are expressions, not statements.** Supported:

- property access, optional chaining, computed access — `user.name`,
  `a?.b`, `items[i]`
- calls, including callbacks — `items.filter(i => i.done).length`,
  `items.map(function (i) { return i.id; })`
- arithmetic, comparison, logical and nullish operators, ternaries
- template literals, array and object literals, spread, `new`
- assignment and update operators, in event handlers — `count++`

Not supported, because they are not expressions: `if`, `for`, `while`, `try`,
`return`, `await`, variable declarations, destructuring patterns. Put that logic
in an `<action>` and call it:

```html
<!-- Refused at build time with AVX_R32 -->
<computed name="label" value="if (count) { 'some' } else { 'none' }" />

<!-- Write this instead -->
<computed name="label" value="count ? 'some' : 'none'" />
```

The compiler checks every one of these when you build, so an unsupported
expression is a build failure with a file, a line and a reason — never a blank
value discovered in production.

---

## Action and resource bodies

An `<action>` or `<resource>` body is ordinary JavaScript, not a template
expression. Statements, declarations, `await`, destructuring and every browser
API are available:

```html
<resource name="users">
  return fetch('/api/users').then((res) => res.json());
</resource>

<action name="onMount">
  this._timer = setInterval(() => this.state.count++, 1000);
  window.addEventListener('resize', this.onResize);
</action>
```

A free name in a body resolves in this order:

1. component scope — state, computed values, actions, imported bridges, `this`;
2. the expression globals (`Date`, `Math`, `JSON`, …), through Trace's
   substitution point, so a recording captures and replays what the action
   observed;
3. the page's global object — `fetch`, `window`, `document`, `setTimeout`,
   `requestAnimationFrame`, `IntersectionObserver`, or a library a page put on
   `window`.

State wins over a global of the same name. Assigning to a name the page already
defines (`location = '/login'`) writes that global; assigning to an undeclared
name creates a component scope key, as it always has.

Two names stay refused, with `AVX_C21` at build time: `eval` and `Function`.
They build code from strings, which is what would require `'unsafe-eval'`, and a
production bundle is guaranteed not to.

Trace records the values an action reads through the expression globals in step
2. Values read directly from page globals in step 3 — a `fetch` response, a
`setTimeout` callback — are not substituted during replay, so a trace that
depends on them may be reported as non-deterministic.

> Before 2026-09, action and resource bodies were refused browser globals at
> build time (`AVX_C21`) and other page globals at run time (`AVX_R15`),
> contradicting this page and the examples in resources and lifecycle hooks.
> No change is needed in existing code: bodies that were refused now build.

---

## What the expression boundary does and does not protect

An expression cannot reach `window`, `document`, `fetch`, `localStorage`,
`globalThis`, `Reflect` or `Symbol`; cannot read or write `constructor`,
`prototype` or `__proto__` however the key is spelled, including keys assembled
at runtime; and cannot reach a built-in prototype object. Those refusals are
`AVX_R15`.

That boundary exists so a template stays inside its declared scope and cannot
corrupt state shared with the rest of the page. **It is not isolation against
expressions written by someone you do not trust.** An expression can still call
any function the scope legitimately exposes, and an `<action>` body is ordinary
JavaScript. Do not build a feature that evaluates user-supplied expression
source on the assumption that this contains it.

---

## Unescaped HTML Interpolation (`{{{ ... }}}`) & XSS Security Guidelines

By default, standard interpolation (`{{ expression }}`) automatically escapes special HTML characters (`<`, `>`, `&`, `"`, `'`) to ensure that values are safely rendered as plain text.

To render raw HTML content (such as rich text editor output or sanitized Markdown markup), use triple curly braces **`{{{ expression }}}`**:

```html
<state rawBio="<strong>Software Engineer</strong> &amp; Open Source Contributor" />

<div class="user-bio">
  {{{ state.rawBio }}}
</div>
```

### Escaped (`{{ }}`) vs. Unescaped (`{{{ }}}`) Comparison

| Syntax | Output Handling | Example Input | Rendered DOM Output |
| :--- | :--- | :--- | :--- |
| `{{ expr }}` | Automatically HTML-escaped | `<b>Hello</b>` | `&lt;b&gt;Hello&lt;/b&gt;` *(rendered as text)* |
| `{{{ expr }}}` | Raw HTML interpolation | `<b>Hello</b>` | `<b>Hello</b>` *(rendered as HTML element)* |

> [!CAUTION]
> **Cross-Site Scripting (XSS) Security Warning:** Rendering untrusted user input using `{{{ ... }}}` introduces severe Cross-Site Scripting (XSS) vulnerabilities. Never pass raw user inputs, URL parameters, or unvalidated form fields directly to triple-curly expressions.

### Safe Raw HTML Rendering with `Sanitizer`

Before rendering user-generated HTML content with `{{{ ... }}}`, use the built-in `Sanitizer` class from `avenx-core/runtime` to strip dangerous elements (like `<script>`, `<iframe>`, or inline `onerror` attributes):

```javascript
import { AvenxComponent, Sanitizer } from 'avenx-core/runtime';

export default class UserProfile extends AvenxComponent {
  onMount() {
    const sanitizer = new Sanitizer();
    
    // Sanitize untrusted input before assigning to state
    const untrustedBio = '<p>Hello!</p><script>alert("XSS Attack!")</script>';
    this.state.safeBio = sanitizer.sanitize(untrustedBio);
  }
}
```

```html
<!-- Renders clean, sanitized HTML safely -->
<div class="bio-content">
  {{{ state.safeBio }}}
</div>
```

## Attribute Binding

Bind standard HTML attributes to a reactive value by using interpolation `{{ }}` directly inside the attribute string. Avenx-JS also automatically handles boolean attributes (like `disabled`, `checked`):

```html
<state isSubmitting="true" />
<button disabled="{{ state.isSubmitting }}">Submit</button>
```

For CSS classes specifically, you can use the `data-ax-class` directive which supports object syntax:

```html
<state isActive="true" />
<div data-ax-class="{ active: state.isActive, inactive: !state.isActive }"></div>
```

## Event Binding

Bind DOM events using the `@` prefix, followed by the event name and the handler expression:

```html
<button @click="increment()">Add</button>
```

The referenced handler must be defined as an action in your component's script, or be an inline expression.

Avenx-JS also supports event modifiers like `.prevent`, `.stop`, and keyboard modifiers like `.enter`:

```html
<form @submit.prevent="save()">
  <button type="submit">Save</button>
</form>
```

## Structural Directives

Structural directives control whether and how elements are rendered using special tags or attributes.

- `data-ax-show` — conditionally renders an element by toggling its inline `display` property.
- `<@for>` — repeats an element for each item in an array using a custom loop tag.

```html
<ul>
  <@for item in state.items key="item.id">
    <li>{{ item.name }}</li>
  </@for>
</ul>

<p data-ax-show="state.items.length === 0">No items yet.</p>
```
