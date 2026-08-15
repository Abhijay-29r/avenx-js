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

Angular centralizes shared business logic and global state in `@Injectable({ providedIn: 'root' })` services injected into component constructors through its Dependency Injection (DI) framework. Avenx-JS replaces services and DI with **Bridges** — class-based reactive modules in `src/global/*.bridge.js` that extend `AvenxBridge`. See [Shared State & Bridges](/core-concepts/bridges) for the full bridge API and [Migration Overview](/migration/overview) for the high-level conceptual mapping.

### Replacing `@Injectable` Services

A service becomes a bridge class. Where Angular marks the class with `@Injectable({ providedIn: 'root' })`, Avenx declares it in `src/global/<name>.bridge.js` and extends `AvenxBridge`. State the service held as fields becomes reactive properties initialized in the bridge constructor; business logic stays as class methods.

**Before — Angular `@Injectable` Service & Component DI**

```typescript
// user.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  currentUser = { name: 'Guest', role: 'visitor' };
  isLoggedIn = false;

  setUser(name: string, role: string) {
    this.currentUser = { name, role };
    this.isLoggedIn = true;
  }
}

// user.component.ts
import { Component } from '@angular/core';
import { UserService } from './user.service';

@Component({ selector: 'app-user', template: `<p>{{ userService.currentUser.name }}</p>` })
export class UserComponent {
  constructor(public userService: UserService) {}
}
```

**After — Avenx.js Bridge Class**

```javascript
// src/global/user.bridge.js
import { AvenxBridge } from 'avenx-core/runtime';

export default class UserBridge extends AvenxBridge {
  constructor() {
    super();
    this.currentUser = { name: 'Guest', role: 'visitor' };
    this.isLoggedIn = false;
  }

  setUser(name, role) {
    this.currentUser = { name, role };
    this.isLoggedIn = true;
  }
}
```

### Using a Bridge in a Component Template

Bridges are automatically loaded and registered by the compiler. They are exposed directly to component templates and actions under their capitalized name postfixed with `Bridge` (e.g. `UserBridge`) — no import, provider, or constructor parameter needed.

**Before — Angular template using the injected service**

```html
<!-- user.component.html -->
<p>{{ userService.currentUser.name }} ({{ userService.currentUser.role }})</p>
<button (click)="userService.setUser('Alice', 'Admin')">Set Admin</button>
```

**After — Avenx.js template using the bridge singleton**

```html
<!-- src/components/user/user.component.js -->
<div>
  <p>User: {{ UserBridge.currentUser.name }} ({{ UserBridge.currentUser.role }})</p>
  <button @click="UserBridge.setUser('Alice', 'Admin')">Set Admin</button>
</div>
```

### Eliminating Constructor Injection

Avenx components do not take constructor parameters. There is no DI container and no provider tree to configure; component constructors only initialize local component state. Shared logic is always reached by referencing the bridge directly in the template or inside `<action>` blocks.

### Global Registration & Singleton Scope

Every bridge in `src/global/` is registered globally at compile time and instantiated once. All components and pages share the same bridge instance, so state written by one component is immediately visible to every other component that references the bridge — the Avenx equivalent of a root-provided singleton service.

### Key Conceptual Differences & Pitfalls

- **No DI Hierarchy**: Angular supports hierarchical injectors and scoping services to specific module trees. Avenx Bridges operate as global singletons; there is no per-module or per-route scoping.
- **No Constructor Parameters**: Component constructors in Avenx do not accept injected services. Simply reference `UserBridge` directly in templates or actions.
- **Extending `AvenxBridge`**: Ensure bridge classes extend `AvenxBridge` and execute `super()` inside their constructor before defining state properties.

---

## 4. Signals and RxJS to Proxy Reactivity

*This section will document transitioning Angular Signals and RxJS `async` pipe streams to Avenx `<state>`, `<computed>`, and `<resource>`.*
