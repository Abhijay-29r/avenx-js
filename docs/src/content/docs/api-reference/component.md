---
title: 'AvenxComponent API'
description: 'Full API reference for AvenxComponent properties, methods, and lifecycle hooks.'
---

The base class from which all standard UI components inherit. It manages reactivity, templates, lifecycle methods, and slot rendering.

## Properties

- `this.state` (Proxy): The reactive state instance for local properties. Changing state triggers updates automatically.
- `this.props` (Proxy): The reactive attributes passed by parent tags. Modifications from parents trigger updates.
- `this.$refs` (`Record<string, Element>`): Map of direct DOM element references marked with the [`data-ax-ref="refName"`](/core-concepts/directives#built-in-element-reference-directive-data-ax-ref) directive within the component template.
- `this.provide` / `provide()`: Defines state, properties, or methods to provide to descendant components.
- `static inject` / `this.inject`: Defines ancestor properties to inject and make available locally on `this`.

### `this.$refs` Reference Map

The `this.$refs` property provides direct access to HTML DOM elements declared in the component template via `data-ax-ref`:

```typescript
interface AvenxComponent {
  /**
   * Object mapping refName strings to target HTML DOM Elements.
   */
  readonly $refs: Record<string, Element>;
}
```

#### Key Behaviors & Architecture

- **Lazy Resolution & Batched Caching:** `this.$refs` resolves DOM references lazily upon first property access. Multiple reactive state updates queue dirty reference flags (`#refsDirty`) without performing eager, repetitive `querySelectorAll` DOM searches across intermediate re-renders.
- **Component Boundary Scoping:** References are strictly scoped to the declaring component. Elements with `data-ax-ref` located inside nested child component boundaries (`data-avenx-comp`) are excluded from parent `$refs`.
- **Lifecycle Availability:** `$refs` entries are populated once the component is mounted into the DOM (`onMount`, `onUpdate`). Accessing `$refs` prior to DOM mounting (`onBeforeMount`) returns an empty object (`{}`).
- **Automatic Teardown Cleanup:** When a component is unmounted (`unmount()`), `this.$refs` is automatically cleared and reset to `{}` to prevent memory leaks and dangling DOM references.

## `this.$slots`

The `this.$slots` object provides access to slots passed by the parent component. You can use `this.$slots.has()` to determine whether a specific slot was provided before rendering conditional content.

### `this.$slots.has(slotName = 'default')`

Checks whether a slot with the specified name exists.

#### Returns

- `true` if the slot is present.
- `false` otherwise.

#### Examples

```javascript
if (this.$slots.has()) {
  console.log("Default slot provided");
}

if (this.$slots.has("default")) {
  console.log("Default slot provided");
}

if (this.$slots.has("header")) {
  console.log("Header slot provided");
}

if (this.$slots.has("footer")) {
  console.log("Footer slot provided");
}

## Lifecycle Hooks

Implement these functions in your component logic to execute code at specific points in the component's lifespan:

## Component Lifecycle Hooks

Avenx-JS component instances transition through a well-defined lifecycle: creation, initial template compilation, DOM mounting, reactive updates, deactivation (for `keepAlive` pages), and unmounting.

You can implement lifecycle hooks either as `<action name="...">` tags inside Single-File Components (`.component.js` / `.page.js`) or as class methods when extending `AvenxComponent` / `AvenxPage`.

```html
<!-- Single-File Component (.component.js) Example -->
<state items="[]" isLoading="true" />

<action name="onBeforeMount">
  console.log('onBeforeMount: Template compiled, about to attach to DOM');
</action>

<action name="onMount">
  console.log('onMount: Attached to DOM. Fetching initial data...');
  this.loadItems();
</action>

<action name="loadItems">
  this.state.items = ['Item 1', 'Item 2'];
  this.state.isLoading = false;
</action>

<action name="onBeforeUpdate">
  console.log('onBeforeUpdate: Reactive state changed, about to patch DOM');
</action>

<action name="onUpdate">
  console.log('onUpdate: DOM patch complete');
</action>

<action name="onUnmount">
  console.log('onUnmount: Component detaching from DOM');
</action>

<div>
  <p data-ax-show="isLoading">Loading items...</p>
  <ul>
    <@for item="item" in="items">
      <li>{{ item }}</li>
    </@for>
  </ul>
</div>
```

```javascript
// Class-Based Component Example
export default class MyComponent extends AvenxComponent {
  onBeforeMount() {
    console.log('onBeforeMount');
  }

  onMount() {
    console.log('onMount');
  }

  onBeforeUpdate() {
    console.log('onBeforeUpdate');
  }

  onUpdate() {
    console.log('onUpdate');
  }

  onUnmount() {
    console.log('onUnmount');
  }

  onErrorCaptured(error, childInstance, info) {
    console.error('onErrorCaptured:', error, info);
    return false; // Prevent further error propagation
  }
}
```

### Complete Lifecycle Hooks Reference

| Hook Name | Parameters | Description |
| :--- | :--- | :--- |
| `onBeforeMount()` | None | Called after state and actions are set up, right before the component template is compiled and inserted into the DOM. |
| `onMount()` | None | Called immediately after the component element is attached to the DOM. Ideal for initial API data fetches, setting up timers, or DOM queries. |
| `onBeforeUpdate()` | None | Called right before the DOM is patched following a reactive state or props change. Useful for reading current DOM scroll positions or focus states. |
| `onUpdate()` | None | Called immediately after the DOM patch update finishes. Ideal for DOM measurements or re-initializing third-party UI widgets. |
| `onActivate(params)` | `params: Object` | Called whenever a cached page configured with `keepAlive: true` becomes active. Receives current route parameters. |
| `onDeactivate()` | None | Called when navigating away from a page configured with `keepAlive: true`. The page remains cached in memory rather than unmounted. |
| `onUnmount()` | None | Called right before the component element is unmounted and detached from the DOM. Use this to clean up timers, global event listeners, and subscriptions. |
| `onErrorCaptured(err, instance, info)` | `err: Error, instance: Object, info: String` | Called when an unhandled exception is caught from a descendant child component. Return `false` to stop error propagation. |

---

### Execution Order Lifecycle Flowchart

```mermaid
graph TD
    A["Constructor / State Init"] --> B["onBeforeMount()"]
    B --> C["Initial DOM Template Render"]
    C --> D["onMount()"]
    D --> E{"State / Props Changed?"}
    E -- "Yes" --> F["onBeforeUpdate()"]
    F --> G["DOM Patch Session"]
    G --> H["onUpdate()"]
    H --> E
    E -- "Component Removed" --> I["onUnmount()"]
    E -- "KeepAlive Page Inactive" --> J["onDeactivate()"]
    J -- "Re-activated" --> K["onActivate(params)"]
    K --> E
```

### Parent-Child Lifecycle Execution Order

When a parent component renders child components:

1. **Mount Phase**:
   - `Parent.onBeforeMount()`
   - `Child.onBeforeMount()`
   - `Child.onMount()` (Child mounts first)
   - `Parent.onMount()` (Parent mounts after all children finish mounting)

2. **Update Phase**:
   - `Parent.onBeforeUpdate()`
   - `Child.onBeforeUpdate()`
   - `Child.onUpdate()`
   - `Parent.onUpdate()`

3. **Unmount Phase**:
   - `Parent.onUnmount()`
   - `Child.onUnmount()`

---

### Example: Refreshing Data on Activation

Pages configured with `keepAlive: true` remain cached when users navigate away. Use `onActivate(params)` to refresh route-dependent data whenever the cached page becomes active again.

```javascript
class ProfilePage extends AvenxPage {
  async onActivate(params) {
    await this.loadProfile(params.id);
  }

  async loadProfile(id) {
    // Fetch the latest profile data
  }
}
```

Unlike `onMount()`, which runs only once when the component is first created, `onActivate(params)` runs every time a cached page is restored, making it the preferred place to reload data that depends on the current route.

### Error Boundaries with `onErrorCaptured`

The `onErrorCaptured(error, instance, info)` hook captures unhandled exceptions thrown by descendant child components during lifecycle execution or action evaluation.

- Return `false` from `onErrorCaptured` to stop error propagation up the component tree and prevent triggering global error handlers.
- Update reactive state inside `onErrorCaptured` to render fallback UI components cleanly.

```javascript
class ErrorBoundary extends AvenxComponent {
  onErrorCaptured(error, childInstance, info) {
    console.error(`Captured error from ${childInstance.constructor.name} during ${info}:`, error);
    this.state.hasError = true;
    this.state.errorMessage = error.message;
    return false; // Stop propagation
  }
}
```



## DOM Events

In addition to the lifecycle hooks above, which you implement _inside_ your component class, `AvenxComponent` also dispatches native DOM [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)s directly on the component's root element at the same points in its lifecycle. This makes it possible to hook into a component's lifecycle from _outside_ the component — for example, when integrating a third-party library, or when a parent script doesn't have direct access to the component instance.

| Event Name      | Dispatched                                                        |
| --------------- | ----------------------------------------------------------------- |
| `avenx:mount`   | After the component has mounted and `onMount()` has run.          |
| `avenx:update`  | After the component has updated and `onUpdate()` has run.         |
| `avenx:unmount` | Before the component is detached, just before `onUnmount()` runs. |

Because these are standard DOM events, you can attach listeners to them the same way you would any other native event, using `addEventListener`:

```javascript
const btn = new ButtonComponent();
btn.mount('#button-container');

// Listen for updates from outside the component
btn.el.addEventListener('avenx:update', () => {
  console.log('ButtonComponent updated — re-initializing third-party widget');
  someThirdPartyLibrary.refresh(btn.el);
});

btn.el.addEventListener('avenx:unmount', () => {
  console.log('ButtonComponent is about to unmount — cleaning up widget');
  someThirdPartyLibrary.destroy(btn.el);
});
```

This pattern is especially useful for integrating libraries that need to re-initialize themselves whenever the DOM changes (e.g. tooltip libraries, chart libraries, or jQuery plugins) without needing to modify the component's own source code.

## Core Methods

### `mount(target)`

Mounts the component to the target DOM element or selector.

```javascript
const btn = new ButtonComponent();
btn.mount('#button-container');
```

### `setProps(newProps)`

Updates the component's reactive `props` to match `newProps`. New or changed properties are applied, and properties omitted from `newProps` are removed. These reactive changes trigger the update scheduler, which queues a DOM patch with the component's updated props.

| Param      | Type     | Description                         |
| ---------- | -------- | ----------------------------------- |
| `newProps` | `object` | The complete set of props to apply. |

```javascript
const btn = new ButtonComponent();
btn.mount('#button-container');

btn.setProps({
  label: 'Saving...',
  disabled: true,
});
```

### `unmount()`

Cleans up event listeners and empties the mounted container.

### `nextTick(callback)`

Executes a callback or resolves a Promise after the current reactive update cycle finishes flushing pending DOM patches to the browser.

| Param | Type | Description |
| :--- | :--- | :--- |
| `callback` | `Function` (optional) | Callback function to execute after the microtask scheduler finishes flushing DOM updates. If omitted, returns a `Promise<void>`. |

```javascript
// 1. Callback pattern
this.state.items.push(newItem);
this.nextTick(() => {
  const lastItem = this.$element.querySelector('li:last-child');
  console.log('Last item height:', lastItem.offsetHeight);
});

// 2. Async/await Promise pattern
async function handleExpand() {
  this.state.isExpanded = true;
  await this.nextTick();
  this.$element.querySelector('.content').focus();
}
```


### `$watch(source, callback, options)`

Watches a reactive state property or computed getter for changes. Supports dot-separated string paths (e.g., `'user.settings.theme'`) or inline getter functions (`() => this.state.user.settings.theme`).

The method is also exposed inside template expressions and component methods.

| Param | Type | Description |
| :--- | :--- | :--- |
| `source` | `string \| Function` | Dot-separated string path (e.g. `'user.settings.theme'`) or getter function returning the watched value. |
| `callback` | `Function` | Invoked when the watched value changes. Receives `(newValue, oldValue)` as arguments. |
| `options` | `object` | Optional. Configuration options: `immediate`, `deep`, `flush`. |

#### Watcher Options (`options`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `immediate` | `boolean` | `false` | When `true`, executes the callback immediately upon watcher registration with the current value (`oldValue` is `undefined`). |
| `deep` | `boolean` | `false` | When `true`, recursively tracks deep object and array mutations within nested structures. |
| `flush` | `string` | `'pre'` | Controls callback execution timing relative to DOM updates: `'pre'` (before DOM patch), `'post'` (after DOM patch), or `'sync'` (synchronously). |

#### Usage Examples

```javascript
const comp = new SettingsComponent();

// 1. Basic watcher
comp.$watch('user.settings.theme', (newVal, oldVal) => {
  console.log(`Theme changed from ${oldVal} to ${newVal}`);
});

// 2. Immediate watcher for initial setup
comp.$watch('filterQuery', (query) => {
  this.fetchResults(query);
}, { immediate: true });

// 3. Deep watcher for nested state objects
comp.$watch('user.profile', (newProfile) => {
  console.log('Nested user profile updated:', newProfile);
}, { deep: true });

// 4. Post-flush watcher to access updated DOM nodes
comp.$watch('items.length', () => {
  const container = this.el.querySelector('.list-container');
  container.scrollTop = container.scrollHeight;
}, { flush: 'post' });
```


### `update()`

Forces a DOM patch and re-evaluates slots. Typically called automatically by the scheduler.

---

## Component Style Lifecycle & StyleMountManager

Avenx-JS manages component scoped CSS stylesheets dynamically in the browser runtime via the `StyleMountManager` singleton service.

Rather than bundling all component styles into a monolithic static CSS bundle or duplicating `<style>` tags for every component instance, `StyleMountManager` injects styles **lazily on demand** and manages their lifecycle using **instance reference counting**.

### Dynamic `<style>` Element Injection

When the first instance of a component class is mounted into the DOM:

1. `StyleMountManager` generates a unique style identifier for the component class (e.g. `data-avenx-style="avenx-style-UserCard"`).
2. It creates a `<style data-avenx-style="avenx-style-UserCard">` element in the document `<head>` containing the compiled scoped CSS rules.
3. It initializes an internal reference counter for the component class (`refCount = 1`).

```html
<!-- Automatically injected into document <head> on first mount -->
<style data-avenx-style="avenx-style-UserCard">
  .user-card[data-ax-c="c1"] { padding: 1rem; border-radius: 8px; }
  .user-card[data-ax-c="c1"] .avatar { width: 48px; height: 48px; }
</style>
```

---

### Instance Reference Counting

When additional instances of the same component class are created and mounted (for example, rendering 50 `<UserCard>` instances in a list):

- `StyleMountManager` detects that a `<style>` element for `avenx-style-UserCard` already exists in `<head>`.
- It increments the internal reference count (`refCount++`) without creating duplicate `<style>` tags.

| Mounted Instances | Action | `refCount` | `<head>` DOM State |
| :--- | :--- | :--- | :--- |
| **0** | None | `0` | No `<style>` tag present. |
| **1 (First)** | Injects `<style data-avenx-style="...">` | `1` | Single `<style>` tag created. |
| **2..N** | Increments ref count | `N` | Shared single `<style>` tag reused. |
| **N - 1 (Unmount)**| Decrements ref count | `N - 1` | `<style>` tag remains active. |
| **0 (Last Unmount)**| Detaches `<style>` element from `<head>` | `0` | `<style>` tag removed cleanly. |

---

### Automatic Unmount Cleanup

When a component instance unmounts:

1. `StyleMountManager` decrements the component class reference counter (`refCount--`).
2. When the reference counter reaches `0` (or no active instances of the component class remain in the DOM tree), `StyleMountManager` automatically removes the matching `<style>` tag from document `<head>` and purges its registry entry.

This automatic reference counting prevents CSS memory leaks, avoids stylesheet pollution in long-running Single Page Applications (SPAs), and ensures unused component styles do not accumulate as users navigate between pages.

