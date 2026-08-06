---
title: 'Pages & Routing'
description: 'Set up client-side routing, nested pages, dynamic parameters, and guards.'
---

Avenx-JS features a built-in router designed for single-page applications. It handles hash-based navigation (e.g. `#/dashboard`), dynamic parameters, and guards.

## 1. Page Components (`.page.js`)

Pages are top-level components located inside `src/pages/`. They extend `AvenxPage` instead of `AvenxComponent`, enabling them to host child components dynamically.

## 2. Configuring the Router

Define routes in your `src/main.app.js` file by mapping path patterns to page names:

```javascript
import { AvenxApp } from 'avenx-core/runtime';
const app = new AvenxApp({ target: '#app' });
// Registering Pages (Normally automatically registered by compiler)
app.registerPage('Home', Home);
app.registerPage('Profile', Profile);
// Initialize router
app.initRouter({
  '/': 'Home',
  '/profile/:id': 'Profile',
  '*': 'Home', // Fallback route
});
```
### Keep-Alive Page Caching

Routes can enable page caching by setting the `keepAlive` option. Instead of destroying the page when navigating away, Avenx stores the page instance in an internal Least Recently Used (LRU) cache.

When the user returns to the same route, the cached page instance is restored instead of creating a new one. This preserves the page's DOM state, component state, and any user input that has not been cleared.

```javascript
app.initRouter({
  '/profile/:id': {
    page: 'Profile',
    keepAlive: true,
  },
});
```
When a cached page is restored, the `onActivate(params)` lifecycle hook is called with the latest route parameters. When navigating away from a cached page, `onDeactivate()` is called instead of `onUnmount()`.

This behavior is useful for pages that should preserve their state between navigations, such as dashboards, forms, or long lists.

### `keepAliveLimit`

The maximum number of inactive keep-alive page instances is controlled by the `keepAliveLimit` option passed to the `AvenxApp` constructor.

When navigating away from a page configured with `keepAlive: true`:

1. `onDeactivate()` runs and the page instance is moved into the internal LRU cache.
2. If caching another inactive page would exceed `keepAliveLimit`, the least recently used cached page is evicted.
3. The evicted page's `onUnmount()` lifecycle hook runs.

```javascript
const app = new AvenxApp({
  target: '#app',
  keepAliveLimit: 3,
});
```

With this configuration, navigating among four or more keep-alive pages retains only the three most recently used inactive page instances in memory. Older cached pages are automatically removed as needed.



## 3. Dynamic Route Parameters

Route segments starting with `:` are dynamic variables. The values parsed from the URL are automatically added to the Page component's `state` object and can be read inside templates or actions:

```html
<!-- src/pages/profile.page.js -->
<!-- state.id will contain the value from /profile/:id -->
<div class="profile">
  <h1>Viewing Profile ID: {{ id }}</h1>
</div>
```
### Query Parameters

The portion of a route hash after `?` is automatically parsed into an object and made available as `state.query`. This works alongside dynamic parameters (`:id`) and can be read the same way,in templates or actions:

```html
<!-- src/pages/dashboard.page.js -->
<!-- #/dashboard?tab=analytics&user=123 ->state.query.tab==='analytics' -->
    <div class="dashboard">
      <h1>Current tab: {{ query.tab }}</h1>
    </div>

```

Query parameters are also available inside component actions using `this.state.query`:

```javascript
//src/pages/dashboard.page.js
onMount() {
  const tab = this.state.query.tab;
  this.loadTabData(tab);
}
```
#### Type Coercion
While dynamic route parameters are always strings, query parameter values on the other hand are coerced based on their content:

| Raw value | Parsed as |
| ---- | ---- |
| `"true"` | Boolean `true` |
|`"false"` | Boolean `false`|
| A numeric string(e.g. `"123"`) |  `Number` (e.g.`123`) |
| Anything else | `String` |

```javascript
//#/settings?darkMode=true&fontSize=16&theme=blue
state.query={
  darkMode : true, //boolean
  fontSize:16,     //number
  theme: 'blue'   //string
}
```
:::note
If the route hash has no `?` segment,`state.query` is undefined rather than an empty object. Hence, check for its existence before accessing nested properties.
:::

### Wildcard Path Matchers

A `*` inside a route pattern acts as a catch-all wildcard, matching any subpath at that position — including nested segments separated by `/`. This is distinct from a route whose _entire_ pattern is `*`, which is a router-wide fallback (see [Configuring the Router](#2-configuring-the-router)); a pattern like `/docs/*` still only matches paths that start with `/docs/`:

```javascript
app.initRouter({
  '/docs/*': 'Docs',
});
```

The matched subpath is exposed as `state.wildcard`, just like a `:param` value:

```html
<!-- src/pages/docs.page.js -->
<!-- /docs/intro                -> state.wildcard === 'intro' -->
<!-- /docs/concepts/reactivity  -> state.wildcard === 'concepts/reactivity' -->
<div class="docs">
  <h1>Viewing: {{ wildcard }}</h1>
</div>
```
## Accessing Active Route Data

Components can access information about the currently active route using the reactive `$route` getter provided by `AvenxComponent`.

The `$route` object exposes the following properties:

| Property | Description |
| -------- | ----------- |
| `$route.params` | Contains the dynamic route parameters extracted from the current URL. |
| `$route.hash` | Returns the current route hash. |
| `$route.page` | Returns the active page associated with the current route. |

### Example

The following example shows how to access a route parameter inside a component:

```javascript
import { AvenxComponent } from "avenx-core/runtime";

export default class UserProfile extends AvenxComponent {
  onMount() {
    console.log(this.$route.params.id);
  }
}
```

If the current route is:

```text
#/profile/42
```

Then:

```javascript
this.$route.params.id; // "42"
```
## 4. In-Place Parameter Updates

:::caution
When navigating between routes that resolve to the **same page component class** (for example, from `#/profile/1` to `#/profile/2`), Avenx does **not** unmount and remount the page. It updates the route parameters and state on the existing page instance in place instead. This means `onMount()` and `onUnmount()` do **not** re-run during this kind of navigation — only `onUpdate()` fires.
:::
If a page relies solely on `onMount()` to fetch data based on a route parameter, that data becomes stale after navigating to a matching route with a different parameter, since `onMount()` only runs once, when the page is first mounted.
To react correctly to parameter changes, compare the incoming value against the previously seen value inside `onUpdate()`, and only re-fetch when it has actually changed:

```javascript
// src/pages/profile.page.js
onMount() {
  this._lastId = this.state.id;
  this.fetchProfile(this.state.id);
}
onUpdate() {
  if (this.state.id !== this._lastId) {
    this._lastId = this.state.id;
    this.fetchProfile(this.state.id);
  }
}
```

:::note
Guard the comparison against the previous value. `onUpdate()` runs after **every** page update, not just parameter changes, so without the check you would re-fetch on every unrelated state change too.
:::
See [Page Reuse During Navigation](/api-reference/page/#page-reuse-during-navigation) in the `AvenxPage` API reference for more detail on when a page instance is reused versus recreated.

## 5. Multi-Router Setup & Namespaces

Avenx-JS supports running **multiple independent `AvenxRouter` instances at the same time** on the same page — for example, a host application and one or more embedded micro-frontends, each with their own routes, pages, and navigation lifecycle.

### Isolating routers with `prefix`

Each router created via `app.initRouter(routes, options)` can be given a `prefix` in its options. A router only ever handles hashes that start with its own prefix — any hash that doesn't match is ignored completely by that router, including its wildcard route.
Route patterns are written **relative to the prefix**, not including it:

```javascript
// Host app — no prefix, owns the root of the hash space
const hostApp = new AvenxApp({ target: '#app' });
hostApp.registerPage('Home', Home);
hostApp.initRouter({
  '/': 'Home',
  '*': 'Home',
});
// Embedded widget — everything under #/widget/... belongs to this router
const widgetApp = new AvenxApp({ target: '#widget' });
widgetApp.registerPage('WidgetHome', WidgetHome);
widgetApp.initRouter(
  {
    '/home': 'WidgetHome', // matches #/widget/home
    '*': 'WidgetHome',
  },
  { prefix: '/widget' },
);
```

Navigating with `router.navigate(hash)` on a prefixed router automatically prepends its `prefix`, so calling `navigate('#/home')` on `widgetApp`'s router produces `#/widget/home`.

### Coordinating wildcard fallbacks with `window.__avenx_routers`

Every `AvenxRouter` registers itself in a global `window.__avenx_routers` set when it's created, and removes itself when `destroy()` is called. Routers use this registry to avoid stepping on each other's wildcard (`*`) fallback routes.
When a router can't match the current hash against any of its own named routes, it does **not** immediately fall back to its `*` route. Instead, it first checks every _other_ router registered in `window.__avenx_routers` to see whether one of them owns that hash (respecting each router's own `prefix`). Only if **no other router claims the hash** does the local wildcard fire.
This means, in the example above, if `hostApp`'s router doesn't have a matching route for `#/widget/home`, it won't incorrectly trigger its own `*` fallback — it detects that `widgetApp`'s router owns that hash and steps aside.
:::note
Only named routes count when checking whether another router "owns" a hash — wildcard routes are never considered a match by other routers, so two routers with `*` fallbacks never block each other.
:::
:::caution
Because routers coordinate through a shared global registry, always call `router.destroy()` when tearing down a router instance (for example, when unmounting a micro-frontend). A router left in `window.__avenx_routers` after it's no longer in use keeps its `hashchange` listener attached and continues to be consulted by other routers' fallback checks.
:::

## 6. Page Titles

When a route is resolved, the router can automatically update `document.title`. Add a `title` property to any route definition — either a static string or a dynamic function that receives the parsed route parameters:

```javascript
app.initRouter({
  '/':            { page: 'Home',    title: 'Home' },
  '/profile/:id': { page: 'Profile', title: (params) => `Profile ${params.id}` },
  '*':            { page: 'NotFound', title: 'Page Not Found' },
});
```

### Title Prefix & Suffix

To avoid repeating your app name in every route, pass `titlePrefix` or `titleSuffix` in the router options. They are prepended / appended to every resolved title automatically:

```javascript
app.initRouter(
  {
    '/':      { page: 'Home',    title: 'Home' },
    '/about': { page: 'About',  title: 'About Us' },
  },
  { titleSuffix: ' — MyApp' },
);
// Results in "Home — MyApp", "About Us — MyApp"
```

:::note
Routes that do not declare a `title` property leave `document.title` unchanged. This lets you opt individual routes out of automatic title management.
:::

## 7. Route Guards

Guards decide whether a transition to a page is allowed. Create a guard using the CLI:

```bash
npx avenx g guard auth
```

Implement the `canActivate(to, from)` method. Return a boolean, a redirect string, or a Promise:

```javascript
// src/guards/auth.guard.js
import { AvenxGuard } from 'avenx-core/runtime';
export default class AuthGuard extends AvenxGuard {
  canActivate(to, from) {
    // Return true to allow, false to block, or hash path to redirect
    if (to.hash === '#/dashboard' && !window.isLoggedIn) {
      return '#/login';
    }
    return true;
  }
}
```

:::caution
Redirect paths returned from `canActivate` must start with `#`. `AvenxRouter.navigate` only applies the configured `prefix` and namespace settings to hash paths — a path without the `#` prefix bypasses this resolution and can break navigation in apps served with a custom `prefix`.
:::warning
Redirect paths must start with a `#` prefix to ensure router prefix and namespace settings are respected.
:::
Map guards to routes in your application router initialization:

```javascript
app.initRouter({
  '/': 'Home',
  '/dashboard': { page: 'Dashboard', guards: [AuthGuard] },
});
```

---

## 8. Nested Routes & Layout Components

`AvenxRouter` supports **nested routing** and persistent **Layout components** (`children: [...]`, `layout: Component`), allowing child views to share persistent surrounding UI — such as navigation headers, sidebars, breadcrumbs, and footers — without re-rendering or unmounting the wrapper structure during navigation transitions.

### Route Configuration Schema

To configure nested routes, define a parent route object containing a `layout` component reference and a `children` array of child route definitions:

```javascript
import AppLayout from './layouts/app-layout.component.js';

app.initRouter({
  '/': { page: 'Home', title: 'Home' },

  // Parent route with layout and nested children
  '/admin': {
    layout: AppLayout,
    children: [
      { path: '/dashboard', page: 'AdminDashboard', title: 'Admin Dashboard' },
      { path: '/users', page: 'AdminUsers', title: 'User Management' },
      { path: '/settings', page: 'AdminSettings', title: 'System Settings' },
    ],
  },

  '*': { page: 'NotFound', title: 'Page Not Found' },
});
```

### Layout Component Structure

A Layout component acts as a shell that wraps nested child page components. During child route navigation, the Layout component remains mounted, preserving its internal reactive state, animations, and DOM tree:

```html
<!-- src/layouts/app-layout.component.js -->
<state activeTab="'dashboard'" />

<action name="navigateTab">
  const [tabPath] = args;
  this.state.activeTab = tabPath;
</action>

<div class="admin-layout">
  <!-- Persistent Sidebar Navigation -->
  <aside class="sidebar">
    <nav>
      <a href="#/admin/dashboard" @click="navigateTab('dashboard')">Dashboard</a>
      <a href="#/admin/users" @click="navigateTab('users')">Users</a>
      <a href="#/admin/settings" @click="navigateTab('settings')">Settings</a>
    </nav>
  </aside>

  <!-- Child View Mount Target -->
  <main class="content-view">
    <slot></slot>
  </main>
</div>
```

---

### Key Behavior & Features

#### 1. Layout Persistence During Transitions

When navigating between child routes sharing the same parent `layout` (for example, moving from `#/admin/dashboard` to `#/admin/users`), `AvenxRouter` keeps the `AppLayout` instance intact. Only the child page component mounted inside the `<slot>` is swapped out. This eliminates layout flicker, preserves sidebar scroll positions, and prevents re-triggering API calls in `AppLayout.onMount()`.

#### 2. Parameter Inheritance

Child routes automatically inherit dynamic path parameters defined on parent route paths.

```javascript
app.initRouter({
  '/org/:orgId': {
    layout: OrgLayout,
    children: [
      { path: '/members/:memberId', page: 'MemberDetail' },
    ],
  },
});
```

When navigating to `#/org/acme-corp/members/42`:
- Parent parameter `:orgId` = `'acme-corp'`
- Child parameter `:memberId` = `'42'`
- Both parameters are merged and passed into `MemberDetail` page component props and `$route.params` (`{ orgId: 'acme-corp', memberId: '42' }`).

#### 3. Multi-Level Layout Nesting

`AvenxRouter` supports arbitrary levels of layout nesting. Each nested route layer renders its corresponding `layout` component, creating modular nested UI views:

```javascript
app.initRouter({
  '/app': {
    layout: GlobalAppLayout,
    children: [
      {
        path: '/workspace/:id',
        layout: WorkspaceLayout,
        children: [
          { path: '/kanban', page: 'KanbanPage' },
          { path: '/timeline', page: 'TimelinePage' },
        ],
      },
    ],
  },
});
```

