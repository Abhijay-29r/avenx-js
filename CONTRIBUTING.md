# Contributing to Avenx.js

First of all, thank you for your interest in contributing to Avenx.js!

Avenx.js is an open-source JavaScript framework focused on simplicity, maintainability, and developer experience. Every contribution, whether it's code, documentation, bug reports, or ideas, helps improve the project.

## Before You Start

Before creating a contribution, please:

* Search existing issues and pull requests to avoid duplicates.
* Open an issue for larger changes or new features before implementing them.
* Ensure your proposal aligns with the goals of Avenx.js.

## Architecture & Codebase Overview

Before contributing to the compiler, runtime, or CLI, please read the [Contributor Architecture Guide](https://docs.avenx-js.com/contributing/architecture/) for an in-depth map of the compile pipeline, runtime data flow, and test tiers.

## Diagnostic Codes

Avenx.js uses stable diagnostic codes for compiler errors, runtime errors, and warnings. The authoritative registry of diagnostic codes is `lib/core/runtime/AvenxError.js`, which exports `AvenxErrorCodes`.

When adding a new diagnostic code:

1. Add the new code to `AvenxErrorCodes` in `lib/core/runtime/AvenxError.js`.
2. Add its human-readable message template to `AvenxErrorMessages` in the same file.
3. Add the corresponding structured entry to `lib/core/diagnostics/catalogue.js`, including its name, severity, category, summary, causes, remedies, and documentation URL.
4. Update the diagnostic documentation in `docs/src/content/docs/troubleshooting/errors.md` when the new code requires user-facing troubleshooting guidance.
5. Add or update tests covering the new diagnostic where appropriate.

Do not maintain a separate manual list of diagnostic codes in root-level documentation. The runtime registry is the source of truth for which codes exist, while the diagnostic catalogue provides their structured descriptions.

For compiler error classes, see `docs/src/content/docs/troubleshooting/errors.md`, which documents `CompilerError`, `TemplateValidationError`, `StyleCompilerError`, and `BuildError`.

## Local Development Workflow

A quick start for working on the codebase:

1. **Clone and install dependencies**:

   ```bash
   npm install
   ```

## Plugin tests

Official plugins under `plugins/` ship their own suites. From the repository root run:

```bash
npm run test:plugins
```

CI runs this after `npm test`. Prefer fixing a plugin failure against the working-tree core rather than a published `avenx-core`.
