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

React keeps state in `useState` hooks and updates it through setter functions (`setCount(c => c + 1)`); every update re-runs the component function. Avenx-JS instead declares state declaratively in a single `<state />` tag and mutates it **directly** — `state.count++` — because the state object is a reactive `Proxy` that schedules a re-render for you. There are no setters, no `setState`, and no component re-runs; the template simply re-evaluates against the mutated proxy. See the [Reactive State](/core-concepts/reactivity) guide for the full model, and the [Migration Overview](/migration/overview) for where this fits in the paradigm map.

### Declaring State

A React component can hold many independent `useState` hooks. In Avenx-JS, all of them collapse into **one** `<state />` tag per component — each attribute is one state property.

#### Before — Multiple React `useState` Hooks

```jsx
import { useState } from 'react';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  // ...
}
```

#### After — One Avenx `<state />` Tag

```html
<!-- src/components/search-panel/search-panel.component.js -->
<state query="" results="[]" loading="false" />

<!-- state.query, state.results, state.loading are all reactive -->
```

:::caution
**Single `<state />` rule.** Only the **first** `<state />` tag in a component is parsed — declaring a second one silently drops the secondary state. Keep every property on the one tag, or merge into an object.
:::

### JSON Attribute Coercion

Attribute values on `<state />` are always strings unless you tell the compiler otherwise. **Arrays and objects must be written as valid JSON, wrapped in single quotes** so the double-quoted JSON survives HTML attribute parsing.

```html
<state items='[{"id": 1, "name": "Item A", "price": 10}]' user='{"name": "Ada", "role": "admin"}' />
```

- Object keys and string values use **double quotes** (`"name": "Item A"`), not single quotes.
- The whole JSON payload is wrapped in **single quotes** on the attribute (`items='...'`).
- Primitives stay plain: `count="0"`, `title="Hello"`, `enabled="true"` are coerced to number, string, and boolean respectively.

### Mutating State

React forbids direct mutation and requires a new reference (`[...items, newItem]`) so the re-render has something to diff. Avenx's Proxy observes the mutation itself, so you write the natural imperative form.

#### Before — React Setter with Immutable Update

```jsx
import { useState } from 'react';

const [items, setItems] = useState([{ id: 1, name: 'Item A', price: 10 }]);

const addItem = () => {
  setItems([...items, { id: 3, name: 'Item C', price: 15 }]);
};
```

#### After — Direct Proxy Mutation

```html
<!-- Avenx-JS -->
<state items='[{"id": 1, "name": "Item A", "price": 10}]' />

<action name="addItem">
  state.items.push({ id: 3, name: 'Item C', price: 15 });
</action>
```

`state.items.push(...)` mutates the array in place; the Proxy trap notices and schedules the update. The same applies to objects (`state.user.role = 'admin'`) and to the `++` / `--` operators on primitives (`state.count++`).

### Derived Values with `<computed />`

React derives values with `useMemo` and a dependency array, then re-runs the memo when a listed dep changes. Avenx's `<computed />` tag caches a getter and re-evaluates it automatically when any state property it reads changes — no dependency array to maintain, and no stale closure risk because the expression reads `state` directly.

#### Before — React `useMemo` with Dependencies

```jsx
import { useState, useMemo } from 'react';

const [items, setItems] = useState([{ id: 1, name: 'Item A', price: 10 }]);
const [discount, setDiscount] = useState(5);

const total = useMemo(
  () => items.reduce((sum, item) => sum + item.price, 0) - discount,
  [items, discount]
);
```

#### After — Avenx `<computed />` Tag

```html
<!-- Avenx-JS -->
<state items='[{"id": 1, "name": "Item A", "price": 10}]' discount="5" />
<computed name="total" value="state.items.reduce((sum, item) => sum + item.price, 0) - state.discount" />

<p>Total: ${{ total }}</p>
```

The computed reads `state.items` and `state.discount` during its first evaluation, so the dependency graph is built automatically. Change either and `total` updates everywhere it is rendered. See the [Computed Properties](/core-concepts/computed) guide for caching and the `AVX_R04` circular-dependency guard.

### Batching

React batches state updates within event handlers; Avenx batches **every** mutation through a microtask scheduler. Assign several properties in one action and the DOM patches once, after the microtask flushes:

```javascript
<action name="updateUser">
  state.name = 'John';
  state.role = 'admin';
  // Both assignments are queued; the template renders ONCE.
</action>
```

> [!TIP]
> Because the flush is async, reading DOM measurements immediately after mutating `state` returns pre-update values. Use the `nextTick` utility to run code after the scheduler finishes — see [Microtask Scheduler & `nextTick`](/core-concepts/reactivity#microtask-scheduler--nexttick-utility).

### Key Conceptual Differences & Pitfalls

- **Immutable vs mutable**: React requires new references; Avenx allows direct mutation (`push`, `++`, property assignment) because the Proxy observes it.
- **Single `<state />` tag**: extra tags are silently ignored — merge everything into one.
- **JSON syntax for structured values**: arrays/objects in `<state>` attributes need double-quoted JSON inside single-quoted attributes (`items='[{"id": 1}]'`).
- **No setters or hooks**: `useState`/`setCount`/`useMemo` have no Avenx equivalent — the template is already reactive, so mutation alone re-renders.
- **Batching is automatic**: multiple mutations flush in one microtask; use `nextTick` if you must observe the DOM right after a mutation.

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

React data fetching typically combines `useEffect` with manual `loading` / `error` state flags, or delegates to a library like TanStack Query. Avenx-JS provides built-in reactive data fetching through the [`<resource>` SFC tag & `Resource` API](/core-concepts/resources): a resource declares *what* to fetch, tracks the reactive state it reads, and re-fetches automatically when that state changes — with `<@suspense>` and `<@errorBoundary>` handling loading and failure declaratively. See the [Migration Overview](/migration/overview) for where fetching fits in the overall paradigm map.

### 5.1 Replacing Manual Fetch Effects

React's canonical pattern is a `useEffect` with manual flags:

```jsx
// React: manual loading/error flags + effect + cleanup
import { useState, useEffect } from 'react';

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Loading user...</div>;
  if (error) return <div>Failed to load user: {error.message}</div>;

  return <div>Welcome, {user.name}!</div>;
}
```

The `<resource>` tag replaces the effect, the manual flags, and the `return`-based conditional rendering in one step:

```html
<!-- Avenx-JS: src/components/user-profile/user-profile.component.js -->
<state userId="1" />
<resource name="userData">
  return fetch(`/api/users/${state.userId}`).then(res => res.json());
</resource>

<@errorBoundary>
  <@suspense>
    <div>
      Welcome, {{ userData.value.name }}!
    </div>
    <@fallback>
      <div>Loading user...</div>
    </@fallback>
  </@suspense>
  <@fallback as="err">
    <div>Failed to load user: {{ err.message }}</div>
  </@fallback>
</@errorBoundary>
```

> [!NOTE]
> `useEffect`'s dependency array (`[userId]`) has no Avenx equivalent — it isn't needed. The resource reads `state.userId` during its handler, so `AvenxWatcher` registers it as a dependency automatically (see [5.2](#52-automatic-dependency-tracking)).

### 5.2 Automatic Dependency Tracking

When a `<resource>` handler reads reactive state (like `state.userId` or `state.filter`), that property is registered as a dependency. The next time it mutates, the resource **re-fetches automatically** — no effect, no dependency array, no manual re-trigger:

```jsx
// React: effect + deps + manual state to retrigger
function UserPosts({ userId }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}/posts`).then(r => r.json()).then(setPosts);
  }, [userId]);

  return <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

```html
<!-- Avenx-JS: changing state.userId re-fetches automatically -->
<state userId="1" />
<resource name="posts">
  return fetch(`/api/users/${state.userId}/posts`).then(r => r.json());
</resource>

<ul>
  <li data-ax-for="post in posts.value" key="post.id">
    {{ post.title }}
  </li>
</ul>
```

> [!TIP]
> A single resource can track many dependencies. Reading `state.filter`, `state.page`, and `state.search` in one handler means updating any of them re-fetches with the current values — the equivalent of a React effect with a multi-entry dependency array.

### 5.3 Suspense Loading Boundaries

React Suspense needs a fallback on the nearest boundary and a throwing promise to suspend on. Avenx-JS does the same with `<@suspense>` and `<@fallback>` — the resource's `.read()` semantics (see the [`<resource>` guide](/core-concepts/resources)) throw while pending, and the boundary renders the fallback until the data resolves:

```jsx
// React: <Suspense fallback={<div>Loading user...</div>}>
```

```html
<!-- Avenx-JS -->
<@suspense>
  <div>Welcome, {{ userData.value.name }}!</div>
  <@fallback>
    <div>Loading user...</div>
  </@fallback>
</@suspense>
```

### 5.4 Error Boundary Wrapping

Wrapping `<@suspense>` in `<@errorBoundary>` keeps the loading fallback and the error UI in one place. The boundary's `<@fallback as="err">` receives the rejection reason, mirroring React's `componentDidCatch` / `errorElement`:

```jsx
// React: error boundary class + fallback UI per boundary
```

```html
<!-- Avenx-JS -->
<@errorBoundary>
  <@suspense>
    <div>Welcome, {{ userData.value.name }}!</div>
    <@fallback>
      <div>Loading user...</div>
    </@fallback>
  </@suspense>
  <@fallback as="err">
    <div>Failed to load user: {{ err.message }}</div>
  </@fallback>
</@errorBoundary>
```

### 5.5 No Manual State Flags

React's `isLoading` / `error` booleans are redundant in Avenx-JS. Every resource exposes reactive `status`, `value`, and `error` properties that the template reads directly — e.g. `data-ax-show` for status-driven UI, or the Suspense/Error boundary pattern above:

| React flag | Avenx-JS reactive property |
| :--- | :--- |
| `loading === true` | `resource.status === 'pending'` |
| `data` | `resource.value` |
| `error` | `resource.error` |

```html
<!-- Status-driven rendering without <@suspense> (e.g. inline spinners) -->
<div data-ax-show="userData.status === 'pending'">Loading user...</div>
<div data-ax-show="userData.status === 'rejected'">{{ userData.error.message }}</div>
<div data-ax-show="userData.status === 'resolved'">Welcome, {{ userData.value.name }}!</div>
```

### 5.6 Background Polling

React polling means `setInterval` + cleanup inside an effect. Set `pollInterval` (milliseconds) on the `<resource>` tag instead — the framework owns the timer and clears it on unmount (`resource.teardown()`):

```jsx
// React: setInterval + clearInterval cleanup
useEffect(() => {
  const id = setInterval(() => {
    fetch('/api/metrics').then(r => r.json()).then(setMetrics);
  }, 5000);
  return () => clearInterval(id);
}, []);
```

```html
<!-- Avenx-JS: re-fetches every 5s in the background -->
<resource name="metrics" pollInterval="5000">
  return fetch('/api/metrics').then(r => r.json());
</resource>
```

### 5.7 Key Conceptual Differences & Pitfalls

- **No manual `isLoading` / `error` flags**: the resource's reactive `status`, `value`, and `error` replace them; prefer `<@suspense>` / `<@errorBoundary>` over hand-rolled conditionals.
- **No dependency arrays**: dependencies are *observed*, not declared. Refs to `state.*` inside the handler are tracked by `AvenxWatcher`; mutating one re-fetches automatically.
- **Fallbacks nest, they don't wrap**: the loading fallback goes *inside* `<@suspense>`, the error fallback goes *inside* `<@errorBoundary>` — not the other way around.
- **`value` vs `error` by status**: `resource.value` is `undefined` until `resolved`; `resource.error` is set only on `rejected`. Guard template reads with the status or a boundary rather than assuming `value` is populated.
- **Polling cleans itself up**: `pollInterval` timers are cleared by `teardown()` on unmount; there is no effect cleanup to forget.
