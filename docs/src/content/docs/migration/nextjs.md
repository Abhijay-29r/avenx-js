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

*This section will document explicit routing setup in `main.app.js`, `.page.js` components, dynamic `:id` parameters, and `keepAlive` page caching.*

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

