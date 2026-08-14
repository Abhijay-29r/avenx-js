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

*This section will document migrating fetching logic to `<resource>` tags, `<@suspense>`, and `<@errorBoundary>`.*
