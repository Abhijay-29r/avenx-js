---
title: Transition Animations
description: Learn how to use the <transition> compiler tag and CSS classes for enter/leave animations in Avenx-JS.
---

Avenx-JS features a built-in animation framework powered by the template compiler and `DomPatcher`. By wrapping elements in a `<transition>` tag, you can smoothly animate elements as they enter or leave the DOM lifecycle.

---

## The `<transition>` Tag

The `<transition>` component does not render an element itself; instead, it injects dynamic CSS classes into its immediate child element during entry and exit hooks.

```html
<transition name="fade">
  <div class="box">Animate Me!</div>
</transition>
```

At compile time the `<transition>` wrapper is stripped out and replaced with a `data-ax-transition` attribute on the child. At runtime the child's class list is toggled through a sequence of six class hooks.

If no `name` attribute is given, the transition defaults to `ax`, producing classes like `.ax-enter` and `.ax-leave`.

```html
<transition>
  <p>Default name is "ax"</p>
</transition>
```

### Dynamic Names

The `name` attribute also accepts a template expression so the transition identity can be driven by state:

```html
<transition name="{{ state.transitionType }}">
  <div>Dynamic transition</div>
</transition>
```

---

## Enter / Leave Class Lifecycle

Every transition produces six CSS classes that follow a precise timing sequence.

### Enter

| Step | Classes on Element                          | Trigger                                                                       |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | `fade-enter` `fade-enter-active`            | Added synchronously when element is inserted                                  |
| 2    | `fade-enter-to` added, `fade-enter` removed | After double `requestAnimationFrame` (browser has rendered the initial paint) |
| 3    | `fade-enter-active` `fade-enter-to` removed | On `transitionend` / `animationend` event or fallback timeout                 |

```text
Element inserted
    ↓
Add: -enter, -enter-active
    ↓
[double rAF]
    ↓
Remove: -enter
Add: -enter-to
    ↓
[transitionend / animationend / timeout]
    ↓
Remove: -enter-active, -enter-to
```

### Leave

| Step | Classes on Element                          | Trigger                                                                                         |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1    | `fade-leave` `fade-leave-active`            | Added synchronously when element is removed                                                     |
| 2    | `fade-leave-to` added, `fade-leave` removed | After double `requestAnimationFrame`                                                            |
| 3    | `fade-leave-active` `fade-leave-to` removed | On `transitionend` / `animationend` event or fallback timeout, then element is removed from DOM |

```text
Element should be removed
    ↓
Add: -leave, -leave-active  (_isLeaving = true)
    ↓
[double rAF]
    ↓
Remove: -leave
Add: -leave-to
    ↓
[transitionend / animationend / timeout]
    ↓
Remove: -leave-active, -leave-to (_isLeaving = false)
Remove from DOM
```

### Rapid Toggling

If a new transition starts on an element before the previous one finishes (for example, rapidly toggling visibility), the in-progress transition is immediately cleaned up so the new one starts from a clean state.

---

## Duration Computation

The framework reads the element's computed style to determine how long to wait before cleaning up:

- `transition-duration` + `transition-delay`
- `animation-duration` + `animation-delay`

If multiple comma-separated values exist (e.g. separate durations for `opacity` and `transform`), the **maximum** value is used. Units can be `s` (seconds) or `ms` (milliseconds).

If the computed duration is `0` (no CSS transition or animation is defined), cleanup runs synchronously and no animation occurs.

A 50 ms buffer is added as a fallback timeout in case the native `transitionend` or `animationend` events do not fire.

---

## CSS Example

A basic fade transition that changes opacity over 300 ms:

```css
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave {
  opacity: 1;
}
```

### Slide + Fade

```css
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.slide-fade-enter,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-enter-to,
.slide-fade-leave {
  opacity: 1;
  transform: translateX(0);
}
```

---

## Conditional Rendering Transitions

The `<transition>` tag (or the `data-ax-transition` attribute) works transparently with the `data-ax-show` visibility directive. When the bound expression toggles between truthy and falsy values, the element smoothly passes through the enter or leave class sequence instead of appearing or disappearing instantly.

### How Visibility Toggles Integrate with Transitions

When an element with `data-ax-show` is animated using a named transition:

1. **Boolean Evaluation**: The expression is evaluated as a boolean (`!!value`).
2. **State Conservation**: On initialization, the element's original inline display style (e.g., `flex`, `grid`, `block`, or empty string `""`) is conserved in `__originalDisplay`.
3. **Switching from `false` to `true` (Enter Transition)**:
   - The element's CSS `display` style is immediately restored to its conserved `__originalDisplay` value.
   - The enter transition classes (`<name>-enter`, `<name>-enter-active`) are applied synchronously, followed by `<name>-enter-to` on the next animation frame.
4. **Switching from `true` to `false` (Leave Transition)**:
   - The element is **not** hidden immediately. Its `display` style remains active so the animation is visible.
   - The leave transition classes (`<name>-leave`, `<name>-leave-active`, `<name>-leave-to`) are applied.
   - A runtime exit callback waits for the CSS transition or animation to complete (listening to `transitionend`/`animationend` or fallback duration timeout). Once completed, the callback executes and sets `style.display = 'none'` on the element.

### Complete Visual Example

Here is a complete component example coupling a reactive visibility toggle with a CSS fade-and-scale transition:

```html
<style>
  /* Define transition animations */
  .pop-enter-active,
  .pop-leave-active {
    transition:
      opacity 0.3s ease,
      transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .pop-enter,
  .pop-leave-to {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
  }

  .pop-enter-to,
  .pop-leave {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  /* Custom flex container whose display state is conserved in __originalDisplay */
  .notification-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background-color: #1e293b;
    color: #f8fafc;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
</style>

<div class="app-container">
  <button @click="state.showNotification = !state.showNotification">Toggle Notification</button>

  <!-- Wrapping with <transition> tag -->
  <transition name="pop">
    <div class="notification-card" data-ax-show="state.showNotification">
      <span>🚀 Your changes have been successfully saved!</span>
      <button @click="state.showNotification = false">✕</button>
    </div>
  </transition>
</div>
```

In this example:

- When `state.showNotification` is set to `true`, the card's `display` reverts to `flex` (restored from `__originalDisplay`) and scales/fades in using the `.pop-enter*` classes.
- When `state.showNotification` is set to `false`, the `.pop-leave*` classes scale and fade the card out while it remains in `display: flex`. Only after the 300ms transition finishes does the runtime exit callback apply `display: none`.

---

## Page-Level Transitions

Route changes can be animated by passing a `transition` option to `mountPage`. The old page's children are wrapped in an `ax-page-exit-wrapper` div that runs the leave transition, while the new page's children simultaneously run the enter transition.

```javascript
app.mountPage('PageB', {}, { transition: 'fade' });
```

The transition name can also be defined per route or globally on the router:

```javascript
const router = new AvenxRouter(app, {
  transition: 'fade',
});
```

```javascript
const router = new AvenxRouter(app, {
  routes: {
    home: { page: 'HomePage', transition: 'slide-fade' },
    about: { page: 'AboutPage' },
  },
});
```

---

## Summary

| Concept          | Behaviour                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Default name     | `ax` when `name` is omitted                                                                                            |
| Dynamic name     | `name="{{ expr }}"` for runtime resolution                                                                             |
| Runtime fallback | Any `<transition>` elements surviving compile time are flattened by `DomPatcher`                                       |
| Cleanup trigger  | `transitionend` / `animationend` events or computed duration + 50 ms timeout                                           |
| Class sequence   | `-enter` → `-enter-active` → `-enter-to` (enter); `-leave` → `-leave-active` → `-leave-to` (leave)                     |
| Rapid toggle     | In-progress transitions are cancelled immediately via `_cleanupTransition`                                             |
| Visibility hooks | Works with `data-ax-show`; restores `__originalDisplay` on enter, defers `display: none` until leave callback finishes |
