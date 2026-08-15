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

*This section will document replacing `useEffect` hooks with `onMount()` and `onUnmount()` class methods.*

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
