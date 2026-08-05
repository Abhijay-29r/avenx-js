---
title: 'Custom Directives'
description: 'Learn how to extend HTML elements with custom reactive behaviors and low-level DOM manipulations using Avenx-JS Custom Directives.'
---

Avenx-JS provides built-in directives like `data-ax-show`, `data-ax-class`, `data-ax-html`, and [`data-ax-validate`](/core-concepts/form-validation). In addition to these built-in directives, Avenx-JS allows you to register **Custom Directives** to perform direct, low-level DOM manipulations when reactive data changes.

> [!TIP]
> For declarative form validation using `data-ax-validate` and the `this.state.$validation` reactive schema, see the [Form Validation & $validation](/core-concepts/form-validation) guide.

---

## What is a Custom Directive?

A custom directive is an object containing lifecycle hooks that are invoked as elements enter, update, or leave the DOM. Directives are bound to elements in templates using the `data-ax-${directiveName}` attribute.

---

## Registering Custom Directives (`app.directive`)

Register custom directives globally on your `AvenxApp` instance using `app.directive(name, definition)`:

```javascript
import { AvenxApp } from 'avenx-core/runtime';

const app = new AvenxApp({ target: '#app' });

// Register a custom directive named 'focus'
app.directive('focus', {
  mounted(el) {
    el.focus();
  },
});
```

You can then apply the directive in any component template using `data-ax-focus`:

```html
<input data-ax-focus placeholder="Auto-focused input..." />
```

---

## Lifecycle Hooks & Binding Objects

A directive definition can implement three lifecycle hooks:

| Hook | Parameters | When Invoked |
| --- | --- | --- |
| `mounted` | `(el, binding)` | Called when the bound element is inserted into the DOM. |
| `updated` | `(el, binding)` | Called after the containing component updates and the bound expression value changes. |
| `unmounted` | `(el, binding)` | Called when the bound element is unmounted/removed from the DOM. |

### The `binding` Object

The `binding` argument provides metadata and values associated with the directive expression:

| Property | Type | Description |
| --- | --- | --- |
| `value` | `any` | The current evaluated result of the directive expression. |
| `oldValue` | `any` | The previous evaluated value before the current update (available in `updated` and `unmounted`). |
| `expression` | `string` | The raw string expression assigned to the directive attribute in the template. |

---

## Practical Examples

### 1. Auto-Focus Directive (`data-ax-focus`)

Automatically sets focus on an input element when it mounts:

```javascript
app.directive('focus', {
  mounted(el) {
    if (typeof el.focus === 'function') {
      el.focus();
    }
  },
});
```

Usage in template:

```html
<input data-ax-focus type="text" placeholder="Search..." />
```

---

### 2. Tooltip Directive (`data-ax-tooltip`)

Dynamically sets a native `title` attribute or creates custom UI tooltips:

```javascript
app.directive('tooltip', {
  mounted(el, binding) {
    el.setAttribute('title', binding.value || '');
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      el.setAttribute('title', binding.value || '');
    }
  },
  unmounted(el) {
    el.removeAttribute('title');
  },
});
```

Usage in template:

```html
<button data-ax-tooltip="state.tooltipText">Hover me</button>
```

---

### 3. Click-Outside Directive (`data-ax-click-outside`)

Executes an action expression when a click occurs outside the target element (useful for dropdown menus and modal overlays):

```javascript
app.directive('click-outside', {
  mounted(el, binding) {
    el.__clickOutsideHandler__ = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        // Execute callback passed via expression
        if (typeof binding.value === 'function') {
          binding.value(event);
        }
      }
    };
    document.addEventListener('click', el.__clickOutsideHandler__);
  },
  unmounted(el) {
    if (el.__clickOutsideHandler__) {
      document.removeEventListener('click', el.__clickOutsideHandler__);
      delete el.__clickOutsideHandler__;
    }
  },
});
```

---

## Compiler Validation

During compilation, the Avenx-JS compiler validates expressions inside custom directives. If a directive attribute references an undeclared variable or state property, the compiler emits a diagnostic warning (`AVX_W11` / `COMPILER_UNDECLARED_VARIABLE`), helping catch typos before runtime.
