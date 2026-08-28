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

Any valid JavaScript expression is supported inside the braces, including property access and simple operations:

```html
<state price="100" />
<p>Total: {{ state.price * 1.1 }}</p>
```

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
