---
title: 'Custom Directives'
description: 'Learn how to extend HTML elements with custom reactive behaviors and low-level DOM manipulations using Avenx-JS Custom Directives.'
---

Avenx-JS provides built-in directives like `data-ax-show`, `data-ax-class`, `data-ax-html`, [`data-ax-validate`](/core-concepts/form-validation), and [`data-ax-ref`](#built-in-element-reference-directive-data-ax-ref). In addition to these built-in directives, Avenx-JS allows you to register **Custom Directives** to perform direct, low-level DOM manipulations when reactive data changes.

> [!TIP]
> For declarative form validation using `data-ax-validate` and the `this.state.$validation` reactive schema, see the [Form Validation & $validation](/core-concepts/form-validation) guide.

---

## Built-in Element Reference Directive (`data-ax-ref`)

While Avenx-JS encourages data-driven declarative UI development, certain tasks require direct access to underlying HTML DOM elements (e.g. focusing input fields, invoking HTML5 Canvas 2D API methods, or measuring element dimensions).

The `data-ax-ref="refName"` directive assigns a named reference to a DOM element within the component template, making it accessible on the component instance via `this.$refs.refName`.

```html
<input data-ax-ref="searchInput" type="text" placeholder="Search..." />
```

### Accessing `$refs` in Component Actions & Lifecycle Hooks

After the component mounts (`onMount`), references are accessible on `this.$refs`:

#### 1. Form Input Auto-Focus Example

```javascript
// src/components/search-bar.component.js
export default {
  actions: {
    onMount() {
      // Focus the input element on mount
      if (this.$refs.searchInput) {
        this.$refs.searchInput.focus();
      }
    },
    clearSearch() {
      this.state.query = '';
      this.$refs.searchInput?.focus();
    },
  },

  template: `
    <div class="search-bar">
      <input
        data-ax-ref="searchInput"
        data-ax-bind="query"
        type="text"
        placeholder="Type to search..."
      />
      <button @click="clearSearch">Clear</button>
    </div>
  `,
};
```

#### 2. HTML5 Canvas Context Example

```javascript
// src/components/chart.component.js
export default {
  actions: {
    onMount() {
      const canvas = this.$refs.chartCanvas;
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4f46e5';
        ctx.fillRect(10, 10, 150, 100);
      }
    },
  },

  template: `
    <div class="chart-container">
      <canvas data-ax-ref="chartCanvas" width="300" height="150"></canvas>
    </div>
  `,
};
```

> [!IMPORTANT]
> - **Component Boundary Scoping:** References are strictly scoped to the declaring component. Elements with `data-ax-ref` inside nested child component boundaries are ignored by parent `$refs`.
> - **Availability:** `$refs` entries are populated after DOM attachment during `onMount`. They return `undefined` before DOM mounting (`onBeforeMount`).


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


## Resource cleanup in the `unmounted` hook

When a bound element leaves the DOM (component unmount, `v-if`/conditional
removal, or route change), Avenx calls `unmounted(el, binding)`. Use it to
tear down anything the directive attached that would otherwise leak:

| Cleanup | Typical pattern |
|---------|-----------------|
| Global listeners | `window` / `document` handlers added in `mounted` |
| Timers | `clearTimeout` / `clearInterval` / cancel `requestAnimationFrame` |
| Element-owned state | `delete el.__myDirectiveState` (or similar) |
| Observers | `ResizeObserver` / `IntersectionObserver` / `MutationObserver` `.disconnect()` |

Store handles on the element in `mounted` so `unmounted` can find them without
module-level globals.

### Example: scroll position tracker

```javascript
app.directive('scroll-track', {
  mounted(el, binding) {
    const onScroll = () => {
      if (typeof binding.value === 'function') {
        binding.value({ x: window.scrollX, y: window.scrollY });
      }
    };
    el.__scrollTrackHandler__ = onScroll;
    el.__scrollTrackRaf__ = 0;
    window.addEventListener('scroll', onScroll, { passive: true });
  },
  unmounted(el) {
    if (el.__scrollTrackHandler__) {
      window.removeEventListener('scroll', el.__scrollTrackHandler__);
      delete el.__scrollTrackHandler__;
    }
    if (el.__scrollTrackRaf__) {
      cancelAnimationFrame(el.__scrollTrackRaf__);
      delete el.__scrollTrackRaf__;
    }
  },
});
```

The built-in click-outside example above follows the same pattern: attach in
`mounted`, remove and `delete` the property in `unmounted`.

## Compiler Validation

During compilation, the Avenx-JS compiler validates expressions inside custom directives. If a directive attribute references an undeclared variable or state property, the compiler emits a diagnostic warning (`AVX_W11` / `COMPILER_UNDECLARED_VARIABLE`), helping catch typos before runtime.

---

## Directive Evaluation Lifecycle & Security

### Evaluation flow

1. **Compile time** — The compiler discovers built-in and custom `data-ax-*` attributes and binds them to expression strings or handlers.
2. **Mount** — On first mount, directive expressions are evaluated against the component instance (`this` / `state` / injected values) and applied to the live DOM node.
3. **Update** — When reactive state used by a directive changes, Avenx re-evaluates that directive during the component patch cycle. Directives that do not depend on dirty state are skipped.
4. **Unmount** — Custom directive `unmounted` hooks (when provided) run so listeners and DOM side effects can be cleaned up.

### HTML sanitization (`data-ax-html`)

Binding untrusted HTML with `data-ax-html` is dangerous. Avenx sanitizes injected markup and emits security warnings when risky content is stripped or blocked:

| Warning | Meaning |
| :--- | :--- |
| `AVX_W16` | A disallowed / sanitized tag was removed from HTML content |
| `AVX_W17` | Related sanitizer warning for unsafe markup patterns |
| `AVX_W21` | Additional HTML security warning during sanitize |

Prefer text interpolation or structured child components over raw HTML. If you must use `data-ax-html`, only pass trusted, server-sanitized content.

See [Error Reference](/troubleshooting/errors) for full warning text and examples.

