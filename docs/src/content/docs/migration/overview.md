---
title: 'Migration Overview & Architectural Comparison'
description: 'High-level guide and conceptual mapping for migrating from React, Vue, Next.js, and Angular to Avenx-JS.'
---

Migrating to **Avenx-JS** involves transitioning from traditional Virtual DOM, Single File Component (SFC), or heavy dependency injection paradigms to a lightweight, compiler-assisted architecture built around component companion files, proxy reactivity, and explicit routing.

This overview outlines core conceptual mappings, architectural shifts, and terminology equivalents across **React**, **Vue**, **Next.js**, and **Angular**.

---

## High-Level Paradigm Comparison

| Architectural Aspect | React | Vue 3 | Next.js | Angular | Avenx-JS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Component Format** | `.jsx` / `.tsx` (JSX functions) | `.vue` (Single File Component) | `.jsx` / `.tsx` (App Router / Pages) | `.ts` + `.html` + `.scss` (Decorators/Classes) | `.component.js` + `.component.css` companion files |
| **Reactivity System** | Explicit Hooks (`useState`) | Proxy-based (`ref`, `reactive`) | React Hooks / RSC | Signals / RxJS RxJS Observables | Proxy-based `<state />` tags with automatic microtask batching |
| **Derived Values** | `useMemo` / inline recalculation | `computed()` | Server/Client state computation | `computed()` / RxJS pipes | `<computed name="..." value="..." />` tags |
| **Methods / Actions** | JavaScript functions in scope | Component functions in `script` | Client/Server functions | Class methods | `<action name="...">...</action>` tags |
| **Async Data Fetching** | `useEffect` + `fetch` / TanStack Query | `onMounted` + `fetch` / `useAsyncData` | Server Components / `use` | `HttpClient` + RxJS Observables | `<resource name="...">` tag & `Resource` class with Suspense support |
| **Shared / Global State** | Context API / Redux / Zustand | Pinia / Vuex | React Context / Zustand | Services (Injectable singletons) | **Bridges** (`AvenxBridge` classes in `src/global/*.bridge.js`) |
| **Styling Paradigm** | CSS Modules / Styled Components / Tailwind | Scoped CSS (`<style scoped>`) | CSS Modules / Tailwind | Component Scoped Styles (`styleUrls`) | Scoped CSS via `<@css>` blocks and `@css` attribute/tag binding |
| **Client-Side Routing** | React Router (`<Routes>`) | Vue Router (`createRouter`) | File-based Routing / App Router | Angular Router (`RouterModule`) | `AvenxRouter` hash routing configured in `src/main.app.js` |
| **Rendering Strategy** | Client-Side Virtual DOM | Virtual DOM | SSR / SSG / Client-Side | Real DOM manipulation via Zone.js/Signals | Compiler static analysis + client-side `DomPatcher` |

---

## Core Mental Model Shifts in Avenx-JS

### 1. Companion File Component Architecture
Unlike Vue (all-in-one `.vue` files) or React (JSX returning JS functions), Avenx-JS separates component logic and template from styling into companion files:
- **`src/components/<name>/<name>.component.js`**: Logic tags (`<state>`, `<computed>`, `<action>`, `<resource>`) and HTML template.
- **`src/components/<name>/<name>.component.css`**: Scoped styling using `<@css>` blocks.

For top-level views, **Page Components** (`src/pages/<name>/<name>.page.js`) extend `AvenxPage` to allow mounting child components (`<Navbar />`, `<Card />`). Standard `.component.js` components do not mount nested child components.

### 2. State & Reactivity Syntax
State is declared at the top of the `.component.js` file using a **single unified `<state />` tag**:
```html
<state count="0" username="Guest" tags='["dev", "web"]' user='{"name": "Alice"}' />
```
- Primitive attributes (`count="0"`, `username="Guest"`) are automatically coerced into JavaScript numbers, strings, or booleans.
- Objects and arrays must be passed as valid JSON strings wrapped in single quotes (`tags='["dev", "web"]'`).
- Mutating `state.count = 1` inside an action or lifecycle hook automatically triggers a microtask-batched DOM update via `DomPatcher`.

### 3. Derived Logic & Actions
Instead of inline hooks or methods, derived values and methods use declarative compiler tags:
```html
<computed name="doubleCount" value="state.count * 2" />
<action name="increment"> state.count++; </action>
```

### 4. Directives & Control Flow
- **Loops**: Use `<@for item in state.items key="item.id">` with an implicit zero-indexed `index` variable.
- **Visibility**: Use `data-ax-show="state.isVisible"` (toggles inline CSS `display` while preserving original display style).
- **Two-Way Binding**: Use `data-ax-bind="state.username"` for input/textarea/select text values.
- **Conditional Templates**: Conditional rendering is achieved using inline ternary expressions inside interpolations (`{{{ state.show ? '<div>...</div>' : '' }}}`) or `data-ax-show`.

### 5. Async Data Loading with Resources
Async data operations use the built-in `<resource>` tag and runtime `Resource` API:
```html
<resource name="userData">
  return fetch(`/api/users/${state.userId}`).then(res => res.json());
</resource>
```
Resources automatically track state dependencies (`state.userId`), trigger re-fetches on state change, and integrate with `<@suspense>` and `<@errorBoundary>`.

### 6. Shared State via Bridges
Global state is managed by creating bridge classes extending `AvenxBridge` in `src/global/<name>.bridge.js`:
```javascript
// src/global/auth.bridge.js
import { AvenxBridge } from 'avenx-core/runtime';

export default class AuthBridge extends AvenxBridge {
  constructor() {
    super();
    this.user = null;
    this.isLoggedIn = false;
  }

  logout() {
    this.user = null;
    this.isLoggedIn = false;
  }
}
```
Bridges are automatically available in component templates and actions under `<BridgeName>` (e.g. `AuthBridge.user.name` and `@click="AuthBridge.logout()"`).

---

## Summary Matrix: Equivalents Cheat Sheet

| React Concept | Vue Concept | Angular Concept | Avenx-JS Equivalent |
| :--- | :--- | :--- | :--- |
| `useState(initial)` | `ref(initial)` / `reactive()` | `signal(initial)` | `<state prop="val" />` tag |
| `useMemo(() => fn)` | `computed(() => fn)` | `computed(() => fn)` | `<computed name="x" value="..." />` |
| Callback functions | `methods: { ... }` | Class methods | `<action name="x"> ... </action>` |
| `useEffect(fn, [])` | `onMounted(fn)` | `ngOnInit()` | `onMount()` lifecycle hook |
| `useEffect(cleanup)` | `onUnmounted(fn)` | `ngOnDestroy()` | `onUnmount()` lifecycle hook |
| `{items.map(item => ...)}` | `v-for="item in items"` | `*ngFor="let item of items"` | `<@for item in state.items key="item.id">` |
| `style={{ display }}` | `v-show="isVisible"` | `[hidden]="!isVisible"` | `data-ax-show="state.isVisible"` |
| `onChange={(e) => ...}` | `v-model="state.val"` | `[(ngModel)]="val"` | `data-ax-bind="state.val"` |
| `<Context.Provider>` / Redux | Pinia store | `@Injectable()` Service | `AvenxBridge` class |
| React Router `<Route>` | Vue Router `routes: []` | `RouterModule.forRoot()` | `app.initRouter({ '/path': 'Page' })` |
| `React.lazy` + `Suspense` | Async Component + `Suspense` | Defer block `{@defer}` | `<resource>` + `<@suspense>` / `<@defer>` |

---

## Detailed Migration Guides

Choose your framework to explore step-by-step migration patterns:

- **React to Avenx-JS**: Component model, Reactivity, Effects, Styling, State Management.
- **Vue to Avenx-JS**: SFC translation, Templates & Directives, Reactivity, Composition API alternatives.
- **Svelte to Avenx-JS**: Runes / `$:` reactivity translation, Companion files, Store conversion to Bridges, Directives & Event modifiers.
- **Next.js to Avenx-JS**: Router setup, Client-side data fetching, Server/Client decoupling.
- **Angular to Avenx-JS**: Services to Bridges, Dependency Injection alternatives, Template syntax migration.
