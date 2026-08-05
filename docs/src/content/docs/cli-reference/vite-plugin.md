---
title: 'Vite Plugin (vite-plugin-avenx)'
description: 'Official Vite plugin for Avenx-JS providing Single File Component (SFC) & Page compilation, CSS processing, and Hot Module Replacement (HMR).'
---

The `vite-plugin-avenx` package brings native [Vite](https://vitejs.dev/) integration to Avenx-JS projects. It executes during pre-transformation hooks (`enforce: 'pre'`), parses `.component.js` and `.page.js` files, processes companion CSS stylesheets, and triggers automatic reloads via Vite's Hot Module Replacement (HMR) architecture.

---

## Installation & Plugin Configuration

### Package Installation

Install `vite-plugin-avenx` along with `vite` as development dependencies in your project:

```bash
npm install -D vite-plugin-avenx vite
```

### Basic `vite.config.js` Setup

Register `avenxPlugin` inside the `plugins` array of your Vite configuration file:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import avenxPlugin from 'vite-plugin-avenx';

export default defineConfig({
  plugins: [
    avenxPlugin({
      debug: false,
    }),
  ],
});
```

---

## Plugin Options

The `avenxPlugin(options)` factory function accepts an optional configuration object:

```typescript
interface AvenxPluginOptions {
  /**
   * Enables detailed debug logging in the Vite dev server console.
   * @default false
   */
  debug?: boolean;

  /**
   * Configuration options passed directly to StyleProcessor.
   * @default {}
   */
  style?: Record<string, any>;
}
```

### Options Breakdown

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `debug` | `boolean` | `false` | When enabled, logs file resolution, stylesheet loading, compilation phases (`Compile Component`, `Compile Page`), and HMR events to stdout (`[vite-plugin-avenx] ...`). |
| `style` | `object` | `{}` | Options passed directly to internal `StyleProcessor` for CSS scoping, preprocessor handlers, or style transformations. |

---

## SFC & Page Compilation Lifecycle

`vite-plugin-avenx` intercepts source files in Vite's `transform` and `load` hooks using pre-defined file extensions.

```
Source Files (.component.js / .page.js)
        │
        ▼
   resolveId()  ──►  Check file naming conventions
        │
        ▼
     load()     ──►  Load & strip <@css> tags from .component.css / .page.css
        │
        ▼
   transform()  ──►  ComponentParser & StyleProcessor compilation
        │
        ▼
    wrapper     ──►  Wrap ES Module with default export (wrapComponent / wrapPage)
```

### 1. File Identification & Naming Conventions

The plugin inspects file suffixes using the following strict extensions:

- **Components:** `.component.js`
- **Pages:** `.page.js`
- **Component Styles:** `.component.css`
- **Page Styles:** `.page.css`

### 2. Automatic Class Name Derivation

The compiler (`createCompiler`) automatically derives the JavaScript class name from the source filename:

1. Strips the `.component.js` or `.page.js` extension from `path.basename(filePath)`.
2. Splits the remaining string by hyphens (`-`) or underscores (`_`).
3. Capitalizes each segment into PascalCase format.

**Examples:**

- `src/components/user-card.component.js` ➔ `UserCard`
- `src/pages/shopping_cart.page.js` ➔ `ShoppingCart`
- `src/components/nav.component.js` ➔ `Nav`

### 3. Stylesheet Preprocessing (`loadStyle`)

When Vite imports or resolves a `.component.css` or `.page.css` file, `loadStyle(filePath)` reads the file and strips `<@css>` and `</@css>` block markers if present:

```javascript
// Input stylesheet (.component.css)
<@css>
.user-card {
  display: flex;
  padding: 1rem;
}
</@css>

// Processed output loaded into module pipeline
.user-card {
  display: flex;
  padding: 1rem;
}
```

### 4. ES Module Wrapping (`wrapper.js`)

After `ComponentParser` finishes parsing the HTML template, state bindings, and component logic, the compiler wraps the output in standard ES module syntax:

#### Component Wrapping (`wrapComponent`):

```javascript
import { AvenxComponent } from 'avenx-core/core';

// [Compiled Component Logic]

export default UserCard;
```

#### Page Wrapping (`wrapPage`):

```javascript
import { AvenxPage } from 'avenx-core/runtime';

// [Compiled Page Logic]

export default ShoppingCart;
```

---

## Hot Module Replacement (HMR) Architecture

`vite-plugin-avenx` integrates with Vite's HMR system via the `handleHotUpdate(ctx)` hook.

```javascript
// hmr.js
export function handleAvenxHotUpdate(ctx) {
  const { file, server } = ctx;

  if (!isAvenxFile(file)) {
    return;
  }

  console.log('[HMR]', file);

  server.ws.send({
    type: 'full-reload',
  });

  return [];
}
```

### How HMR Works

1. **File Change Detection:** When a `.component.js`, `.page.js`, `.component.css`, or `.page.css` file is updated, Vite triggers `handleHotUpdate`.
2. **WebSocket Notification:** The plugin intercepts the update and sends a `{ type: 'full-reload' }` WebSocket signal to the client browser.
3. **Empty Module Array:** Returning `[]` instructs Vite to bypass standard module invalidation for that file, preventing duplicate re-execution during full reload.

### Vite Dev Server vs. Standalone `avenx dev` CLI

| Feature | `vite-plugin-avenx` (Vite) | `avenx dev` (CLI Dashboard) |
| :--- | :--- | :--- |
| **Development Server** | Vite Connect dev server | Native Node.js CLI server & dashboard |
| **Hot Reloading** | Vite WebSocket full reload (`server.ws`) | Custom SSE / polling reload server |
| **Module Bundling** | ESbuild pre-bundling & Rollup production builds | Avenx CLI compiler output |
| **Plugin Ecosystem** | Full access to Vite plugins (PostCSS, Tailwind, PWA, etc.) | Zero-config standalone environment |

---

## Full `vite.config.js` Boilerplate

Here is a complete, production-ready `vite.config.js` example for building single-page or multi-page Avenx applications:

```javascript
import { defineConfig } from 'vite';
import avenxPlugin from 'vite-plugin-avenx';
import path from 'node:path';

export default defineConfig({
  plugins: [
    avenxPlugin({
      debug: process.env.NODE_ENV === 'development',
      style: {
        scoped: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
```

---

## Troubleshooting Guide

### 1. Component or Page Is Not Compiling

* **Symptom:** Files are served as raw JavaScript or produce unexpected module export errors.
* **Cause:** The file name does not end with `.component.js` or `.page.js`.
* **Fix:** Ensure all component files strictly use `.component.js` and page files strictly use `.page.js`. Generic `.js` files are ignored by the plugin's `enforce: 'pre'` hooks.

### 2. Class Name Derivation Mismatches

* **Symptom:** Import statements or template references fail to find the exported component class.
* **Cause:** Filenames with non-alphanumeric characters or non-standard naming.
* **Fix:** `vite-plugin-avenx` derives class names by stripping extensions and splitting on `-` and `_`. Ensure filenames match expected conventions (e.g. `nav-bar.component.js` generates `NavBar`).

### 3. Duplicate `export default` Syntax Error

* **Symptom:** `SyntaxError: Identifier 'default' has already been declared`.
* **Cause:** Manually adding `export default` inside a `.component.js` or `.page.js` file.
* **Fix:** Do not write explicit `export default` statements inside component or page templates. The plugin automatically appends `export default ClassName` during module wrapping.
