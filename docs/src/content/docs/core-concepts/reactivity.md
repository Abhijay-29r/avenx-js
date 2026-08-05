---
title: 'Reactive State'
description: 'Deep dive into the Proxy-based reactive state and transparent dependency tracking in Avenx-JS.'
---

---

Avenx-JS implements a **transparent reactivity system** powered by JavaScript ES6 `Proxy`. There are no state setter functions or hooks required to update the user interface.

> [!TIP]
> For reactive asynchronous data fetching with automatic dependency tracking, Suspense, and error handling, check out the [<resource> SFC Tag & Resource API](/core-concepts/resources) guide.

## How It Works

When a component is instantiated, the framework wraps its initial state object in a reactive Proxy. When an action or callback modifies any field on `state`, the Proxy trap intercepts the change and queues a re-render job.

```javascript
// In an action:
state.counter++; // Automatically schedules a visual update!
```

## Batching Updates & Scheduler

To maximize browser performance, state updates are batched together. If you change multiple state properties sequentially, Avenx does not re-render the DOM for each modification. Instead, the framework queues a single microtask job to flush updates together in the next tick.

```javascript
<action name="updateUser">
  state.name = "John"; // Queued state.age = 30; // Queued (deduplicated) state.role = "admin"; // Queued (deduplicated)
  // The DOM will render only ONCE at the end of the microtask queue.
</action>
```

## Lifecycle & Rendering Flow

When reactive state changes, Avenx-JS processes the update through a scheduled rendering cycle. Updates are batched using the scheduler queue so that multiple state mutations can be processed efficiently within a single microtask.

The update lifecycle follows this sequence:

1. **State Mutation** - A value in the reactive `state` object is changed.
2. **Proxy Interception** - The reactive Proxy intercepts the mutation and requests an update.
3. **Scheduler Job Queue** - The component's update job is added to the scheduler queue. Multiple updates to the same component can be deduplicated and batched together.
4. **Microtask Flush** - The scheduler processes the queued update jobs during the next microtask.
5. **DOM Patch** - The component template is rendered and the DOM is patched with the updated values.
6. **Slot Re-fill** - Component slots are re-filled with their updated content.
7. **`onUpdate` Execution** - The component's `onUpdate` lifecycle callback runs after the update has completed.

In summary:

```text
State Mutation
  │
  ▼
Proxy Interception
  │
  ▼
Scheduler Job Queue
  │
  ▼
Microtask Flush
  │
  ▼
DOM Patch
  │
  ▼
Slot Re-fill
  │
  ▼
onUpdate Execution
```

---

## Microtask Scheduler & `nextTick` Utility

Because state mutations are batched asynchronously, DOM updates do not happen immediately upon state assignment. If you inspect DOM dimensions or query rendered elements immediately after modifying `this.state`, you will read pre-update DOM measurements.

The `nextTick` utility function allows you to execute callbacks or await Promises immediately after the scheduler finishes flushing pending DOM updates.

### Usage Variants

#### 1. Component Instance Method (`this.nextTick`)

Inside component actions, methods, or lifecycle hooks, use `this.nextTick()`:

```javascript
// Callback usage
this.state.items.push(newItem);
this.nextTick(() => {
  const lastItem = this.$element.querySelector('li:last-child');
  console.log('New item offsetHeight:', lastItem.offsetHeight);
});

// Promise / Async-Await usage
async function addItem() {
  this.state.showModal = true;
  await this.nextTick();
  const inputEl = this.$element.querySelector('.modal input');
  inputEl.focus();
}
```

#### 2. Framework Import (`nextTick`)

Import `nextTick` directly from `avenx-core/runtime` when working outside component instance methods:

```javascript
import { nextTick } from 'avenx-core/runtime';

component.state.title = 'Updated Title';
await nextTick();
console.log(document.title);
```

### Scheduler Architecture & Execution Order (`scheduler.js`)

Avenx-JS manages asynchronous rendering using an internal microtask scheduler (`lib/core/reactive/scheduler.js`).

```
State Mutation
      │
      ▼
queueJob(job)  ──► Deduplicate & push to job queue
      │
      ▼
queueFlush()   ──► Schedule microtask (Promise.resolve().then(...))
      │
      ▼
  flushJobs()
  ├─ 1. Sort job queue by component UID ascending (Parent before Child)
  ├─ 2. Execute DOM patch jobs
  └─ 3. Drain & execute flushCallbacks (nextTick callbacks)
```

1. **Job Queueing & Deduplication (`queueJob`)**: When a reactive state field mutates, the component's update job (`#updateJob`) is pushed to the queue. Multiple mutations to the same component are deduplicated.
2. **Microtask Deferred Execution (`queueFlush`)**: The scheduler defers execution to a microtask using chained promises (`Promise.resolve().then(() => Promise.resolve().then(flushJobs))`).
3. **Hierarchical Component Ordering**: Before executing jobs in `flushJobs()`, the scheduler sorts the queue ascending by component `id` (UID). This guarantees that parent components re-render and patch the DOM *before* child components, preventing redundant updates or orphaned child renders.
4. **Flush Callback Phase**: After all DOM patch jobs finish, the scheduler drains and executes `flushCallbacks` (including `nextTick` callbacks). If a `nextTick` callback mutates reactive state again, the scheduler recursively re-flushes until all queues are empty.


```text
State Mutation
    ↓
Proxy Interception
    ↓
Scheduler Job Queue
    ↓
Microtask Flush
    ↓
DOM Patch
    ↓
Slot Re-fill
    ↓
onUpdate Execution
```

Because updates are queued and processed asynchronously, multiple synchronous state mutations can be grouped into a single rendering cycle instead of causing repeated DOM updates.

### Troubleshooting `AVX_R11`

#### Troubleshooting `AVX_W09`

The `AVX_W09` (`ROUTE_PARAM_DECODE_FAILED`) warning occurs when Avenx-JS cannot decode a route parameter because it contains malformed percent-encoding.

This warning is typically raised during route changes when parameters are extracted from the URL and decoded using JavaScript's `decodeURIComponent()`. If decoding fails because the URI is malformed, Avenx-JS logs the warning instead of crashing the application.

For example, the following route parameter contains invalid percent-encoding:

```text
#/profile/John%2
```

The `%2` sequence is incomplete and cannot be decoded.

A correctly encoded route would be:

```text
#/profile/John%20Doe
```

where `%20` represents a space.

To prevent this warning:

- Always encode route parameters using `encodeURIComponent()` before constructing URLs.
- Ensure every `%` is followed by exactly two hexadecimal digits (`0-9`, `A-F`, or `a-f`).
- Avoid manually writing encoded URL values whenever possible.

Example:

```javascript
const userName = "John Doe";
const url = `/profile/${encodeURIComponent(userName)}`;
```

Common examples of percent encoding:

**Valid**

```text
%20
%2F
%3A
```

**Invalid**

```text
%
%2
%ZZ
```

#### Troubleshooting `AVX_W11`

The `AVX_W11` (`ROUTE_TITLE_EVALUATION_FAILED`) warning occurs when a dynamic route `title` function throws an error while evaluating the route parameters.

For example, this route can trigger the warning if `params.id` is accessed through code that throws an error:

````javascript
app.initRouter({
  '/profile/:id': {
    page: 'Profile',
    title: (params) => getProfileTitle(params.id),
  },
});
The `AVX_R11` (`STATE_MUTATION_IN_UPDATE`) error occurs when state is mutated synchronously while Avenx-JS is already processing an update.

This can happen when state is modified from code that runs as part of rendering, such as a computed property or template expression. Updating state during this phase can schedule another update before the current update has finished, potentially creating an infinite rendering loop.

For example, avoid mutating state while computing a value:

```javascript
get displayName() {
  state.name = state.name.trim(); // Avoid: mutates state during an update
  return state.name;
}
````

Instead, computed getters should derive and return values without modifying state:

```javascript
get displayName() {
  return state.name.trim();
}
```

If a state mutation must happen after the current update cycle has completed, defer it using `setTimeout`:

```javascript
setTimeout(() => {
  state.name = state.name.trim();
}, 0);
```

Deferring the mutation allows the current rendering cycle to finish before another state update is scheduled.

When troubleshooting `AVX_R11`, check for state mutations inside computed getters, template expressions, or other code that executes during rendering. Prefer deriving values without side effects, and defer necessary state changes until after the current update cycle.

## Nested Reactivity

Avenx-JS automatically intercepts nested object mutations. If a state property contains an array or object, mutations within that tree are tracked:

```javascript
state.todos.push({ text: 'Learn Avenx', done: false }); // Reactive!
state.user.profile.age = 35; // Reactive!
```

---

## Watchers & Advanced Options (`$watch`)

Watchers allow components to run side effects (such as making API calls, persisting values to `localStorage`, or manipulating DOM elements) in response to reactive state changes.

In Avenx-JS, watchers are registered using `this.$watch(source, callback, options)`.

### Watcher Method Signature

```javascript
this.$watch(source, callback, options)
```

- `source`: Dot-separated string path (e.g. `'user.settings.theme'`) or getter function `() => this.state.searchQuery`.
- `callback`: Function called when the watched value changes `(newValue, oldValue) => { ... }`.
- `options`: Object specifying configuration options (`immediate`, `deep`, `flush`).

---

### Advanced Options (`options`)

#### 1. Immediate Execution (`immediate: true`)

By default, watcher callbacks run only when the watched property changes *after* watcher registration. Set `immediate: true` to invoke the callback immediately upon creation with the current value (`oldValue` will be `undefined`):

```javascript
// Triggers immediately with current searchQuery, then on subsequent changes
this.$watch('searchQuery', (newQuery) => {
  this.performSearch(newQuery);
}, { immediate: true });
```

#### 2. Deep Tracking (`deep: true`)

By default, string path watchers track shallow property replacements. Set `deep: true` to recursively observe nested object property mutations and array modifications:

```javascript
// Fires when any property inside state.user.settings changes
this.$watch('user.settings', (newSettings) => {
  this.saveSettingsToLocalStorage(newSettings);
}, { deep: true });
```

#### 3. Execution Timing (`flush: 'pre' | 'post' | 'sync'`)

The `flush` option controls when the watcher callback is executed relative to the component's DOM patch lifecycle:

| Value | Timing & Behavior | Common Use Cases |
| :--- | :--- | :--- |
| `'pre'` *(Default)* | Fires **before** DOM patch rendering takes place. | Preparing state calculations or computing secondary values before render. |
| `'post'` | Fires **after** DOM patch update completes. | Accessing updated DOM element measurements, scroll positions, or canvas elements. |
| `'sync'` | Fires **synchronously** immediately upon state mutation. | Real-time validation or synchronizing state with external non-DOM stores. |

```javascript
// 'post' flush: container scroll position updated after DOM list re-renders
this.$watch('messages.length', () => {
  const listEl = this.el.querySelector('.chat-messages');
  listEl.scrollTop = listEl.scrollHeight;
}, { flush: 'post' });
```


## Reactivity Injection (Provide / Inject)

For deeply nested component trees, passing data down through props at every level ("prop drilling") gets unwieldy. Avenx-JS offers a lighter-weight alternative to global `bridges` for this specific case: an ancestor component can `provide` values, and any descendant, no matter how deeply nested, can `inject` them directly — without the value passing through, or being known by, the components in between.

Unlike bridges, provide/inject is scoped to a single component subtree rather than the whole application, and it doesn't route through the global bridge/render system, avoiding that overhead for state that's only relevant to one part of the tree.

### Providing values

Declare a `provide` property (or static method) on the ancestor component. It can be:

- **An object**, mapping keys to values or methods
- **A function** (instance or static) returning either form above, evaluated once per instance
- **An array of keys**, exposing matching properties already present on the component's own `state`, `props`, methods, or bridges

```javascript
// src/pages/dashboard.page.js
<state theme="dark" />;

// Object form: explicit keys and values
provide = {
  theme: this.state.theme,
  setTheme: (value) => {
    this.state.theme = value;
  },
};
```

```javascript
// Array form: re-exposes existing state/props/methods by name
provide = ['theme', 'setTheme'];
```

### Injecting values

Descendant components declare `inject` the same way — object, function, or array of keys — and the resolved keys become directly accessible as properties on `this` (and inside template expressions):

```javascript
// src/components/theme-toggle/theme-toggle.component.js
inject = ['theme', 'setTheme'];

<button @click="setTheme(theme === 'dark' ? 'light' : 'dark')">
  Current theme: {{ theme }}
</button>
```

To expose a provided value under a different local name, use the object form of `inject`, mapping the local key to the key it was provided under:

```javascript
inject = {
  currentTheme: 'theme', // accessible as `this.currentTheme` / `{{ currentTheme }}`
};
```

### How resolution works

An injected key is resolved **lazily, on every access** — it is not copied or cached at mount time. When a descendant reads an injected property, Avenx walks up the DOM tree from the component's root element to find the nearest ancestor component whose `provide` declares that key, then reads the current value from it.

This has two practical implications:

- **Object-form `provide` is reactive.** The object passed to `provide` is wrapped in its own reactive proxy internally. Injecting descendants read through that proxy on every access, so they automatically see updates when the provider changes a provided value — no extra wiring required.
- **Array-form `provide` stays reactive too**, since it reads the provided key directly off the provider's live `state`/`props`/methods each time, rather than a snapshot.

:::note
Only the **nearest** ancestor providing a given key is used. If multiple ancestors in the chain provide the same key, closer ancestors take precedence.
:::

:::caution
If no ancestor in the tree provides an injected key, the property resolves to `undefined` and a warning is logged to the console — it does not throw. Double-check ancestor/descendant `provide`/`inject` key names match if an injected value is unexpectedly `undefined`.
:::

## Reactivity Exclusions and Limitations

Avenx-JS uses JavaScript `Proxy` objects to track changes to reactive state. While this works well for plain JavaScript objects and arrays, some values are intentionally excluded from reactive tracking to preserve native behavior and avoid prototype-related issues.

### Untracked Types

The following values are **not** automatically tracked by the reactivity system:

| Type | Reason |
|------|--------|
| `Symbol` properties | Symbol keys are ignored during reactive tracking. |
| `Date` instances | Native class instances are not proxied. |
| `RegExp` instances | Regular expression objects are excluded from tracking. |
| `Map` | Internal mutations (`set`, `delete`, `clear`) are not observed. |
| `Set` | Internal mutations (`add`, `delete`, `clear`) are not observed. |
| Frozen objects (`Object.freeze`) | Frozen objects cannot be wrapped or mutated reactively. |
| Other built-in class instances | Native objects are intentionally excluded to preserve their original behavior. |

### Why These Types Are Excluded

These exclusions help:

- preserve the behavior of native JavaScript objects
- avoid prototype pollution
- prevent unexpected side effects when wrapping built-in objects
- keep the reactivity system predictable

### Recommended Alternatives

When possible, store plain JavaScript values inside reactive state instead of native class instances.

For example, instead of storing a `Date` object directly:

```js
state.createdAt = new Date();
```

store a primitive representation:

```js
state.createdAt = Date.now();
```

or

```js
state.createdAt = new Date().toISOString();
```

Instead of storing a `Map`:

```js
state.users = new Map();
```

consider using a plain object:

```js
state.users = {
  alice: {
    role: "admin"
  },
  bob: {
    role: "editor"
  }
};
```

or an array of entries:

```js
state.users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" }
];
```

### Working with Non-Reactive Objects

If your application needs to use native objects such as `Map`, `Set`, or custom class instances, consider storing a primitive representation in reactive state and recreating the object when needed.

For scenarios where external objects change independently of reactive state, update a tracked state property or use your application's refresh mechanism to trigger a UI update after modifying the object.

### Summary

For the best reactive experience:

- ✅ Prefer plain objects and arrays.
- ✅ Store primitive values such as strings, numbers, and booleans.
- ✅ Convert native objects to serializable formats when appropriate.
- ❌ Do not rely on mutations of `Date`, `Map`, `Set`, `RegExp`, `Symbol` properties, or frozen objects to trigger UI updates.