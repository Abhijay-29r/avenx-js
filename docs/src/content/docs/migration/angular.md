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

Angular models reactive data with two APIs: **Signals** (`signal()`, `computed()`, `effect()`) for synchronous state, and **RxJS Observables** (`BehaviorSubject`, `async` pipe) for streams. Avenx-JS collapses both into **transparent Proxy state**: plain properties on a reactive `state` object that the framework watches and patches into the DOM for you. See the [Reactive State](/core-concepts/reactivity) guide for the full mental model, and the [Migration Overview](/migration/overview) for how every framework maps onto it.

### 4.1 Replacing Signals & Observables with `<state>`

A single `<state>` tag declares all of a component's reactive properties. Values are plain JavaScript properties — there are no setter functions and no getter calls.

| Angular | Avenx-JS |
| :--- | :--- |
| `signal(0)` | `<state count="0" />` → `state.count` |
| `signal.set(v)` / `signal.update(fn)` | `state.count = v` / `state.count++` |
| `BehaviorSubject` | `<state status="'Ready'" />` → `state.status` |
| `subject.next(v)` | `state.status = v` |
| `computed(() => expr)` | `<computed name="doubleCount" value="state.count * 2" />` |

#### Before – Angular Signals & RxJS Async Pipe

```typescript
import { Component, signal, computed } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-counter',
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Double: {{ doubleCount() }}</p>
      <p>Status: {{ status$ | async }}</p>
      <button (click)="increment()">Increment</button>
    </div>
  `
})
export class CounterComponent {
  count = signal(0);
  doubleCount = computed(() => this.count() * 2);
  status$ = new BehaviorSubject('Ready');

  increment() {
    this.count.update(c => c + 1);
    this.status$.next('Updated at ' + new Date().toLocaleTimeString());
  }
}
```

#### After – Avenx.js Proxy State & Computed

```html
<!-- src/components/counter/counter.component.js -->
<state count="0" status="'Ready'" />
<computed name="doubleCount" value="state.count * 2" />
<action name="increment">
  state.count++;
  state.status = 'Updated at ' + new Date().toLocaleTimeString();
</action>

<div>
  <p>Count: {{ state.count }}</p>
  <p>Double: {{ doubleCount }}</p>
  <p>Status: {{ state.status }}</p>
  <button @click="increment()">Increment</button>
</div>
```

### 4.2 Replacing the `async` Pipe

Templates read reactive properties directly. There is no subscription unwrapping and no `async` pipe: interpolation (`{{ state.count }}`) already reflects the latest value, and every mutation schedules an automatic DOM patch.

| Angular template | Avenx-JS template |
| :--- | :--- |
| `{{ count() }}` | `{{ state.count }}` |
| `{{ status$ | async }}` | `{{ state.status }}` |
| `*ngIf="(user$ | async) as user"` | `data-ax-show="state.user"` |
| `*ngFor="let item of items$ | async"` | `<@for item in state.items key="item.id">` |

### 4.3 Replacing Streams with `<resource>`

RxJS is not needed for asynchronous data that changes over time. Avenx-JS provides the [`<resource>` SFC tag & `Resource` API](/core-concepts/resources), which tracks reactive dependencies, re-fetches when they change, and integrates with `<@suspense>`:

```typescript
// Angular: this.user$ = this.http.get<User>(`/api/users/${this.id}`);
```

```html
<!-- Avenx-JS -->
<resource name="user" handler="fetch(`/api/users/${state.userId}`).then(r => r.json())" />

<p>Name: {{ state.user?.name }}</p>
```

### 4.4 Mental Model Shift: Push Streams → Declarative Proxy State

- **No execution parentheses**: Angular Signals are getter functions (`count()`); Avenx state properties are read as plain values (`state.count`).
- **No `.next()`, `.set()`, or `.update()`**: mutating a proxy property (`state.count++`, `state.status = ...`) is the only API you need.
- **No subscription lifecycle**: Angular requires `| async` or manual `subscribe()`/`unsubscribe()` management. Avenx components never subscribe; the framework's watcher observes property reads and patches the DOM automatically, batching updates into a single microtask flush.
- **Derived values are cached, not recomputed**: Angular `computed()` lazily caches; Avenx `<computed>` does the same with automatic dependency tracking and circular-dependency protection.

### 4.5 Key Conceptual Differences & Pitfalls

- **No Execution Parentheses**: Angular Signals require calling the signal getter function (`count()`). Avenx state properties are plain proxy properties (`state.count`).
- **No Async Pipe Needed**: Templates read reactive properties directly. No subscription unwrapping or `async` pipe operators are necessary.
- **Simplified State Mutations**: Mutate proxy properties directly (`state.count++`) instead of calling `signal.update()`, `signal.set()`, or `subject.next()`.
- **Services that push streams**: Angular services often expose `BehaviorSubject`s that components subscribe to. In Avenx, share data through a **Bridge** (`AvenxBridge` in `src/global/*.bridge.js`) whose properties are read reactively in any component that touches them.
