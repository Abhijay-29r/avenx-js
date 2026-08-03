---
title: 'Configuration'
description: 'Configure Avenx-JS project paths, template overrides, and the local development server.'
---

Avenx-JS reads optional project settings from `avenx.config.json` in the project root. When the file is missing, the CLI uses the default values below.

```json
{
  "srcDir": "src",
  "distDir": "dist",
  "templatesDir": ".avenxtemplates",
  "server": {
    "port": 3000,
    "host": "localhost",
    "liveReload": true
  },
  "treeShakeComponents": true,
  "voidTags": []
}
```

## Options

| Option         | Type       | Default              | Rules                                                                 |
| -------------- | ---------- | --------------------- | ---------------------------------------------------------------------- |
| `srcDir`       | `string`   | `"src"`              | Non-empty relative path to application source files.                  |
| `distDir`      | `string`   | `"dist"`              | Non-empty relative path where compiled output is written.             |
| `templatesDir` | `string`   | `".avenxtemplates"`  | Non-empty relative path for local generator template overrides.       |
| `server.port`  | `number`   | `3000`                | Valid TCP port from `0` to `65535`.                                    |
| `server.host`  | `string`   | `"localhost"`         | Non-empty host name or address for the local dev server.              |
| `server.liveReload` | `boolean` | `true`              | Enables file watching, automatic browser reloads, and inspection script injection. |
| `enableProfiling` | `boolean` | `false` | Enables performance profiling by wrapping lifecycle hooks, rendering, and DOM patching with browser Performance API marks and measures. |
| `treeShakeComponents` | `boolean` | `true` | Removes unused components from the compiled bundle during compilation. Set to `false` to compile all discovered components. |
| `voidTags`     | `string[]` | `[]`                   | Extra tag names the compiler treats as void (self-closing), in addition to the built-in HTML void tags (`img`, `br`, `input`, etc.). Each entry must be a non-empty string. |

Path options must be relative paths. Absolute paths are rejected during configuration loading.

## Custom void tags

If your templates use custom or web-component tags that are always self-closing by convention (e.g. `<my-video>` without a trailing slash), list them under `voidTags` so the compiler doesn't wait for a closing tag that will never arrive:

```json
{
  "voidTags": ["my-video", "custom-icon"]
}
```

Tags written with an explicit self-closing slash, like `<my-video />`, are already parsed correctly without any configuration — `voidTags` is only needed for the no-slash convention.

## Tree Shaking Components

By default, Avenx-JS removes components that are not referenced by your application during compilation. This helps reduce the final bundle size and improves application performance.

If your project loads components dynamically or registers components through plugins, you may want to disable component tree shaking.

### Configuration

```json
{
  "treeShakeComponents": false
}
```

### Behavior

When `treeShakeComponents` is:

| Value | Behavior |
| ------ | -------- |
| `true` | Only components referenced by pages or other used components are included in the compiled bundle. |
| `false` | All discovered components are compiled, even if they are not referenced directly. |

In most applications, the default value of `true` should be used. Disable tree shaking only when your application depends on components that cannot be detected during compilation.

## CSS Preprocessor Settings

Avenx-JS supports configuring a CSS preprocessor through the `style` object in `avenx.config.json`.

### Configuration

```json
{
  "style": {
    "preprocessor": "scss"
  }
}
```

### Supported Preprocessors

The `preprocessor` option accepts one of the following values:

| Value | Description |
| ------ | ----------- |
| `sass` | Uses the Sass indented syntax. |
| `scss` | Uses the SCSS syntax for Sass. |
| `postcss` | Uses PostCSS for CSS transformations. |
| `less` | Uses the Less CSS preprocessor. |

### Fallback Behavior

If the configured preprocessor package is not installed, Avenx-JS falls back to raw CSS processing and emits the `AVX_W24` (`COMPILER_PREPROCESSOR_MISSING`) warning.

## Example

```json
{
  "srcDir": "app",
  "distDir": "public/build",
  "templatesDir": ".avenxtemplates",
  "server": {
    "port": 5173,
    "host": "0.0.0.0",
    "liveReload": false
  },
  "treeShakeComponents": false,
  "voidTags": ["my-video"]
}
```

The configuration is merged with the defaults, so you can override only the settings your project needs.

Set `server.liveReload` to `false` when the dev server should serve HTML without watching for changes or injecting the live-reload and inspection client script.

## Performance Profiling

Avenx-JS can generate high-resolution browser performance timings (marks and measures) for monitoring component rendering, mounting, and DOM patching.

### Activation Modes

Profiling can be enabled in two ways:

1. **Build Configuration (`avenx.config.json`)**:
   Enable profiling project-wide by setting `enableProfiling` to `true`:
   ```json
   {
     "enableProfiling": true
   }
   ```

2. **Dynamic Runtime Flag (`window.__avenx_enable_profiling`)**:
   Activate profiling dynamically in the browser console at runtime without restarting the application:
   ```javascript
   window.__avenx_enable_profiling = true;
   ```

---

### Performance Measure Format & Phases

When profiling is enabled, Avenx-JS wraps operations in native browser `performance.mark()` calls and outputs measures formatted as:

```text
[Avenx] ${componentName} - ${phase}
```

#### Measured Lifecycle Phases

| Phase | Description |
| --- | --- |
| `mount` | Initial mounting of the component instance and attachment to the DOM. |
| `render` | Resolving interpolations, directives, and compiling component templates. |
| `patch` | Reactive DOM diffing and patching when component `state` or `props` change. |
| `onMount` | Execution time for the component's `onMount()` lifecycle hook. |
| `onBeforeUpdate` | Execution time for the `onBeforeUpdate()` lifecycle hook prior to patching. |
| `onUpdate` | Execution time for the `onUpdate()` lifecycle hook post-patching. |
| `onUnmount` | Cleanup execution time during `onUnmount()`. |

---

### Programmatic Querying & Analysis

In addition to inspecting measures in the Chrome or Firefox DevTools **Performance** tab, you can query and analyze measures programmatically in the browser console using the native `Performance` API:

```javascript
// Retrieve all Avenx performance measure entries
const measures = performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('[Avenx]'));

// Display measure summary table in browser console
console.table(
  measures.map(m => ({
    Measure: m.name,
    'Duration (ms)': m.duration.toFixed(3),
    'Start Time (ms)': m.startTime.toFixed(2),
  }))
);

// Calculate total time spent patching DOM
const totalPatchTime = measures
  .filter(m => m.name.endsWith('- patch'))
  .reduce((sum, m) => sum + m.duration, 0);

console.log(`Total DOM Patching Time: ${totalPatchTime.toFixed(2)} ms`);
```


## Logging Options

Avenx-JS includes a configurable logging system that can be customized through the `logging` section in `avenx.config.json`.

This setting only controls the **CLI's build-time output** — the messages printed to your terminal while running commands like `avenx build` or `avenx dev`. It has no effect on logging inside your compiled application (the `logger` calls that run in the browser). To configure logging for your running app, pass a `logging` option to the `AvenxApp` constructor, or use the `AvenxLogger` class directly — see [AvenxLogger](/api-reference/utils/#avenxlogger) in the API reference.

### Configuration

```json
{
  "logging": {
    "level": "info",
    "silent": false
  }
}
```

### Available Options

| Option | Type | Default | Description |
| ------- | ---- | ------- | ----------- |
| `level` | `string` | `"info"` | Sets the minimum log level that will be displayed. |
| `silent` | `boolean` | `false` | Disables all logging output when set to `true`. |

### Supported Log Levels

Log levels are ordered by severity. Messages below the configured level are ignored.

| Level | Description |
| ------- | ----------- |
| `trace` | Very detailed diagnostic information. |
| `debug` | Debugging information useful during development. |
| `info` | General informational messages. |
| `warn` | Warning messages that do not stop execution. |
| `error` | Errors encountered during execution. |
| `fatal` | Critical errors requiring immediate attention. |
| `off` | Disables all logging. |
| `silent` | Alias for `off`. |

### Example: Enable Debug Logging

```json
{
  "logging": {
    "level": "debug"
  }
}
```

### Example: Disable All Logging

```json
{
  "logging": {
    "silent": true
  }
}
```

When both `silent` and `level` are provided, setting `silent` to `true` suppresses all log output regardless of the configured log level.
