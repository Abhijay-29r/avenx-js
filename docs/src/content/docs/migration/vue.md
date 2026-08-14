---
title: 'Migrating from Vue to Avenx-JS'
description: 'Comprehensive guide for migrating Vue SFCs, Composition API, templates, directives, and Pinia stores to Avenx-JS.'
---

This guide details how to migrate applications built with **Vue 2 / Vue 3** to **Avenx-JS**.

---

## 1. Architectural Overview & Mental Model Shift

Vue single file components (`.vue`) encapsulate `<template>`, `<script>`, and `<style scoped>` in one file. Avenx-JS separates templates/logic into `.component.js` companion files and styling into `.component.css`, utilizing top-level compiler tags for state and computed properties.

| Concept | Vue | Avenx-JS |
| :--- | :--- | :--- |
| **Component Format** | Single File Component (`.vue`) | Companion files (`.component.js` + `.component.css`) |
| **Reactivity** | `ref()` / `reactive()` | Top-level `<state key="val" />` Proxy tag |
| **Computed Values** | `computed(() => fn)` | `<computed name="x" value="..." />` tag |
| **Loops & Directives** | `v-for`, `v-model`, `v-show`, `v-if` | `<@for>`, `data-ax-bind`, `data-ax-show`, ternary HTML |
| **Global Store** | Pinia (`defineStore`) / Vuex | **Bridges** (`AvenxBridge` in `src/global/*.bridge.js`) |

---

## 2. Component Structure and Templates

*This section will document SFC to companion file mapping, `<@for>` loop tags with implicit `index`, and `<slot>` transclusion.*

---

## 3. Directives and Event Handling

*This section will document translating Vue directives (`v-model`, `v-show`, `:class`, `:style`) and event syntax (`@click`) to Avenx.*

---

## 4. Reactivity, Ref, and Computed

*This section will document mapping `ref()`, `reactive()`, and `computed()` to `<state>` and `<computed>` tags without `.value` unwrapping.*

---

## 5. Global Stores & Pinia to Bridges

*This section will document migrating Pinia stores to `AvenxBridge` classes.*
