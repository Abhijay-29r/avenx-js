---
title: 'Migrating from Angular to Avenx-JS'
description: 'Guide for migrating Angular TypeScript components, templates, Injectable Services, Signals, and RxJS to Avenx-JS.'
---

This guide details how to migrate applications built with **Angular** to **Avenx-JS**.

---

## 1. Architectural Overview & Mental Model Shift

Angular applications use TypeScript classes with `@Component` decorators, dependency injection trees, and RxJS/Signals. Avenx-JS provides a lightweight companion file architecture (`.component.js` and `.component.css`) with proxy-based state and global Bridges (`AvenxBridge`).

| Concept | Angular | Avenx-JS |
| :--- | :--- | :--- |
| **Component Definition** | TypeScript `@Component` class + HTML template | `.component.js` (logic/template) + `.component.css` |
| **Template Loops** | `*ngFor="let item of items"` | `<@for item in state.items key="item.id">` |
| **Shared State & Services** | `@Injectable({ providedIn: 'root' })` Services | **Bridges** (`AvenxBridge` in `src/global/*.bridge.js`) |
| **Reactivity** | Signals (`signal()`) / RxJS Observables | Proxy state (`<state />`) and `<computed />` tags |
| **Route Protection** | Angular `CanActivate` guards | `AvenxGuard` classes with `canActivate(to, from)` |

---

## 2. Component Anatomy and Template Syntax

*This section will document replacing `@Component` classes and Angular directives (`*ngFor`, `[ngClass]`, `(click)`) with Avenx companion files and template syntax.*

---

## 3. Services and Dependency Injection Alternatives

*This section will document replacing `@Injectable()` services and constructor dependency injection with `AvenxBridge` global classes.*

---

## 4. Signals and RxJS to Proxy Reactivity

*This section will document transitioning Angular Signals and RxJS `async` pipe streams to Avenx `<state>`, `<computed>`, and `<resource>`.*
