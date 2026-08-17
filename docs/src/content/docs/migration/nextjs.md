---
title: 'Migrating from Next.js to Avenx-JS'
description: 'Guide for transitioning from Next.js full-stack and App Router architecture to Avenx-JS client-side single page applications.'
---

This guide details how to migrate applications built with **Next.js** to **Avenx-JS**.

---

## 1. Architectural Overview & Mental Model Shift

Next.js is a full-stack framework with file-based routing (`app/` or `pages/`), React Server Components (RSC), and server actions. Avenx-JS is a client-side Single Page Application (SPA) framework with explicit route definitions in `src/main.app.js` and declarative client-side data fetching.

| Concept | Next.js | Avenx-JS |
| :--- | :--- | :--- |
| **Routing Strategy** | File-system based routing (`app/` directory) | Explicit router configuration via `app.initRouter()` |
| **Rendering Strategy** | Server Components / SSR / SSG / Hydration | Client-Side Rendering (CSR) via `DomPatcher` |
| **Page Components** | `page.tsx` exported React component | `.page.js` component extending `AvenxPage` |
| **Data Fetching** | Server Components / `getServerSideProps` | Client `<resource>` tags + REST API calls |
| **Route Protection** | `middleware.ts` | Async `AvenxGuard` classes implementing `canActivate()` |

---

## 2. Router and Page Architecture

Next.js uses file-system based routing inside the `app/` or `pages/` directory, where file names and folder structures (`app/profile/[id]/page.tsx`) determine application routes automatically on the server.

Avenx-JS uses an **explicit client-side SPA routing architecture**. Creating a `.page.js` file does not automatically expose a URL route. Instead, pages are registered with `app.registerPage()` and routes are explicitly configured using `app.initRouter()` in `src/main.app.js`. See the [Routing](/core-concepts/routing) guide for full specifications and the [Migration Overview](/migration/overview) for paradigm comparisons.

---

### Key Architectural Differences

| Feature | Next.js | Avenx-JS |
| :--- | :--- | :--- |
| **Route Definition** | Automatic based on file tree (`app/profile/[id]/page.tsx`) | Explicit configuration object in `src/main.app.js` (`app.initRouter()`) |
| **Page Component Base** | React component export (`export default function Page()`) | Top-level `.page.js` component (compiles to subclass of `AvenxPage`) |
| **Dynamic Segments** | Square brackets (`[id]`, `[...slug]`) | Colon parameter syntax (`:id`, `:category`) |
| **Params Access** | Component props (`params.id`) | Accessible automatically via `state.id` or `state.params.id` |
| **Page Caching / State Preservation** | Server cache / React tree re-mount | Client-side `keepAlive: true` with configurable `keepAliveLimit` |

---

### Code Migration Example

#### Before — Next.js App Router Page (`app/profile/[id]/page.tsx`)

```tsx
// app/profile/[id]/page.tsx
export default function ProfilePage({ params }: { params: { id: string } }) {
  return (
    <div className="profile-page">
      <h1>Profile ID: {params.id}</h1>
    </div>
  );
}
```

#### After — Avenx.js Page & Router Setup (`src/pages/profile.page.js` & `src/main.app.js`)

```html
<!-- src/pages/profile.page.js -->
<state id="" />

<div class="profile-page">
  <Navbar />
  <h1>Profile ID: {{ state.id }}</h1>
</div>
```

```javascript
// src/main.app.js
import { AvenxApp } from 'avenx-core/runtime';
import ProfilePage from './pages/profile.page.js';
import HomePage from './pages/home.page.js';

const app = new AvenxApp({
  target: '#app',
  keepAliveLimit: 3, // Retain up to 3 cached keep-alive pages in DOM memory
});

// 1. Register page components with the application instance
app.registerPage('Home', HomePage);
app.registerPage('Profile', ProfilePage);

// 2. Explicitly map URL hash routes to registered page names
app.initRouter({
  '/': 'Home',
  '/profile/:id': {
    page: 'Profile',
    keepAlive: true,
  },
  '*': 'Home',
});
```

---

### Dynamic Parameters (`:id`)

In Next.js, dynamic route parameters are defined with square brackets (`[id]`) and passed to the page function as `params`.

In Avenx-JS, dynamic route parameters are defined with colons (`:id`). When a route like `/profile/:id` is matched (e.g. `#/profile/42`), the router automatically injects the extracted parameters into the page's reactive `state`:

- `state.id` (or `state.<paramName>`) is automatically populated.
- `state.params` contains the complete key-value dictionary of all route parameters (e.g. `{ id: '42' }`).

```html
<!-- src/pages/profile.page.js -->
<div>
  <!-- Access dynamic param directly from state -->
  <h2>User #{{ state.id }}</h2>
  <p>Raw params object: {{ JSON.stringify(state.params) }}</p>
</div>
```

---

### Keep-Alive Page Caching & State Retention

Next.js re-renders components on navigation unless client layout caching is explicitly utilized. In long-running SPAs, Avenx-JS provides native **Keep-Alive Page Caching**.

Setting `keepAlive: true` on a route configuration instructs `AvenxRouter` to cache the mounted DOM subtree and component instance state when the user navigates away:

```javascript
app.initRouter({
  '/dashboard': {
    page: 'DashboardPage',
    keepAlive: true, // Retain DOM & state on navigation
  },
});
```

#### Configuring `keepAliveLimit`

To prevent memory leaks when navigating between many cached pages, configure `keepAliveLimit` on `AvenxApp`:

```javascript
const app = new AvenxApp({
  target: '#app',
  keepAliveLimit: 5, // Evicts oldest cached page when limit is exceeded
});
```

#### Keep-Alive Lifecycle Hooks (`onActivate` & `onDeactivate`)

When a keep-alive page is revisited, its DOM is re-attached without running full re-initialization. Use `onActivate` and `onDeactivate` lifecycle methods to handle re-activation logic:

```html
<!-- src/pages/dashboard.page.js -->
<state lastRefreshed="" />

<action name="onActivate" params="routeParams">
  console.log("Dashboard re-activated with params:", routeParams);
  state.lastRefreshed = new Date().toLocaleTimeString();
</action>

<action name="onDeactivate">
  console.log("Dashboard backgrounded");
</action>

<div>
  <h1>Dashboard</h1>
  <p>Last active: {{ lastRefreshed }}</p>
</div>
```

---

### Key Conceptual Differences & Migration Pitfalls

#### 1. No File-System Routing

Creating a file like `src/pages/settings.page.js` does **not** create a `/settings` route automatically. You must:
1. Import `SettingsPage` in `src/main.app.js`.
2. Register it via `app.registerPage('Settings', SettingsPage)`.
3. Add the route entry in `app.initRouter({ '/settings': 'Settings' })`.

#### 2. `.page.js` vs `.component.js` Nesting Rules

- `.page.js` files compile to subclasses of `AvenxPage` and serve as top-level router targets.
- Regular `.component.js` files compile to `AvenxComponent` and are nested inside page templates.
- Child components **cannot** host top-level router targets — only `.page.js` components can be assigned as route targets in `app.initRouter()`.

---

## 3. Data Fetching and Async Boundaries

*This section will document replacing server components with client `<resource>` tags, `<@suspense>`, and `<@errorBoundary>`.*

---

## 4. Server vs Client Decoupling & Route Guards

Next.js can handle both frontend and backend code in the same application using API routes, Server Actions, and middleware. Avenx-JS is client-side, so backend logic should be moved to a separate API server.

### 4.1 Decoupling the Backend

Next.js API routes and Server Actions can be moved to a separate backend such as Express, Fastify, or NestJS.

```text
Browser
  |
  v
Avenx-JS SPA
  |
  | REST API
  v
Backend Server
  |
  v
Database / Services
```

Avenx-JS handles the client-side application, while API requests are sent to the separate backend server.

### 4.2 Replacing Next.js Middleware

Next.js middleware can be used to check authentication before allowing access to a route.

**Before — Next.js Middleware**

```js
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

With Avenx-JS, the same check can be handled by an `AvenxGuard`.

**After — Avenx-JS Route Guard**

```js
// src/guards/auth.guard.js
import { AvenxGuard } from 'avenx-core/runtime';

export default class AuthGuard extends AvenxGuard {
  async canActivate(to, from) {
    const token = localStorage.getItem('authToken');

    if (!token) {
      return '#/login';
    }

    return true;
  }
}
```

The `canActivate(to, from)` method runs before navigation. Returning `true` allows the navigation, while returning `false` cancels it. Returning a route such as `#/login` redirects the user.

### 4.3 Registering the Guard

The guard can be added to a route in the router configuration.

```js
// src/main.app.js
import AuthGuard from './guards/auth.guard.js';

app.initRouter({
  '#/login': 'Login',
  '#/dashboard': {
    page: 'Dashboard',
    guards: [AuthGuard],
  },
});
```

When the user tries to open `#/dashboard`, the guard runs before the route is entered. The guard can also perform asynchronous checks.

### 4.4 Environment Variables and Static Assets

Next.js uses the `NEXT_PUBLIC_` prefix for environment variables that are exposed to the browser. When migrating to Avenx-JS, use the environment configuration of the client application instead.

Only values that are safe to expose in the browser should be included in client-side configuration. Secrets and private API keys should remain on the backend.

Static files such as images and icons can be placed in the `public/` directory.

For more information, see the [Router Guards](../api-reference/router-guard) and [Migration Overview](./overview) documentation.

