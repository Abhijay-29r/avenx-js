---
title: 'Templates & Slots'
description: 'How slots, data-bindings, loops, and conditional templates work in Avenx-JS.'
---

---

Avenx-JS provides a clean HTML-based template engine that supports text interpolation, HTML transclusion, two-way bindings, and loops.

## 1. Interpolation & HTML Escaping

- **Escaped Text (`{{ expression }}`)**: Values are automatically passed through an HTML escaper to prevent Cross-Site Scripting (XSS).

```html
<p>Hello {{ state.username }}</p>
```

- **Raw HTML (`{{{ expression }}}`)**: Allows inserting unescaped HTML. Use this with caution.

```html
<div>{{{ state.rawHtml }}}</div>
```

## Dynamic HTML Content (`data-ax-html`)

The `data-ax-html` directive binds HTML content directly to an element. Unlike standard text interpolation (`{{ ... }}`), it is designed for rendering HTML.

### Default Escaping

When a normal string is provided, HTML characters are automatically escaped to help prevent Cross-Site Scripting (XSS) attacks.

```html
<div data-ax-html="state.message"></div>
```

```js
state.message = "<strong>Hello World</strong>";
```

Output:

```html
&lt;strong&gt;Hello World&lt;/strong&gt;
```

### Rendering Trusted HTML

To render HTML without escaping, wrap the content with `SafeHtml` or generate it using the `html` tagged template helper.

```js
state.message = new SafeHtml("<strong>Hello World</strong>");
```

or

```js
state.message = html`<strong>Hello World</strong>`;
```

Output:

```html
<strong>Hello World</strong>
```

### Null and Undefined Values

If the bound value is `null` or `undefined`, an empty string is rendered.

### Security Advisory

Only use `SafeHtml` or the `html` helper with trusted content. Rendering untrusted user input without escaping may introduce Cross-Site Scripting (XSS) vulnerabilities.

## 2. Two-Way Bindings (`data-ax-bind`)

Form inputs (input, textarea, select) support two-way bindings via `data-ax-bind`. This is translated at compile-time to a value attribute and an event listener:

```html
<input type="text" data-ax-bind="state.username" />
```

> **Warning:** `data-ax-bind` does not currently handle the boolean `checked` state of checkbox and radio inputs. Since the directive binds to the input's `value` and listens for `input` events, using it with checkboxes or radio buttons will not correctly update their checked state.
> For checkbox inputs, bind the `checked` attribute manually and listen for the `change` event:

```html
<input type="checkbox" checked="{{ state.checked }}" @change="state.checked = event.target.checked" />
```

This ensures that the checkbox's checked state is rendered from `state.checked` and that the state is updated whenever the checkbox changes.

## 3. Boolean Attributes

Avenx-JS automatically handles standard HTML boolean attributes when they are bound to template expressions.

For supported boolean attributes, the evaluated value controls both:

- Whether the attribute is present in the rendered HTML.
- The corresponding DOM property (`true` or `false`).

If the expression evaluates to a truthy value, the attribute is added and the DOM property is set to `true`.

If the expression evaluates to a falsy value, the attribute is removed and the DOM property is set to `false`.

### Example

```html
<button disabled="{{ state.isSubmitting }}">
  Submit
</button>
```

When `state.isSubmitting` is `true`, the button is rendered as disabled.

When `state.isSubmitting` is `false`, the `disabled` attribute is removed automatically and the button becomes enabled.

### Supported Boolean Attributes

Avenx-JS automatically handles the following standard HTML boolean attributes:

- `checked`
- `disabled`
- `required`
- `readonly`
- `selected`
- `multiple`
- `autofocus`
- `novalidate`
- `formnovalidate`
- `hidden`
- `open`
- `reversed`
- `loop`
- `controls`
- `autoplay`
- `muted`
- `default`
- `ismap`
- `async`
- `defer`

### More Examples

Checkbox:

```html
<input
  type="checkbox"
  checked="{{ state.accepted }}"
/>
```

Input field:

```html
<input
  type="text"
  required="{{ state.requireName }}"
  readonly="{{ state.readOnly }}"
/>
```

Media element:

```html
<video
  controls="{{ state.showControls }}"
  autoplay="{{ state.autoPlay }}"
  muted="{{ state.muted }}">
</video>
```

Details element:

```html
<details open="{{ state.expanded }}">
  <summary>More Information</summary>
  <p>Content...</p>
</details>
```

Bind boolean attributes to expressions that evaluate to `true` or `false`. Avenx-JS automatically adds or removes the attribute and updates the corresponding DOM property.
## 4. Reactive Style Bindings (`data-ax-style`)

Use the `data-ax-style` directive to dynamically apply inline CSS styles using a JavaScript object.

### Basic Usage

```html
<p data-ax-style="{{ { color: state.textColor } }}">
  Dynamic text color
</p>
```

When `state.textColor` changes, the element's `color` style is updated automatically.

### Multiple Style Bindings

```html
<div
  data-ax-style="{{ {
    color: state.textColor,
    backgroundColor: state.backgroundColor,
    fontSize: state.fontSize + 'px'
  } }}"
>
  Styled content
</div>
```

### Conditional Styles

```html
<span
  data-ax-style="{{ {
    color: state.isError ? 'red' : 'green',
    fontWeight: state.isActive ? 'bold' : 'normal'
  } }}"
>
  Status
</span>
```

Using object syntax keeps templates more readable and maintainable than manually constructing inline style strings.

## 4. Loops (`<@for>`)

Render arrays using the custom `<@for>` loop tag. Loop blocks are translated to `<template>` tags and managed via the `ListManager` for efficient DOM list updates:

```html
<@for item in state.todos key="item.id">
    <li class="todo-item">{{ item.text }}</li>
</@for>
```

## 5. Slots & Transclusion
### The implicit `index` variable

In addition to your item variable, every `<@for>` loop automatically injects a zero-indexed `index` variable into the template scope. You don't need to declare it — `ListManager` adds it for you on each iteration — so it's available anywhere inside the loop body, for example to number items or apply alternating styles:

```html
<@for item in state.todos key="item.id">
    <li class="todo-item">
      <span class="index">{{ index + 1 }}</span>
      {{ item.text }}
    </li>
</@for>
```

> **Note:** `index` starts at `0`. Add `1` (as shown above) if you want a human-readable, 1-based count.

## 4. Slots & Transclusion

Components can receive child HTML blocks using `<slot>` elements. Both default and named slots are fully supported.

#### Component Definition (e.g. `Card`)

```html
<div class="card">
  <div class="card-header">
    <slot name="header">Default Header</slot>
  </div>
  <div class="card-body">
    <slot></slot>
    <!-- Default Slot -->
  </div>
</div>
```

#### Component Usage

```html
<Card>
  <h2 slot="header">Special Title</h2>
  <p>This content goes directly into the default slot!</p>
</Card>
```

#### Fallback (Default) Slot Content

If a component's caller does not provide content for a given slot, Avenx-JS automatically falls back to rendering the default content defined inside that `<slot>` element in the component's template. This applies to both named and default slots. For example, in the `Card` component above, if no `slot="header"` element is passed in, the header slot will render its fallback text, `Default Header`, instead of being left empty. This makes it easy to define sensible defaults for optional component content without requiring the caller to always supply every slot.

## 6. SVG Support
## 5. Passing Props to Child Components (`data-props-*`)

Custom child components can receive props from a parent page or component using the `data-props-<propName>` attribute syntax. The parser evaluates the attribute's value as an expression in the parent's scope and passes the resulting value into the child component as a prop.

```html
<MyProfile data-props-user="state.currentUser" />
```

Here, `data-props-user` passes the value of `state.currentUser` from the parent scope into the `MyProfile` component as the `user` prop. Inside the child component, the prop is accessed via `this.props.user`:

```html
<!-- src/components/my-profile/my-profile.component.js -->
<div class="profile">
  <p>Welcome, {{ this.props.user.name }}</p>
</div>
```

> **Note:** The portion of the attribute name after `data-props-` becomes the prop name on the child (e.g. `data-props-user` → `props.user`). Multiple props can be passed by adding additional `data-props-*` attributes:

```html
<MyProfile data-props-user="state.currentUser" data-props-isAdmin="state.isAdmin" />
```

## 6. SVG Support

Avenx-JS natively supports rendering SVG elements inside templates. During template cloning and patching, the framework automatically preserves the correct SVG namespace (`http://www.w3.org/2000/svg`), ensuring that SVG graphics render correctly in the browser.
This includes nested SVG elements such as `<rect>`, `<circle>`, `<path>`, and other SVG-specific tags. Even when templates are parsed using `DOMParser`, Avenx-JS automatically transitions SVG elements into the correct namespace during patching and cloning, so no additional configuration or manual namespace handling is required.

#### Example

```html
<svg width="200" height="200" viewBox="0 0 200 200">
  <rect x="20" y="20" width="160" height="160" rx="12" fill="#4F46E5" />
  <circle cx="100" cy="100" r="50" fill="#22C55E" />
  <path d="M50 150 L100 50 L150 150 Z" fill="#FACC15" />
</svg>
```
