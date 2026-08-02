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

Avenx-JS can generate browser performance timings for debugging rendering behavior.

### Configuration

Enable profiling by setting `enableProfiling` to `true` in `avenx.config.json`:

```json
{
  "enableProfiling": true
}
```md
### Analyzing Performance Traces

To analyze Avenx-JS performance timings:

1. Open your application in Chrome or Firefox.
2. Open Developer Tools.
3. Navigate to the **Performance** panel.
4. Start recording.
5. Perform actions that trigger component updates.
6. Stop the recording.
7. Inspect the recorded user timing marks and measures for Avenx-JS operations.

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
