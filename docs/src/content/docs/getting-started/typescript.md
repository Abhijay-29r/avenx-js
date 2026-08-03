---
title: 'TypeScript & JSDoc Support'
description: 'Configure IDE autocompletion, type-checking with jsconfig.json, and JSDoc annotations in Avenx-JS projects.'
---

Avenx-JS ships built-in TypeScript declarations (`.d.ts`), enabling full IDE autocompletion, hover documentation, and type safety for your single-file components, pages, state bridges, router guards, and custom directives — without requiring a complex TypeScript compilation build pipeline.

Whether you write Avenx Single-File Components (`.component.js` / `.page.js`), class-based state bridges (`AvenxBridge`), or route guards (`AvenxGuard`), Avenx-JS provides complete IDE support out of the box.

---

## Configuring `.vscode/jsconfig.json`

To enable type checking and intelligent code completion in VS Code or WebStorm, create or update `.vscode/jsconfig.json` at your project root:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "checkJs": true,
    "allowJs": true,
    "strict": false
  },
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### Compiler Options Explained

| Option | Value | Description |
| --- | --- | --- |
| `checkJs` | `true` | Enables real-time type checking and error reporting for `.js` files directly in your IDE. |
| `allowJs` | `true` | Allows JavaScript files to be imported and type-checked alongside TypeScript declarations. |
| `moduleResolution` | `"node"` | Resolves imports from `avenx-core` and `node_modules` automatically. |
| `target` | `"ESNext"` | Supports modern ES syntax, top-level `async/await`, and private fields. |

---

## Type Annotations with JSDoc

Avenx-JS components and framework utilities integrate seamlessly with JSDoc annotations.

### 1. Single-File Components (`.component.js`)

In Avenx-JS single-file components, state properties, actions, and computed getters are declared using `<state>`, `<action>`, and `<computed>` tags. You can add JSDoc comments to type state properties and action parameters:

```html
<!-- src/components/user-card.component.js -->
<state
  /** @type {string} */
  name="Alice"
  /** @type {number} */
  age="28"
/>

<action name="incrementAge">
  /** Increment user age */
  this.state.age++;
</action>

<computed uppercaseName>
  return this.state.name.toUpperCase();
</computed>

<div>
  <h3>{{ uppercaseName }}</h3>
  <p>Age: {{ age }}</p>
  <button @click="incrementAge()">Birthday</button>
</div>
```

---

### 2. Route Guards (`AvenxGuard`)

Route guards extend `AvenxGuard` and implement `canActivate(to, from)`. JSDoc annotations type route parameter objects and return values:

```javascript
// src/guards/auth.guard.js
import { AvenxGuard } from 'avenx-core/runtime';

export default class AuthGuard extends AvenxGuard {
  /**
   * Determines whether the route transition can proceed.
   *
   * @param {Object} to - Target route object (contains hash, page, params)
   * @param {Object} from - Current route object (contains hash, page, params)
   * @returns {boolean | string | Promise<boolean | string>}
   */
  canActivate(to, from) {
    const token = localStorage.getItem('authToken');

    if (!token) {
      // Redirect unauthorized users to login page
      return '#/login';
    }

    return true;
  }
}
```

---

### 3. Global State Bridges (`AvenxBridge`)

Bridges extend `AvenxBridge` and hold shared reactive state and methods across components. Type bridge properties and methods directly on the class:

```javascript
// src/bridges/theme.bridge.js
import { AvenxBridge } from 'avenx-core/runtime';

/**
 * @typedef {'light' | 'dark'} ThemeMode
 */

export default class ThemeBridge extends AvenxBridge {
  constructor() {
    super();
    /** @type {ThemeMode} */
    this.mode = 'dark';
  }

  /**
   * Updates the active UI theme mode.
   * @param {ThemeMode} newMode
   */
  setMode(newMode) {
    this.mode = newMode;
  }
}
```

---

### 4. Custom Directives (`app.directive`)

Register custom directives on `AvenxApp` with typed lifecycle hooks (`mounted`, `updated`, `unmounted`):

```javascript
import { AvenxApp } from 'avenx-core/runtime';

const app = new AvenxApp({ target: '#app' });

app.directive('focus', {
  /**
   * @param {HTMLElement} el
   */
  mounted(el) {
    el.focus();
  },
});
```

---

### 5. Programmatic Component Classes (`AvenxComponent`)

For unit testing, custom wrappers, or programmatic rendering, component classes extend `AvenxComponent<S>`:

```javascript
import { AvenxComponent } from 'avenx-core/runtime';

/**
 * @typedef {Object} UserState
 * @property {string} name
 * @property {number} age
 */

export default class UserCard extends AvenxComponent {
  /**
   * @param {Object} bridges
   * @param {Object} props
   */
  constructor(bridges, props) {
    /** @type {UserState} */
    const initialState = { name: 'Alice', age: 28 };
    super(initialState, {}, bridges, '<div>{{ state.name }}</div>', {}, props);
  }
}
```

---

## IDE Integration Tips

- **Autocompletion for Framework APIs**: Importing classes from `avenx-core/runtime` provides full IntelliSense for methods like `this.$watch()`, `this.$emit()`, `mount()`, and `setProps()`.
- **Hover Documentation**: Hovering over core framework classes or methods displays parameter types, return values, and JSDoc documentation directly in your editor.
- **Strict Null Checks**: If you set `"strictNullChecks": true` in `jsconfig.json`, wrap potentially undefined reactive properties in optional chaining (e.g., `this.state.user?.name`).
