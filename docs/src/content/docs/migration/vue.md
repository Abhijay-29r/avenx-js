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

A Vue SFC wraps three concerns in one file: `<template>` (markup), `<script setup>` (logic), and `<style scoped>` (styles). Avenx-JS splits those same three concerns into **companion files**: a `.component.js` file that holds the HTML template plus top-level compiler tags for state and computed properties, and a `.component.css` file holding scoped styles. The template engine is plain HTML with a few compiler tags — see [Templates](/core-concepts/templates) for the full language, and the [Migration Overview](/migration/overview) for where companion files sit in the paradigm map.

### SFC to Companion File Mapping

| Vue SFC (`.vue`) | Avenx-JS |
| :--- | :--- |
| `<template>` | `.component.js` — the template IS the file's HTML |
| `<script setup>` | `.component.js` — `data-props-*` attributes, `<state />`, `<computed />`, `<@for>`, actions |
| `<style scoped>` | `.component.css` — `<@css>` named blocks bound via the `@css` attribute |
| `defineProps([...])` | `data-props-*` attributes on the component tag in the parent; read via `this.props.*` |

#### Before — Vue Single File Component (`.vue`)

```html
<!-- ItemList.vue -->
<template>
  <div class="list-container">
    <header>
      <slot name="header">Default Header</slot>
    </header>
    <ul>
      <li v-for="(item, idx) in items" :key="item.id">
        <span>{{ idx + 1 }}. {{ item.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps(['items']);
</script>

<style scoped>
.list-container { padding: 1rem; }
</style>
```

#### After — Avenx.js Companion Files

```html
<!-- src/components/item-list/item-list.component.js -->
<div class="list-container" @css container>
  <header>
    <slot name="header">Default Header</slot>
  </header>
  <ul>
    <@for item in this.props.items key="item.id">
      <li>
        <span>{{ index + 1 }}. {{ item.name }}</span>
      </li>
    </@for>
  </ul>
</div>
```

```css
/* src/components/item-list/item-list.component.css */
<@css>
  container {
    padding: 1rem;
  }
</@css>
```

Note the three changes that matter:

1. **The template is the file.** There is no `<template>` wrapper — the component's root element is whatever the `.component.js` file returns.
2. **Styles are scoped by name.** `<@css>` blocks are extracted, hashed into unique class suffixes, and bound to elements with the `@css` attribute (see [Styling](/core-concepts/styling)).
3. **Props come through `this.props`.** The parent passes `items` with `data-props-items="..."`, and the child reads `this.props.items` — no `defineProps` declaration needed.

### Loops: `v-for` → `<@for>`

Vue's `v-for` is an element directive; Avenx's `<@for>` is a **compiler tag** that wraps the repeated block. Loop blocks are translated to `<template>` tags and managed by the `ListManager` for efficient DOM list updates.

#### Before — Vue `v-for`

```html
<ul>
  <li v-for="(item, idx) in items" :key="item.id">
    <span>{{ idx + 1 }}. {{ item.name }}</span>
  </li>
</ul>
```

#### After — Avenx `<@for>`

```html
<ul>
  <@for item in this.props.items key="item.id">
    <li>
      <span>{{ index + 1 }}. {{ item.name }}</span>
    </li>
  </@for>
</ul>
```

### The Implicit `index` Variable

Every `<@for>` loop automatically injects a **zero-indexed `index` variable** into the loop template scope — `ListManager` adds it for you on each iteration. You never declare it:

```html
<@for item in this.props.items key="item.id">
  <span>{{ index + 1 }}. {{ item.name }}</span>
</@for>
```

:::caution
Do **not** write `(item, index) in list` inside `<@for>` like you would in Vue. `<@for>` takes exactly one item variable; the index is implicit and starts at `0`, so add `1` (as above) for a human-readable 1-based count.
:::

### Slots: Default and Named

Avenx supports both Vue-style **default** and **named** slots. The child component declares a `<slot>` element (with a fallback body); the parent supplies content with a `slot="name"` attribute. If the parent provides no content for a slot, the child's fallback content renders instead.

#### Before — Vue Named Slot

```html
<!-- Card.vue -->
<div class="card">
  <header>
    <slot name="header">Default Header</slot>
  </header>
  <main>
    <slot></slot>
  </main>
</div>
```

```html
<!-- Parent.vue -->
<Card>
  <h2 slot="header">Special Title</h2>
  <p>This content goes into the default slot!</p>
</Card>
```

#### After — Avenx Slots

```html
<!-- src/components/card/card.component.js -->
<div class="card" @css card>
  <header>
    <slot name="header">Default Header</slot>
  </header>
  <main>
    <slot></slot>
  </main>
</div>
```

```html
<!-- Parent template -->
<Card>
  <h2 slot="header">Special Title</h2>
  <p>This content goes into the default slot!</p>
</Card>
```

Named and default slot markup is identical between Vue and Avenx — only the file layout changes.

### Checking Slot Presence (`this.$slots.has()`)

A component can decide whether the parent actually supplied content for a slot using `this.$slots.has(slotName)` inside an action or logic block. This is the direct replacement for Vue's `this.$slots.header` checks:

```html
<!-- src/components/card/card.component.js -->
<div class="card">
  <h2 data-ax-show="this.$slots.has('header')">This card has a custom header</h2>
  <slot name="header">Default Header</slot>
</div>
```

`this.$slots.has()` returns `true` only when the parent passed matching content, letting you conditionally render fallback UI without emitting empty containers — pair it with `data-ax-show` (Avenx's conditional-visibility directive, the `v-if`/`v-show` replacement) as above. See [Slots and `$slots.has()`](/core-concepts/templates) in the Templates guide for the full details.

---

## 3. Directives and Event Handling

*This section will document translating Vue directives (`v-model`, `v-show`, `:class`, `:style`) and event syntax (`@click`) to Avenx.*

---

## 4. Reactivity, Ref, and Computed

*This section will document mapping `ref()`, `reactive()`, and `computed()` to `<state>` and `<computed>` tags without `.value` unwrapping.*

---

## 5. Global Stores & Pinia to Bridges

*This section will document migrating Pinia stores to `AvenxBridge` classes.*
