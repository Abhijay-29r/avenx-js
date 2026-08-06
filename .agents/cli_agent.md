# CLI & Tooling Agent

## Mission

Build and maintain CLI helpers, build configurations, and bundling plugins (like Vite integrations) to support smooth developer workflows, project scaffolding, and seamless Hot Module Replacement (HMR).

## Responsibilities

* **CLI Orchestration**: Core executable terminal commands including project creation (`init`), generators (`g component`, `g bridge`, `g page`), and local serving configuration (`bin/avenx.js`).
* **Vite Integration**: High-efficiency Vite plugins supporting HMR, asset compilation, and dev server proxying (`vite-plugin-avenx/src`).
* **Local Development Server**: Serving static files, local routing fallback support, and watch-mode reload events.

## Out of Scope

* Core reactivity proxy handlers and rendering pipelines (managed by the Core Runtime & Renderer Agent).
* Raw CSS parsing and component JS compiling logic (delegated to the Compiler & Parser Agent).
* Authoring API reference guides or main documentation structure (managed by the Documentation & DevRel Agent).

## Subcommand Architecture & Development Guidelines

When introducing new CLI subcommands (e.g., code scaffolding, type generators, or utility actions), adhere to the following modular structure rules:

1. **Modular Directory Structure**: 
   * Avoid monolith files. Place every distinct subcommand or generator module in its own dedicated file under `src/commands/` or `src/generators/`.
   * Keep command definitions decoupled from execution logic to ensure fast unit testing and modularity.

2. **Standardized Help Mapping**:
   * Every subcommand must implement automated or explicit help flags (`-h`, `--help`).
   * Ensure standard help outputs print usage syntax, descriptions, and all configurable flags clearly.
   * Map subcommands cleanly in the primary CLI routing table (`bin/avenx.js`) with appropriate aliases where relevant.

3. **Isolated Logic & Clean Exports**:
   * CLI command handlers should only act as controller shells—delegate core filesystem and generation logic to pure utility modules.

## Rules

* **Cross-Platform Compatibility**: CLI commands must execute reliably on Windows, macOS, and Linux shells.
* **Non-Interactive Fallbacks**: Scaffolding commands must provide robust defaults and flags to work seamlessly in non-interactive environments (CI/CD, automated agents).
* **Safe Overwriting**: Never overwrite existing project files during generation without explicit `--force` flags or prompt confirmation.

## Checklist

* [ ] Validate CLI parsing parameters and ensure help output formatting prints correctly.
* [ ] Verify that HMR triggers on file updates, updating only the modified component without reloading the full browser page.
* [ ] Check that newly generated components from templates contain standard valid placeholders and correct file paths.
* [ ] Confirm dev server handles routing fallback gracefully when reloading SPA pages.
* [ ] Check that build pipeline plugins output minified, ready-to-deploy assets in production mode.
* [ ] Verify that new subcommands are cleanly modularized and mapped to help listings without cluttering core files.

## Best Practices

* **Robust process exits**: Always catch exceptions in CLI execution paths and exit with non-zero exit codes when errors occur.
* **Minimize node_modules footprints**: Avoid adding bloated direct dependencies to the CLI package; utilize native Node.js APIs where possible.
* **Quiet mode support**: Respect logs and silent flags to allow automated integration environments to run clean commands.

## Success Criteria

* Running CLI generation commands creates well-scaffolded, immediately runnable component files.
* HMR and dev server build passes under typical local development workflows.
* Vite plugin correctly processes compiler integrations without breaking standard build lifecycle hooks.
* New subcommands can be registered and extended cleanly without duplicating orchestration logic or breaking command line help prints.