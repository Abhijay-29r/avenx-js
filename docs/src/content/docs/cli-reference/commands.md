---
title: 'CLI Commands'
description: 'Explore the command-line interface of Avenx-JS to create, compile, run, and watch projects.'
---

The `avenx` command line interface streamlines your development workflow. It handles application scaffolding, code generation, destruction, building, watching, serving, project architecture inspection, template validation, and environment health diagnostics.

## Command Syntax

```bash
npx avenx <command> [type] [name] [options]
```

---

## Global Flags & Options

The following flags can be passed globally to `avenx` commands:

| Option | Alias | Description | Supported Commands |
| :--- | :--- | :--- | :--- |
| `--dry-run` | `-d` | Previews file creation, modification, or deletion actions without modifying disk. | `generate`, `destroy` |
| `--force` | `-f` | Forces command execution by bypassing uncommitted Git working tree status checks. | `init`, `generate`, `destroy`, `build` |
| `--version` | `-v` | Displays the installed version of the Avenx-JS CLI package. | Global |

---

## Available Commands

### 1. `avenx init`

Scaffolds a new Avenx-JS application workspace structure in the current working directory.

#### Interactive Project Wizard (`runWizard`)

When invoked in an interactive terminal, `avenx init` launches an interactive setup wizard prompting for project preferences:

1. **Style Preprocessor Choice:**
   - `1. None (Vanilla CSS)` (Default)
   - `2. Sass (SCSS)`
   - `3. Less`
   - `4. PostCSS`
   *(Writes chosen preprocessor to `avenx.config.json` under `"style": { "preprocessor": "..." }`).*

2. **Layout Template Choice:**
   - `1. Blank (Minimal setup)` (Default)
   - `2. Routing (Basic navigation with Navbar, Home, and About pages)`

#### Generated Structure

- `src/components/`, `src/pages/`, `src/global/`, `src/guards/`, `dist/`
- `index.html`, `src/main.app.js`, `avenx.config.json`, `.vscode/settings.json`, `.vscode/jsconfig.json`

#### Options & Flags

| Flag / Option | Alias | Description |
| :--- | :--- | :--- |
| `-y`, `--yes` | | Bypasses interactive wizard prompts in TTY terminals and uses default choices (`none` preprocessor, `blank` layout). Recommended for CI/CD and automated scaffolding scripts. |
| `-i`, `--interactive` | | Forces interactive wizard prompts to run, even in non-TTY or piped terminal environments. |
| `-f`, `--force` | | Overwrites existing files or bypasses uncommitted Git working tree status checks. |

#### Environment Variables

- **`AVENX_FORCE_INTERACTIVE=true`**: When set in the environment, forces the interactive project wizard prompts to execute regardless of TTY status.

#### Usage Examples

```bash
# Interactive project scaffolding wizard
npx avenx init

# Non-interactive / CI scaffolding with default options
npx avenx init -y

# Force interactive wizard in piped or scripted environments
npx avenx init --interactive --force
```

---

### 2. `avenx generate` (alias: `g`)

Generates boilerplate code for components, pages, global state bridges, and navigation guards. Automatically registers new components and pages in `src/main.app.js`.

#### Subtypes

- **Component (`component`, `c`)**: Creates `src/components/<name>/<name>.component.js` and `.css`, and registers it in `main.app.js`.
- **Page (`page`, `p`)**: Creates `src/pages/<name>.page.js` and `.css` for client-side routing.
- **Bridge (`bridge`)**: Creates a shared reactive domain state class at `src/global/<name>.bridge.js` extending `AvenxBridge`.
- **Guard (`guard`)**: Creates a navigation guard class at `src/guards/<name>.guard.js` extending `AvenxGuard`.

#### Options

- `--dry-run` / `-d`: Previews generated files without writing to disk.
- `--force` / `-f`: Bypasses Git working tree status checks.

#### Usage Examples

```bash
# Generate component
npx avenx g counter

# Generate page with alias
npx avenx g p dashboard

# Preview page generation without writing to disk
npx avenx g p user-profile --dry-run

# Generate shared reactive bridge
npx avenx g bridge shopping-cart

# Generate route guard
npx avenx g guard auth
```

---

### 3. `avenx destroy` (alias: `d`)

Removes scaffolded component, page, bridge, or guard files and automatically cleans up their import statements and registrations inside `src/main.app.js`.

#### Subtypes

- **Component (`component`, `c`)**: Deletes `src/components/<name>/` and cleans up `main.app.js`.
- **Page (`page`, `p`)**: Deletes `src/pages/<name>.page.js` and `.css`.
- **Bridge (`bridge`)**: Deletes `src/global/<name>.bridge.js`.
- **Guard (`guard`)**: Deletes `src/guards/<name>.guard.js`.

#### Options

- `--dry-run` / `-d`: Previews files that would be removed without deleting anything.
- `--force` / `-f`: Bypasses Git working tree status checks.

#### Usage Examples

```bash
# Delete component and clean up registrations
npx avenx d counter

# Preview page deletion
npx avenx d p dashboard --dry-run
```

---

### 4. `avenx build` (alias: `b`)

Compiles all component templates, scoped stylesheets, page components, and global bridges into single distribution bundle files in `distDir`.

#### Features & Distribution Files

- Compiles `.component.js` files and extracts `<state>`, `<action>`, and `<computed>` tags.
- Bundles and scopes component CSS rules.
- Performs automatic component tree-shaking when `treeShakeComponents: true`.
- Evaluates build-time template validation rules.
- Generates JavaScript (`<outputName>.js`) and CSS (`<outputName>.css`) distribution bundles.

#### Custom Output Bundle Names (`outputName`)

By default, `avenx build` generates `dist/bundle.js` and `dist/bundle.css`. Configure `outputName` in `avenx.config.json` to override filenames:

```json
{
  "outputName": "app.bundle"
}
```

Running `avenx build` with the above configuration produces:

```text
dist/
├── app.bundle.js
├── app.bundle.css
└── app.bundle.css.map
```

Be sure to reference the customized bundle filenames in your `index.html` entry point:

```html
<link rel="stylesheet" href="dist/app.bundle.css" />
<script src="dist/app.bundle.js"></script>
```

#### Usage Examples

```bash
npx avenx build
```

---

### 5. `avenx watch` (alias: `w`)

Runs an initial build and continuously watches the `src/` directory for code changes, automatically re-building the project distribution files upon every file edit.

Unlike `avenx serve`, `watch` does not launch a local web server or inject live-reload client scripts.

```bash
npx avenx watch
```

Press `Ctrl + C` to terminate watch mode.

---

### 6. `avenx serve`

Launches a local live-reloading development server with automatic file watching and an embedded **Inspection Dashboard**.

#### Options & Flags

- `--port <number>`, `-p <number>` (or positional argument `avenx serve 8080`): Sets the development server TCP port (default: `3000`).
- `--host <string>`, `-h <string>`: Sets the host bind address (default: `localhost`).
- `--no-live-reload` / `--live-reload=false`: Disables file watching, live reload SSE client script injection, and automatic browser refreshes.

#### Visual Inspection Dashboard (`/__avenx-inspect`)

Access `http://localhost:3000/__avenx-inspect` while the dev server is running to inspect active routes, registered components, global bridges, and compiler options in real-time.

```bash
# Start server on default port 3000
npx avenx serve

# Custom port and host
npx avenx serve 8080 --host 0.0.0.0

# Disable live reload script injection
npx avenx serve --no-live-reload
```

---

### 7. `avenx check` (alias: `lint`)

Parses and validates all project templates without writing build outputs to disk. Ideal for Continuous Integration (CI/CD) pipelines.

#### Exit Codes

- `0`: Validation successful (no template warnings or errors detected).
- `1`: Validation failed (template syntax errors or elevated warnings detected).

```bash
npx avenx check
```

---

### 8. `avenx inspect` (alias: `i`)

Scans the project `src/` directory and outputs a formatted terminal tree view displaying pages (with mapped route paths), components (annotated with unused warnings), and global state bridges offline without launching a development server.

#### Command Purpose

The `avenx inspect` command analyzes application architecture, route mappings, and component utilization offline. It allows developers to quickly audit project structure, inspect route registrations, and detect orphaned components without launching a development server or browser environment.

#### Terminal Output Hierarchy

`avenx inspect` categorizes the project structure into three tree branches:

- **📄 Pages**: Lists page components (`src/pages/*.page.js`) alongside their mapped route paths (e.g. `/home`, `/user/:id`).
- **🧩 Components**: Lists UI components (`src/components/*`) annotated with `(⚠️ Unused)` warnings when unreferenced.
- **🌉 Bridges**: Lists global reactive state bridges (`src/bridges/*` or `src/global/*.bridge.js`).

#### Unused Component Detection

`avenx inspect` scans application templates, scripts, and `app.mount()` calls. If a component defined in `src/components/` is not referenced in any template tags or mount declarations, `avenx inspect` automatically flags it with `(⚠️ Unused)` in the hierarchy view.

#### Usage Example & Output Sample

```bash
# Print project route and component hierarchy
npx avenx inspect

# Or using the shorthand alias
npx avenx i
```

**Sample Output:**

```text
📦 Avenx Project Hierarchy (src/)
├── 📄 Pages (2)
│   ├── HomePage (/home) -> src/pages/home.page.js
│   └── UserPage (/user/:id) -> src/pages/user.page.js
├── 🧩 Components (2)
│   ├── Header -> src/components/header/header.component.js
│   └── UnusedBtn -> src/components/unused-btn/unused-btn.component.js (⚠️ Unused)
└── 🌉 Bridges (1)
    └── AuthBridge -> src/bridges/auth.bridge.js
```

---

### 9. `avenx doctor`

Runs environment, project configuration, directory structure, and Git working tree diagnostics to ensure your workspace meets Avenx-JS project health requirements.

#### Command Purpose & When to Run

The `avenx doctor` command performs comprehensive diagnostic health checks on your local development environment and project setup. Run this command when:
- Setting up or troubleshooting a newly scaffolded project workspace.
- Verifying environment compatibility and configuration in Continuous Integration (CI/CD) pipelines.
- Debugging unexpected build, styling, or routing issues.

#### Diagnostics Performed

`avenx doctor` checks the following areas:

1. **Node.js Environment**:
   - Verifies that Node.js version is `>= 18.0.0`.
2. **Project Configuration**:
   - Checks presence and JSON validity of `package.json`.
   - Validates `avenx.config.json` schema and emits warnings for unknown or unsupported configuration keys across top-level fields, `server`, `style`, `debug`, and `logging` blocks.
3. **Project Structure**:
   - Validates existence of the source directory (`src/` or custom `srcDir`) and build output directory (`dist/` or custom `distDir`).
   - Checks for recommended subdirectories: `src/components/`, `src/pages/`, and `src/global/`.
   - Verifies presence of `.vscode/jsconfig.json` (editor path aliases) and root `index.html`.
4. **Git Repository Status**:
   - Checks Git status and warns if the working tree has uncommitted local changes.

#### Exit Codes

- `0`: Diagnostic checks passed successfully (or only non-critical warnings were reported).
- `1`: Diagnostic checks failed due to critical errors (e.g., Node.js version lower than required, missing or invalid `package.json`, or malformed configuration).

#### Usage Examples

```bash
# Run environment and project health diagnostics
npx avenx doctor
```

---

### 10. `avenx clean`

Deletes the target build distribution directory (typically `dist/` or configured `distDir`) to ensure a fresh build state.

```bash
npx avenx clean
```

---

### 11. `avenx help`

Prints the CLI usage manual and command reference to the console.

```bash
npx avenx help
```



