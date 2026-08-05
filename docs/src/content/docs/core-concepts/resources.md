---
title: 'Resources & Async Data'
description: 'Learn how to handle asynchronous data fetching, dependency tracking, Suspense integration, and automatic re-fetching using the <resource> SFC tag and Resource API.'
---

Avenx-JS provides built-in reactive data fetching abstractions through the `<resource>` Single File Component (SFC) compiler tag and the runtime `Resource` class (`lib/core/reactive/Resource.js`). Resources automatically track reactive state dependencies using an internal `AvenxWatcher`, trigger automatic re-fetches when dependencies change, and expose a `.read()` method compatible with Suspense and Error Boundaries.

---

## SFC Compiler Tag Syntax (`<resource>`)

In Avenx Single File Components (`.component.js`), resources are declared at the top of component templates using `<resource>` tags. Avenx-JS supports two syntax formats:

### 1. Block Syntax

Use block syntax to define inline asynchronous expressions or multi-line fetch logic:

```html
<resource name="userData">
  return fetch(`/api/users/${state.userId}`).then(res => res.json());
</resource>
```

> [!NOTE]
> For single-line expressions in block syntax, if `return` is omitted and no trailing semicolon exists (e.g. `fetch('/api/data').then(r => r.json())`), the Avenx compiler automatically prepends `return` and appends a semicolon.

### 2. Self-Closing Syntax

Use self-closing syntax to delegate resource fetching to a component action/method or an inline string expression:

```html
<!-- Referencing an inline handler expression -->
<resource name="posts" handler="fetch('/api/posts').then(r => r.json())" />

<!-- Referencing a component action method -->
<resource name="profile" handler="this.fetchUserProfile" />
```

---

## Runtime `Resource` Class API

Under the hood, every declared resource creates an instance of the `Resource` class (`lib/core/reactive/Resource.js`).

### Constructor Signature

```javascript
import { Resource } from 'avenx-core/reactive';

const resource = new Resource(name, handlerFn, componentContext);
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Unique string identifier for the resource. |
| `handlerFn` | `function(): any` | Function executing the asynchronous operation (e.g., returning a `Promise`). |
| `componentContext` | `object` | The containing component instance context (`this`). |

---

## Instance Properties & States

Every `Resource` instance maintains the following public reactive properties:

```typescript
interface ResourceInstance<T = any> {
  /** Resource identifier string */
  name: string;

  /** Current lifecycle status */
  status: 'idle' | 'pending' | 'resolved' | 'rejected';

  /** Resolved data payload (undefined while pending/rejected) */
  value: T | undefined;

  /** Error instance or rejection reason (undefined if resolved/pending) */
  error: Error | any;

  /** Active Promise instance associated with the fetch */
  promise: Promise<T> | null;
}
```

### Resource Status Lifecycle

```
       ┌──────────┐
       │   idle   │
       └────┬─────┘
            │  (fetch initiated)
            ▼
       ┌──────────┐
       │ pending  │
       └────┬─────┘
            │
      ┌─────┴────────────┐
      ▼                  ▼
┌──────────┐       ┌──────────┐
│ resolved │       │ rejected │
└──────────┘       └──────────┘
```

| Status | Value Property (`resource.value`) | Error Property (`resource.error`) | Promise Property (`resource.promise`) |
| :--- | :--- | :--- | :--- |
| `'idle'` | `undefined` | `undefined` | `null` |
| `'pending'` | `undefined` | `undefined` | Active `Promise<any>` |
| `'resolved'` | Resolved result `T` | `undefined` | Resolved `Promise<T>` |
| `'rejected'` | `undefined` | Thrown `Error` / Reason | Rejected `Promise<any>` |

---

## Instance Methods

### `read()`

The `.read()` method provides a Suspense- and Error Boundary-compatible getter:

```javascript
const data = resource.read();
```

- **Pending:** If `status === 'pending'`, `read()` **throws `this.promise`**. Suspense boundaries catch this thrown Promise to display fallback loading UI.
- **Rejected:** If `status === 'rejected'`, `read()` **throws `this.error`**. Error Boundaries catch this thrown error to display fallback error UI.
- **Resolved:** If `status === 'resolved'`, `read()` returns `this.value`.

### `teardown()`

Cleans up the internal `AvenxWatcher` dependency tracker. This is invoked automatically when a component unmounts to prevent memory leaks and unnecessary background re-fetches:

```javascript
resource.teardown();
```

---

## Reactive Re-fetching & Render Lifecycle

`Resource` integrates directly with Avenx-JS reactivity (`AvenxWatcher`) and component update scheduler:

1. **Dependency Tracking:** When a `Resource` is constructed, it wraps `handlerFn` in an `AvenxWatcher`. Any reactive state property accessed during `handlerFn` execution (such as `state.userId` or `state.filter`) is automatically registered as a dependency.
2. **Automatic Re-fetching:** When any tracked state dependency mutates, `AvenxWatcher` triggers `resource.fetch(newVal)` automatically.
3. **Component Re-rendering:** When the async operation resolves or rejects, `Resource` marks `componentContext.renderWatcher.dirty = true` and invokes `componentContext.update()` to flush DOM updates.

---

## Complete SFC Example

The following Single File Component demonstrates a user directory search card using a `<resource>` tag, state dependency tracking (`state.searchQuery`), status checks, and error rendering:

```javascript
// src/components/user-search.component.js
export default {
  state: {
    searchQuery: 'alex',
  },

  actions: {
    updateQuery(event) {
      this.state.searchQuery = event.target.value;
    },
  },

  template: `
    <resource name="searchResults">
      return fetch(\`/api/users/search?q=\${state.searchQuery}\`)
        .then(res => {
          if (!res.ok) throw new Error('Search request failed');
          return res.json();
        });
    </resource>

    <div class="user-search-card">
      <input
        type="text"
        data-ax-bind="searchQuery"
        @input="updateQuery"
        placeholder="Search users..."
      />

      <!-- Pending Loading State -->
      <div data-ax-show="searchResults.status === 'pending'" class="spinner">
        Loading user search results for "{{ state.searchQuery }}"...
      </div>

      <!-- Rejected Error State -->
      <div data-ax-show="searchResults.status === 'rejected'" class="error-banner">
        Error: {{ searchResults.error?.message }}
      </div>

      <!-- Resolved Data State -->
      <ul data-ax-show="searchResults.status === 'resolved'" class="user-list">
        <li data-ax-for="user in searchResults.value">
          <strong>{{ user.name }}</strong> ({{ user.email }})
        </li>
      </ul>
    </div>
  `,
};
```
