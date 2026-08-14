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

*This section will document decoupling full-stack API routes into external REST servers and replacing Next middleware with `AvenxGuard` classes.*
