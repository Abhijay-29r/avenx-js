---
title: 'Migrating from React to Avenx-JS'
description: 'Comprehensive guide for migrating React applications, components, state, hooks, effects, and data fetching to Avenx-JS.'
---

This guide details how to migrate applications built with **React** to **Avenx-JS**.

---

## 1. Architectural Overview & Mental Model Shift

React components are JavaScript functions returning JSX elements, where state updates trigger functional re-evaluations. Avenx-JS components use companion files (`.component.js` and `.component.css`), compiling to ES classes backed by Proxy reactivity.

| Concept | React | Avenx-JS |
| :--- | :--- | :--- |
| **Component File** | `.jsx` / `.tsx` | `.component.js` (logic/template) + `.component.css` (scoped styles) |
| **State Declaration** | `useState(initial)` | `<state key="val" />` tag |
| **Derived State** | `useMemo(() => fn)` | `<computed name="x" value="..." />` tag |
| **Side Effects** | `useEffect(fn, [deps])` | `onMount()` and `onUnmount()` lifecycle methods |
| **Data Fetching** | `useEffect` + `fetch` / TanStack Query | `<resource name="...">` tag + `<@suspense>` |

---

## 2. Component Structure and Props

*This section will document companion file structure, `data-props-*` prop passing, `this.props`, and `<slot>` transclusion.*

---

## 3. State and Reactivity

*This section will document `<state />` tag usage, Proxy state mutations, JSON attribute coercion, and `<computed />` properties.*

---

## 4. Effects and Lifecycle

React runs side effects with `useEffect` and tears them down with the function it returns. Avenx-JS replaces both with explicit class lifecycle hooks: `onMount()` runs **once**, right after the component element is mounted to the document DOM, and `onUnmount()` runs right before the instance is detached. There is no dependency array and no returned cleanup function — teardown logic lives in its own hook.

### Replacing `useEffect(fn, [])` with `onMount()`

Initial DOM setup, timer initialization, and global event listeners belong in `onMount()`. Because the component is already attached to the document, you can query the DOM through `this.el` and safely reach `window` / `document`.

#### Before — React `useEffect` with Cleanup

```jsx
import { useState, useEffect } from 'react';

export function TimerComponent() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return <div>Active for: {seconds}s</div>;
}
```

#### After — Avenx-JS Lifecycle Hooks

```html
<!-- src/components/timer/timer.component.js -->
<state seconds="0" />

<action name="onMount">
  this.timer = setInterval(() => {
    state.seconds++;
  }, 1000);
</action>

<action name="onUnmount">
  if (this.timer) clearInterval(this.timer);
</action>

<div>Active for: {{ state.seconds }}s</div>
```

State mutated inside `onMount()` flows into the template automatically — `{{ state.seconds }}` re-evaluates on every tick without any `setSeconds` call or effect re-run.

### Moving Teardown Logic into `onUnmount()`

React's cleanup function (`clearInterval`, `removeEventListener`, ...) maps directly to `onUnmount()`. Store every handle you create during `onMount()` as a property on `this` so the teardown hook can reach it.

#### Before — React Event Listener with Cleanup

```jsx
import { useEffect } from 'react';

export function WindowSizeTracker() {
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized:', window.innerWidth);
    };
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div>Resize the window</div>;
}
```

#### After — Avenx-JS Listener Lifecycle

```html
<!-- src/components/window-size/window-size.component.js -->
<action name="onMount">
  this.handleResize = () => {
    console.log('Window resized:', window.innerWidth);
  };
  window.addEventListener('resize', this.handleResize);
</action>

<action name="onUnmount">
  if (this.handleResize) {
    window.removeEventListener('resize', this.handleResize);
  }
</action>

<div>Resize the window</div>
```

### Why There Are No Dependency Arrays

In React, `useEffect(fn, [dep])` re-runs the effect when `dep` changes, and forgetting a dependency closes over stale values. Avenx-JS never re-runs side-effect hooks on state changes: `onMount()` runs strictly once per mount, and template expressions re-evaluate automatically whenever reactive `state` mutates. There is nothing to synchronize — the template is already reactive, so the stale-closure class of bugs disappears.

### Pitfalls

:::caution
**No hook teardowns.** React `useEffect` returns a cleanup function that runs before the next effect run or on unmount. Avenx-JS isolates teardown inside the `onUnmount()` lifecycle hook — a returned function inside `onMount()` is ignored, so write the cleanup explicitly.
:::

- **Instance storage.** Keep timers, controllers, and event handlers as properties on `this` (e.g. `this.timer`, `this.handleResize`) so `onUnmount()` can reach them — do not rely on closure variables.
- **Guard against partial mounts.** Check truthiness (`if (this.timer)`) before tearing down, in case `onMount()` threw before assigning the handle.
- **Idempotent teardown.** `onUnmount()` can run for a component that never fully mounted; clearing a missing handle must be a no-op.
- **Don't mutate state in update hooks.** Mutating reactive state synchronously inside `onBeforeUpdate()` / `onUpdate()` triggers another update cycle (`AVX_R11`).

See the [Component Lifecycle Hooks](/core-concepts/lifecycle-hooks) reference for the full hook list and execution order, and the [Migration Overview](/migration/overview) for the high-level conceptual mapping from React.

---

## 5. Data Fetching and Async Patterns

*This section will document migrating fetching logic to `<resource>` tags, `<@suspense>`, and `<@errorBoundary>`.*
