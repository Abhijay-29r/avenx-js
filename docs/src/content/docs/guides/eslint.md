---
title: 'ESLint Template Validation'
description: 'Configure ESLint with avenxTemplateParser and componentTagNamingRule to enforce PascalCase component tag naming in Avenx SFC templates.'
---

Avenx-JS provides a dedicated custom ESLint parser (`avenxTemplateParser`) and rule (`componentTagNamingRule`) to validate Single-File Component (SFC) templates and enforce PascalCase component tag naming conventions across your codebase.

---

## Overview

### Why PascalCase Component Tags Are Required

In Avenx-JS templates, registered custom components must use **PascalCase** tag names (for example, `<UserProfileCard />` instead of `<user-profile-card>`).

- **Disambiguation from HTML Elements**: Native HTML tags (such as `<div>`, `<span>`, `<button>`) use lowercase. Enforcing PascalCase for custom component tags ensures both developers and the template compiler can immediately distinguish custom components from built-in DOM elements.
- **Automated Component Discovery**: Avenx component filenames (e.g. `user-profile-card.component.js`) map directly to canonical PascalCase tag names (`UserProfileCard`).
- **Consistency**: Enforcing PascalCase tag usage prevents inconsistent casing syntax across large applications.

### How ESLint Validates Avenx Templates

Validation relies on two tooling utilities exported from `avenx-core/tooling`:

- **`avenxTemplateParser`**: A custom parser (`lib/core/tooling/avenxTemplateParser.js`) that produces an ESLint-compatible AST for `.component.js` and `.page.js` files. It allows ESLint to inspect Avenx template markup and metadata tags (`<state>`, `<computed>`, `<action>`, `<resource>`) without syntax errors or breaking standard JavaScript parsing rules.
- **`componentTagNamingRule`**: An ESLint rule (`lib/core/tooling/eslintComponentTagNaming.js`) that extracts template markup, scans for custom component tags, and validates them against registered project components to ensure exact PascalCase casing.

---

## Setup with Flat Config (`eslint.config.mjs`)

ESLint 9+ uses Flat Config (`eslint.config.mjs`). Import `avenxTemplateParser` and `componentTagNamingRule` from `avenx-core/tooling/` and configure them as shown below:

```javascript
import avenxParser from 'avenx-core/tooling/avenxTemplateParser';
import { componentTagNamingRule } from 'avenx-core/tooling/eslintComponentTagNaming';

export default [
  {
    files: ['src/**/*.component.js', 'src/**/*.page.js'],
    languageOptions: {
      parser: avenxParser,
    },
    plugins: {
      avenx: {
        rules: {
          'component-tag-naming': componentTagNamingRule,
        },
      },
    },
    rules: {
      'avenx/component-tag-naming': ['error', {
        componentsDir: 'src/components',
      }],
    },
  },
];
```

---

## Rule Options Reference

The `avenx/component-tag-naming` rule accepts a single options object with the following properties:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `componentsDir` | `string` | Auto-detected | Relative path from project root to the directory containing component definitions. If omitted, Avenx auto-detects `srcDir` from `avenx.config.json` (defaults to `'src'`) and appends `/components`. |
| `componentNames` | `string[]` | `undefined` | Explicit list of registered PascalCase component names (e.g. `['UserProfileCard', 'AdminPanel']`). When set, filesystem scanning of `componentsDir` is bypassed. |

### Usage Options Examples

#### Auto-Detection with `componentsDir` (Recommended)

```javascript
rules: {
  'avenx/component-tag-naming': ['error', {
    componentsDir: 'src/components',
  }],
}
```

#### Explicit Component Array with `componentNames`

```javascript
rules: {
  'avenx/component-tag-naming': ['error', {
    componentNames: ['UserProfileCard', 'Header', 'Footer', 'NavigationMenu'],
  }],
}
```

---

## Error Messages & Diagnostics

When non-PascalCase component tags are detected in templates, `componentTagNamingRule` emits an error using the `invalidName` message ID.

### Message Template

```text
Avenx component <{{tagName}}> must use PascalCase: <{{expectedName}}>.
```

### Diagnostic Output Examples

Given a registered component named `UserProfile` (located at `src/components/user-profile/user-profile.component.js`):

| Template Code | Status | ESLint Diagnostic Output |
| :--- | :--- | :--- |
| `<UserProfile />` | ✅ Valid | Pass |
| `<user-profile />` | ❌ Error | `Avenx component <user-profile> must use PascalCase: <UserProfile>.` |
| `<userprofile />` | ❌ Error | `Avenx component <userprofile> must use PascalCase: <UserProfile>.` |
| `<userProfile />` | ❌ Error | `Avenx component <userProfile> must use PascalCase: <UserProfile>.` |
| `<div>`, `<button>` | ✅ Ignored | Native DOM tags are skipped. |
| `<my-web-component />` | ✅ Ignored | Unregistered custom elements are ignored. |
| `<state>`, `<action>` | ✅ Ignored | Avenx metadata blocks are masked and skipped. |

---

## IDE & CI/CD Integration

### Running ESLint via CLI

Validate your templates by running ESLint directly:

```bash
npx eslint .
```

You can add a script to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

Then run:

```bash
npm run lint
```

### Continuous Integration (CI/CD)

Integrate ESLint in your GitHub Actions workflow alongside `avenx check` to validate template tag naming in automated checks:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - name: Validate Templates with Avenx CLI
        run: npx avenx check
      - name: Lint Template Tag Naming with ESLint
        run: npx eslint .
```

### VS Code Integration

To see real-time ESLint error highlights in VS Code when editing `.component.js` and `.page.js` files:

1. Install the official [VS Code ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint).
2. Add the following to `.vscode/settings.json`:

```json
{
  "eslint.validate": [
    "javascript"
  ],
  "eslint.options": {
    "overrideConfigFile": "eslint.config.mjs"
  }
}
```
