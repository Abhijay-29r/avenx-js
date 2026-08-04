---
title: 'Component Lifecycle Hooks'
description: 'Understand Avenx-JS component lifecycle hooks, execution sequence, and practical use cases.'
---

Avenx-JS components go through a series of initialization, mounting, updating, and unmounting phases during their lifecycle. Lifecycle hooks allow you to execute custom logic at specific stages of a component's lifetime — such as fetching API data when a component mounts, adjusting DOM scroll positions after updates, or cleaning up timers when unmounting.

---

## Lifecycle Overview & Execution Flow

```mermaid
graph TD
    A["Instantiation & State Setup"] --> B["onBeforeMount()"]
    B --> C["Initial DOM Template Compilation"]
    C --> D["onMount()"]
    D --> E{"State or Props Changed?"}
    E -- "Yes" --> F["onBeforeUpdate()"]
    F --> G["DOM Patch Session"]
    G --> H["onUpdate()"]
    H --> E
    E -- "Component Removed" --> I["onUnmount()"]
    E -- "KeepAlive Route Change" --> J["onDeactivate()"]
    J -- "Restored Route" --> K["onActivate(params)"]
```

---

## Detailed Lifecycle Hooks Reference

### 1. `onBeforeMount()`

- **Trigger:** Runs right after reactive state and methods are initialized, immediately before the component's HTML template is compiled and inserted into the DOM.
- **Use Cases:** Initializing non-reactive local variables, computing pre-render data, or setting up early event listeners.
- **DOM Availability:** The component's DOM element (`this.el`) is **not** yet attached to the document.

```javascript
// Inside component methods or class definition
onBeforeMount() {
  console.log('Component is about to mount. Reactive state is ready.');
  this._startTime = Date.now();
}
```

---

### 2. `onMount()`

- **Trigger:** Runs immediately after the component element is mounted to the document DOM.
- **Use Cases:** Fetching initial API data, querying DOM element dimensions, attaching global event listeners, or starting timers.
- **DOM Availability:** Fully mounted and accessible via `this.el`.

```html
<!-- src/components/UserProfile.component.js -->
<state user="null" isLoading="true" />

<action name="onMount">
  this.fetchUserData();
</action>

<action name="fetchUserData">
  try {
    const response = await fetch('/api/user');
    this.state.user = await response.json();
  } finally {
    this.state.isLoading = false;
  }
</action>
```

---

### 3. `onBeforeUpdate()`

- **Trigger:** Runs right before Avenx-JS patches the DOM following a reactive `state` or `props` change.
- **Use Cases:** Reading current DOM scroll positions, input cursor positions, or element dimensions before new state changes alter the DOM structure.

```javascript
onBeforeUpdate() {
  const container = this.el.querySelector('.chat-history');
  this._wasScrolledToBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
}
```

---

### 4. `onUpdate()`

- **Trigger:** Runs immediately after DOM diffing and patching complete.
- **Use Cases:** Re-initializing third-party JavaScript libraries (e.g. chart widgets, tooltips), adjusting scroll positions, or performing post-patch DOM measurements.

```javascript
onUpdate() {
  if (this._wasScrolledToBottom) {
    const container = this.el.querySelector('.chat-history');
    container.scrollTop = container.scrollHeight;
  }
}
```

:::caution
**Preventing Infinite Loops (`AVX_R11`):** Do not mutate reactive state synchronously inside `onBeforeUpdate()` or `onUpdate()`. Mutating state inside these hooks triggers another update cycle, causing an infinite loop.
:::

---

### 5. `onUnmount()`

- **Trigger:** Runs right before the component instance is unmounted and detached from the DOM.
- **Use Cases:** Cleaning up `setInterval`/`setTimeout` timers, removing global `window` event listeners, or unsubscribing from WebSocket channels.

```javascript
<action name="onMount">
  this._timerId = setInterval(() => {
    this.state.secondsElapsed++;
  }, 1000);
</action>

<action name="onUnmount">
  if (this._timerId) {
    clearInterval(this._timerId);
  }
</action>
```

---

### 6. `onActivate(params)` & `onDeactivate()`

- **Trigger:** Used exclusively for pages configured with `keepAlive: true` in the router.
- `onDeactivate()`: Runs when navigating away from a cached page instead of `onUnmount()`. The page instance remains in the LRU cache.
- `onActivate(params)`: Runs when returning to a cached page, receiving the latest route parameters.

```javascript
async onActivate(params) {
  console.log(`Restored cached page for user ID: ${params.id}`);
  await this.refreshUserFeed(params.id);
}

onDeactivate() {
  console.log('Page deactivated and saved to keepAlive cache.');
}
```

---

### 7. `onErrorCaptured(error, instance, info)`

- **Trigger:** Called when an unhandled exception is caught from a descendant child component.
- **Return Value:** Return `false` to stop error propagation up the component tree and prevent application crashes.

```javascript
onErrorCaptured(error, instance, info) {
  console.error(`Captured error from ${instance.constructor.name} during ${info}:`, error);
  this.state.hasError = true;
  this.state.errorMessage = error.message;
  return false; // Suppress further error propagation
}
```

---

## Defining Lifecycle Hooks in Components

In Avenx Single-File Components (`.component.js`), lifecycle hooks are declared using `<action>` tags with matching hook names:

```html
<state count="0" />

<action name="onMount">
  console.log('Component mounted successfully!');
</action>

<action name="onUnmount">
  console.log('Component cleanup completed.');
</action>

<div class="counter">
  <p>Count: {{ count }}</p>
</div>
```
