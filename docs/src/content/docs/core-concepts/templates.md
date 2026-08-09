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
state.message = '<strong>Hello World</strong>';
```

Output:

```html
&lt;strong&gt;Hello World&lt;/strong&gt;
```

### Rendering Trusted HTML

To render HTML without escaping, wrap the content with `SafeHtml` or generate it using the `html` tagged template helper.

```js
state.message = new SafeHtml('<strong>Hello World</strong>');
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

## 3. Boolean Attributes Coercion

The framework's template patcher (`lib/core/renderer/domPatch.js`) provides automatic handling for standard HTML boolean attributes when bound to expressions (e.g., `disabled="{{ state.isSubmitting }}"`).

When a boolean attribute's value is bound to an expression, Avenx-JS automatically toggles its presence on the element and sets the underlying DOM property to `true` or `false` based on the evaluated truthiness:

- **Truthy Evaluation**: If the bound expression evaluates to a truthy value, the attribute is added to the HTML element and the underlying DOM property is set to `true` (e.g., `element.disabled = true`).
- **Falsy Evaluation**: If the bound expression evaluates to a falsy value (`false`, `null`, `undefined`, or `"false"`), the attribute is automatically removed from the HTML element and the DOM property is set to `false` (e.g., `element.disabled = false`).

### Supported Boolean Attributes

Avenx-JS automatically coerces the following standard HTML boolean attributes:

- `disabled`
- `checked`
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

### Examples

#### Button State

```html
<button disabled="{{ state.isSubmitting }}">Submit</button>
```

When `state.isSubmitting` is `true`, the `disabled` attribute is present on the `<button>` and `button.disabled = true`. When `state.isSubmitting` becomes `false`, the attribute is automatically removed and `button.disabled = false`.

#### Checkbox and Form Inputs

```html
<input type="checkbox" checked="{{ state.accepted }}" />
<input type="text" required="{{ state.requireName }}" readonly="{{ state.readOnly }}" />
```

#### Media Elements

```html
<video controls="{{ state.showControls }}" autoplay="{{ state.autoPlay }}" muted="{{ state.muted }}"></video>
```

#### Details Element

```html
<details open="{{ state.expanded }}">
  <summary>More Information</summary>
  <p>Content...</p>
</details>
```

When binding conditional flags to inputs or buttons, bind your expression directly to the boolean attribute. Avenx-JS automatically handles adding/removing the attribute and setting the DOM property based on evaluated truthiness.

## 4. Conditional Visibility (`data-ax-show`)

The `data-ax-show` directive reactively toggles the visibility of an element by modifying its inline CSS `display` property based on the evaluated expression.

### Basic Usage

```html
<div data-ax-show="state.isVisible">This content is conditionally visible.</div>
```

When `state.isVisible` evaluates to a truthy value, the element is visible. When it evaluates to a falsy value, the element is hidden using `display: none`.

### How It Works & State Conservation

Unlike simple directives that hardcode `display: block` or remove the element from the DOM entirely, `data-ax-show` carefully conserves your layout styling:

1. **Boolean Conversion**: The directive evaluates the expression and converts the result to a strict boolean (equivalent to `!!value`).
2. **Conserving Original Display**: On initialization, before any styles are modified, Avenx-JS saves the element's original CSS `display` property (such as `flex`, `grid`, `inline-block`, or default `""`) to an internal property (`__originalDisplay`) on the DOM element.
3. **Restoring Visibility**:
   - When switching to **true** (visible), the element's `style.display` is restored to its conserved `__originalDisplay` value.
   - When switching to **false** (hidden), `style.display` is set to `'none'`.

### Example with Flexbox and Grid Layouts

Because `__originalDisplay` is conserved, toggling visibility will never break custom layout containers:

```html
<!-- The inline 'display: flex' is saved to __originalDisplay on init -->
<div style="display: flex; gap: 10px;" data-ax-show="state.showToolbar">
  <button>Action 1</button>
  <button>Action 2</button>
</div>
```

When `state.showToolbar` becomes `true`, the element correctly reverts to `display: flex` instead of defaulting to `block`.

### Integration with Transitions

`data-ax-show` integrates seamlessly with Avenx-JS's animation lifecycle when combined with `<transition>` wrappers or `data-ax-transition` attributes:

- **Enter Transitions**: When switching from `false` to `true`, `display` is restored to `__originalDisplay` immediately, and the compiler triggers the `-enter`, `-enter-active`, and `-enter-to` CSS class sequence.
- **Leave Transitions**: When switching from `true` to `false`, the element is **not** hidden immediately. Instead, the `-leave`, `-leave-active`, and `-leave-to` CSS classes are applied. An exit callback waits for the CSS transition or animation to finish before finally setting `style.display = 'none'`.

For a complete guide and code examples on animating visibility toggles, see the [Transition Animations](./transitions.md#conditional-rendering-transitions) documentation.

:::tip
If evaluating a `data-ax-show` expression fails (for instance, when referencing an undefined property on `state`), Avenx-JS emits warning **AVX_W22** (`DIRECTIVE_SHOW_EVALUATION_FAILED`). Refer to the [Error Codes reference](/troubleshooting/errors#avx_w22--directive_show_evaluation_failed) for detailed troubleshooting steps.
:::


## 5. Reactive Style Bindings (`data-ax-style`)

Use the `data-ax-style` directive to dynamically apply inline CSS styles using a JavaScript object.

### Basic Usage

```html
<p data-ax-style="{{ { color: state.textColor } }}">Dynamic text color</p>
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

## 6. Dynamic Class Bindings (`data-ax-class`)

Use the `data-ax-class` directive to add or remove CSS classes reactively. Static `class="…"` attributes on the same element are preserved.

### String Format

When the expression evaluates to a string, its space-separated tokens are applied as class names:

```html
<div class="card" data-ax-class="state.themeClass">Themed card</div>
```

```js
// e.g. in <state />
themeClass = 'theme-dark highlight';
```

When `state.themeClass` changes, previously applied dynamic classes from this directive are replaced with the new set. The static `card` class remains.

### Object Format

Pass an object whose **truthy** keys become class names (quote keys that are not valid identifiers):

```html
<button class="btn" data-ax-class="{ active: state.isActive, 'text-large': state.isLarge, disabled: state.isDisabled }">
  Action
</button>
```

| Expression value                        | Result                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `{ active: true, 'text-large': false }` | adds `active`; removes `text-large` if it was previously set by this directive |
| `"theme-blue"`                          | applies `theme-blue`                                                           |
| `""` / falsy                            | clears dynamic classes from this directive                                     |

> **Note:** Object and string forms are evaluated as template expressions in the component scope (same rules as other `data-ax-*` bindings). Prefer object form for multiple independent toggles.

## 7. Loops (`<@for>`)

Render arrays using the custom `<@for>` loop tag. Loop blocks are translated to `<template>` tags and managed via the `ListManager` for efficient DOM list updates:

```html
<@for item in state.todos key="item.id">
    <li class="todo-item">{{ item.text }}</li>
</@for>
```

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

## 8. Slots & Transclusion

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

### Checking Slot Presence (`this.$slots.has()`)

Components can determine whether a slot was provided by the parent using
`this.$slots.has(slotName)`.

#### Default Slot

```javascript
if (this.$slots.has('default')) {
  console.log('Default slot provided');
}
```

#### Named Slot

```javascript
if (this.$slots.has('header')) {
  console.log('Header slot provided');
}
```

If the slot is not provided, `this.$slots.has()` returns `false`, allowing components to conditionally render fallback content.

## 9. Passing Props to Child Components (`data-props-*`)

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

## 10. SVG Support

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
