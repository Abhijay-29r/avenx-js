---
title: 'TypeScript & JSDoc Support'
description: 'Configure IDE autocompletion, type-checking with jsconfig.json, and JSDoc annotations in Avenx-JS projects.'
---

Avenx-JS ships built-in TypeScript declarations (`.d.ts`), enabling full IDE autocompletion, hover documentation, and type safety for your components, pages, bridges, and router guards — without requiring a complex TypeScript compilation build pipeline.

Whether you write pure JavaScript annotated with JSDoc or type-checked code via VS Code's `"checkJs"`, Avenx-JS provides complete IDE support out of the box.

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

Avenx-JS components inherit from `AvenxComponent<S>`, where `S` represents the shape of the component's reactive `state`.

### 1. Component State & Props Typing

Use JSDoc `@typedef` and generic type annotations to type reactive `state` and component `props`:

```javascript
import { AvenxComponent } from 'avenx-core/runtime';

/**
 * @typedef {Object} UserState
 * @property {string} name - User display name
 * @property {number} age - User age in years
 * @property {boolean} isActive - Account activation status
 */

/**
 * @typedef {Object} UserCardProps
 * @property {string} userId - Unique user identifier
 */

export default class UserCard extends AvenxComponent {
  /**
   * @param {Object} bridges - Registered global bridges
   * @param {UserCardProps} props - Component properties
   */
  constructor(bridges, props) {
    /** @type {UserState} */
    const initialState = {
      name: 'Alice',
      age: 28,
      isActive: true,
    };

    super(
      initialState,
      {
        /** @this {UserCard} */
        toggleStatus() {
          this.state.isActive = !this.state.isActive;
        },
      },
      bridges,
      '<div>{{ state.name }} ({{ state.age }})</div>',
      {},
      props
    );
  }
}
```

### 2. Page Components (`AvenxPage`)

Page components extend `AvenxPage` and can annotate dynamic parameters, registered subcomponents, and route lifecycle hooks:

```javascript
import { AvenxPage } from 'avenx-core/runtime';

/**
 * @typedef {Object} DashboardState
 * @property {number} activeUsers - Number of active concurrent users
 * @property {boolean} isLoading - Loading state indicator
 */

export default class DashboardPage extends AvenxPage {
  /**
   * @param {Object} bridges
   * @param {Map<string, typeof AvenxComponent>} registry
   */
  constructor(bridges, registry) {
    /** @type {DashboardState} */
    const initialState = {
      activeUsers: 0,
      isLoading: true,
    };

    super(initialState, {}, bridges, '<div>Dashboard</div>', {}, registry);
  }

  /**
   * Executed when the page mounts to the DOM.
   * @returns {Promise<void>}
   */
  async onMount() {
    this.state.isLoading = true;
    this.state.activeUsers = await this.fetchMetrics();
    this.state.isLoading = false;
  }

  /**
   * @private
   * @returns {Promise<number>}
   */
  async fetchMetrics() {
    return 142;
  }
}
```

### 3. Route Guards (`AvenxGuard`)

Annotate parameter types (`to`, `from`) and return types (`boolean | string | Object`) in route guard `canActivate` methods:

```javascript
import { AvenxGuard } from 'avenx-core/runtime';

export default class AuthGuard extends AvenxGuard {
  /**
   * Determines whether a route transition can proceed.
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

### 4. Global State Bridges (`AvenxBridge`)

Type global reactive bridges to get autocompletion across all consuming components:

```javascript
import { AvenxBridge } from 'avenx-core/runtime';

/**
 * @typedef {Object} ThemeState
 * @property {'light' | 'dark'} mode - Active UI theme
 */

export default class ThemeBridge extends AvenxBridge {
  constructor() {
    /** @type {ThemeState} */
    const state = {
      mode: 'dark',
    };

    super(state, {
      /** @param {'light' | 'dark'} newMode */
      setMode(newMode) {
        this.state.mode = newMode;
      },
    });
  }
}
```

---

## IDE Integration Tips

- **Autocompletion for Framework APIs**: Importing classes from `avenx-core/runtime` provides full IntelliSense for methods like `this.$watch()`, `this.$emit()`, `mount()`, and `setProps()`.
- **Hover Documentation**: Hovering over core framework classes or methods displays parameter types, return values, and JSDoc documentation directly in your editor.
- **Strict Null Checks**: If you set `"strictNullChecks": true` in `jsconfig.json`, wrap potentially undefined reactive properties in optional chaining (e.g., `this.state.user?.name`).
