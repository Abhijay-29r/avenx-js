---
title: 'AvenxRouter & Guard API'
description: 'API documentation for routing hooks, guards, navigation, and page lifecycle management.'
---

Classes responsible for navigation controls and route access authorization.

## AvenxRouter

Created by calling `AvenxApp.initRouter(routes, options)`.

### Configuration Options

The second argument to `initRouter` is an optional `options` object that controls router behavior:

| Option                 | Type     | Default     | Description                                                                                                                                                                                                       |
| ---------------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefix`               | `string` | `''`        | A base path prepended to every route hash. Useful when the app is served from a subdirectory (e.g. `'/app'` turns `#/dashboard` into `#/app/dashboard`).                                                          |
| `guardTimeout`         | `number` | `5000`      | Maximum time, in milliseconds, a guard's `canActivate` is allowed to take (including async/promise-based guards) before the navigation is considered stalled and `AVX_R14` (`ROUTER_GUARD_TIMEOUT`) is triggered. |
| `guardTimeoutRedirect` | `string` | `undefined` | A hash path to redirect to automatically if a guard times out, instead of leaving navigation stalled. If omitted, a timed-out guard simply denies the transition.                                                 |
| `titlePrefix`          | `string` | `''`        | A string prepended to every resolved route title. Use this to add application-wide branding, such as `MyCompany | `.                                                                                                |
| `titleSuffix`          | `string` | `''`        | A string appended to every resolved route title. Use this to add consistent branding, such as ` | MyCompany`.                                                                                                      |
| `transition`           | `string` | `'none'`    | Enables a named transition effect (e.g. `'fade'`, `'slide'`) applied to the page container when navigating between routes.                                                                                        |

```javascript
const router = AvenxApp.initRouter(routes, {
  prefix: '/app',
  guardTimeout: 8000,
  guardTimeoutRedirect: '#/login',
  titlePrefix: 'MyCompany | ',
  titleSuffix: ' | Avenx',
  transition: 'fade',
});

const brandingRouter = AvenxApp.initRouter(
  {
    '#/': { page: 'Home', title: 'Home' },
    '#/profile/:id': {
      page: 'Profile',
      title: (params) => `Profile ${params.id}`,
    },
  },
  {
    titlePrefix: 'MyCompany | ',
    titleSuffix: ' | Avenx',
  },
);

// Results in:
// "MyCompany | Home | Avenx"
// "MyCompany | Profile 42 | Avenx"
```

### Methods

- ### `navigate(hash)`
  Programs a programmatic navigation to the specified route hash. It updates the browser history and triggers the matching route lifecycle.

- ### `beforeEach(callback)`
  Registers a global guard callback or `AvenxGuard` instance/class that runs before every route transition.
  - **Arguments:** `callback: Function | typeof AvenxGuard | AvenxGuard`
  - **Returns:** `Function` (Unregister function)

- ### `afterEach(callback)`
  Registers a global hook callback executed after successful route navigation completes.
  - **Arguments:** `callback: Function`
  - **Returns:** `Function` (Unregister function)

- ### `destroy()`
  Tears down the active router instance. It cleans up all global event listeners (like `hashchange` or `popstate`), unmounts the active route component, and releases internal memory references to prevent leaks.

- ### `matches(hash)`

  **Signature:** `router.matches(hash: string): boolean`

  Evaluates `hash` against registered route definitions **without navigating**.
  Useful for validating external links, breadcrumbs, or nav UI state before
  calling `navigate` / `setHash`.

  **Matching rules**
  - Compares against explicitly registered route patterns in the router table.
  - Applies URI decoding (`decodeURIComponent`) so percent-encoded path
    segments still match the registered pattern.
  - Excludes wildcard / fallback routes (e.g. `'*'`), so a hash that only
    matches the catch-all returns `false`.

  **Returns:** `true` when an explicit route pattern matches; otherwise `false`.

  **Example**

  ```javascript
  const router = AvenxApp.initRouter([
    { path: '/home', component: Home },
    { path: '/users/:id', component: User },
    { path: '*', component: NotFound },
  ]);

  router.matches('#/home');          // true
  router.matches('#/users/42');      // true
  router.matches('#/unknown');       // false (wildcard-only does not count)
  router.matches('#/users/%2E%2E');  // decoded before match
  ```


---

## Registering Route Guards

Guards can be registered either per route in the router configuration or globally across all routes.

### Route-Level Guards

Attach an array of guard classes or instances to individual route definitions in `initRouter`:

```javascript
import { AvenxApp } from 'avenx-core/runtime';
import AuthGuard from './guards/auth.guard.js';
import AdminGuard from './guards/admin.guard.js';

AvenxApp.initRouter({
  '#/': 'Home',
  '#/login': 'Login',
  '#/dashboard': {
    page: 'Dashboard',
    guards: [AuthGuard],
  },
  '#/admin': {
    page: 'AdminSettings',
    guards: [AuthGuard, AdminGuard],
  },
});
```

When navigating to `#/admin`, the router executes `AuthGuard` first, followed by `AdminGuard`. If any guard returns `false` or a redirect target, subsequent guards in the chain are skipped and navigation halts or redirects immediately.

### Global Navigation Guards

Use `router.beforeEach()` to register guards that execute before **every** route transition:

```javascript
const router = AvenxApp.initRouter(routes);

// Register a global guard function or class
const unregister = router.beforeEach((to, from) => {
  if (to.hash.startsWith('#/admin') && !window.isAdmin) {
    return '#/unauthorized';
  }
  return true;
});

// Clean up when no longer needed
unregister();
```

### `beforeEach(callback)`

Registers a global navigation hook that runs before every navigation.

- **Arguments:**
  - `callback: (to, from) => boolean | string | Promise<boolean | string>`
- **Returns:** `() => void`

The returned function unregisters the hook. Call it when the hook is no longer needed (for example, during component teardown) to prevent listener leaks.

```javascript
const unregister = router.beforeEach((to, from) => {
  console.log(`Navigating from ${from.hash} to ${to.hash}`);
  return true;
});

// Later
unregister();
```

### `afterEach(callback)`

Registers a global navigation hook that runs after every successful navigation.

- **Arguments:**
  - `callback: (to, from) => void`
- **Returns:** `() => void`

The returned function removes the registered hook.

```javascript
const unregister = router.afterEach((to, from) => {
  console.log(`Navigation completed: ${to.hash}`);
});

// Later
unregister();
```

---

## Unregistering Global Navigation Hooks

Both `beforeEach()` and `afterEach()` return an unregister function (`() => void`).

When registering global hooks dynamically inside components or services, always call the returned unregister function during lifecycle teardown (e.g., inside `onUnmount()` or a class `destroy()` method) to prevent memory leaks and dangling callback references across page transitions.

### Execution Order

Multiple registered `beforeEach` and `afterEach` hooks execute **sequentially in registration order**. If a `beforeEach` hook returns `false` or a redirect path string, execution halts immediately and subsequent hooks in the sequence are skipped.

```javascript
router.beforeEach(() => console.log('First'));
router.beforeEach(() => console.log('Second'));

// Output:
// First
// Second
```

### Lifecycle Teardown Examples

#### Component Lifecycle (`onUnmount`)

```javascript
import { onMount, onUnmount } from 'avenx';

export class FeatureComponent {
  private unregisterBefore: () => void;
  private unregisterAfter: () => void;

  onMount() {
    // Register hooks and store their unregister callbacks
    this.unregisterBefore = router.beforeEach((to, from) => {
      // Guard logic
      return true;
    });

    this.unregisterAfter = router.afterEach((to, from) => {
      // Post-navigation tracking logic
    });
  }

  onUnmount() {
    // Clean up callbacks on unmount
    if (this.unregisterBefore) this.unregisterBefore();
    if (this.unregisterAfter) this.unregisterAfter();
  }
}
```

#### Service / Class Lifecycle (`constructor` / `destroy`)

```javascript
export class NavigationLogger {
  private unregister: () => void;

  constructor(router) {
    this.unregister = router.afterEach((to) => {
      console.log(`Navigated to: ${to.hash}`);
    });
  }

  destroy() {
    if (this.unregister) this.unregister();
  }
}
```

## The `AvenxGuard` Class

The `AvenxGuard` class allows you to intercept navigation requests before a route is fully loaded. Custom route guards should extend this base class.

```javascript
import { AvenxGuard } from 'avenx-core/runtime';

export default class CustomGuard extends AvenxGuard {
  canActivate(to, from) {
    return true;
  }
}
```

### `canActivate(to, from)`

This lifecycle method is executed prior to entering a route.

- **Parameters:**
  - `to`: The target route object being navigated to (contains `hash`, `page`, `params`, etc.).
  - `from`: The current route object being navigated away from.
- **Return Values:** The method can return a `boolean`, a `string` (redirect path), a control object, or a `Promise` resolving to any of these:
  - `true`: Allows the navigation to proceed.
  - `false`: Cancels the navigation.
  - `string`: Redirects the user to the specified hash path (e.g., `'#/login'`).

:::caution
Redirect paths returned from `canActivate` must start with `#`. `AvenxRouter.navigate` only applies the configured `prefix` and namespace settings to hash paths — a path without the `#` prefix bypasses this resolution and can break navigation in apps served with a custom `prefix`.
:::

:::note
When the matched route hash includes query parameters, both `to.params.query` and `from.params.query` contain the parsed query object — using the type coercion rules described in [Query Parameters](/core-concepts/routing/#query-parameters). This lets a guard make decisions based on query values, for example:
```javascript
  canActivate(to, from) {
    if (to.hash.startsWith('#/dashboard') && to.params.query?.tab === 'admin' && !window.isAdmin) {
      return '#/dashboard';
    }
    return true;
  }
```
:::

### Guard Control Object

Instead of a boolean or string, `canActivate` can return a control object for finer-grained control:

| Property   | Type      | Description                                                  |
|------------|-----------|----------------------------------------------------------------|
| `cancel`   | `boolean` | Aborts the navigation and reverts the URL to the previous route. |
| `silent`   | `boolean` | When `cancel` is true, suppresses the console warning normally logged on denial. |
| `redirect` | `string`  | Path to redirect to instead (must start with `#`).             |
| `query`    | `object`  | Key/value pairs serialized into the redirect URL's search params. |
| `state`    | `object`  | Also serialized into the search params (merged with `query`, which takes priority on conflicting keys). |

#### Example: silent cancellation

```javascript
canActivate() {
  return { cancel: true, silent: true };
}
```

#### Example: redirect with query parameters

```javascript
canActivate(to) {
  if (!isAuthenticated()) {
    return { redirect: '#/login', query: { next: to.hash } };
  }
  return true;
}
```

This produces a redirect to `#/login?next=%23%2Fdashboard`.

### Navigation Redirects & Async Activation

A route guard can return a hash path or a Promise resolving to a hash path to redirect the user to another route. This is essential for authentication, authorization, or onboarding flows.

#### Real-World AuthGuard Example

```javascript
// src/guards/auth.guard.js
import { AvenxGuard } from 'avenx-core/runtime';

export default class AuthGuard extends AvenxGuard {
  /**
   * Asynchronously inspects user auth token and redirects unauthorized users to login.
   */
  async canActivate(to, from) {
    const token = localStorage.getItem('authToken');

    if (!token) {
      // Redirect to login page with original target hash as query parameter
      return {
        redirect: '#/login',
        query: { redirectUrl: to.hash },
      };
    }

    try {
      // Validate session with remote authentication service
      const user = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => res.ok ? res.json() : null);

      if (!user) {
        localStorage.removeItem('authToken');
        return '#/login';
      }

      return true;
    } catch {
      return '#/login';
    }
  }
}
```

When a guard returns a redirect path:

- The current navigation is cancelled.
- The router immediately starts a new navigation to the returned hash path.
- Route matching is performed again for the redirected destination.
- Any resolvers associated with the original route are **not executed** because that navigation never completes.
- Resolvers for the redirected route execute normally as part of the new navigation lifecycle.

The router waits for a promise returned by `canActivate` to resolve before acting on its value. When the resolved value is a string or redirect control object, the router stops the current guard chain and starts a new navigation to that hash. Avoid redirecting to a route protected by the same guard unless that route can pass the guard, or the redirects will loop indefinitely.

---

## Pluggable Navigation Delegates (`NavigationDelegate`)

Avenx-JS decouples `AvenxRouter` from browser DOM APIs (`window.location.hash`, `document.title`) by delegating location state management to pluggable **Navigation Delegates** (`lib/core/runtime/navigation/`).

This architecture enables running `AvenxRouter` in non-browser environments like Node.js, Server-Side Rendering (SSR), and headless unit test runners without requiring DOM global mocks.

### `NavigationDelegate` Abstract Base Contract

The base `NavigationDelegate` class defines the contract for all navigation adapters:

| Method Signature | Return Type | Description |
| :--- | :--- | :--- |
| `getHash()` | `string` | Returns the current location hash string (e.g. `'#/home'`). |
| `setHash(hash: string)` | `void` | Navigates/sets the current location hash string and notifies registered listeners. |
| `onHashChange(callback: (hash: string) => void)` | `Function` | Subscribes to location hash change events. Returns an unregister function. |
| `onLinkClick(callback: (route: string) => void)` | `Function` | Subscribes to link click events (e.g. `[data-ax-link]`). Returns an unregister function. |
| `setTitle(title: string)` | `void` | Updates document or in-memory page title. |
| `registerRouter(router: object)` | `void` | Registers a router instance for active router tracking. |
| `unregisterRouter(router: object)` | `void` | Unregisters a router instance. |
| `getActiveRouters()` | `Set<object>` | Returns the set of currently active router instances. |
| `destroy()` | `void` | Cleans up event listeners and internal state. |

### Built-in Delegates

Avenx-JS provides two built-in navigation delegates:

1. **`BrowserNavigationDelegate`**: The default delegate in browser environments. Binds directly to `window.location.hash`, `hashchange` events, document link clicks (`[data-ax-link]`), and `document.title`.
2. **`MemoryNavigationDelegate`**: An in-memory delegate for Node.js, SSR, and headless test environments. Manages route location state, active subscriptions, and page titles purely in memory without DOM or window dependencies.

### Configuring Navigation Delegates

Pass a custom delegate or configuration mode to `AvenxApp.initRouter(routes, options)`:

```javascript
import { AvenxApp } from 'avenx-core/runtime';
import { MemoryNavigationDelegate } from 'avenx-core/runtime/navigation';

// Method 1: Explicit MemoryNavigationDelegate instance
const delegate = new MemoryNavigationDelegate('#/dashboard');
const router = AvenxApp.initRouter(routes, { navigationDelegate: delegate });

// Method 2: Mode configuration option (automatically instantiates MemoryNavigationDelegate)
const router = AvenxApp.initRouter(routes, {
  mode: 'memory',
  initialHash: '#/dashboard',
});
```

### `MemoryNavigationDelegate` API Reference

```typescript
class MemoryNavigationDelegate extends NavigationDelegate {
  /** Initial hash defaults to '#/' */
  constructor(initialHash?: string);

  /** Current hash string held in memory */
  currentHash: string;

  /** Active in-memory title */
  title: string;

  /** Returns currentHash */
  getHash(): string;

  /** Updates currentHash and invokes registered hash listeners */
  setHash(hash: string): void;

  /** Registers a hash listener; returns unsubscribe function */
  onHashChange(callback: (hash: string) => void): Function;

  /** Registers a link click listener; returns unsubscribe function */
  onLinkClick(callback: (route: string) => void): Function;

  /** Sets in-memory title property */
  setTitle(title: string): void;

  /** Clears all listeners and active router references */
  destroy(): void;
}
```


