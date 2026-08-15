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

Vue 3 manages reactive state with Composition API primitives (`ref()`, `reactive()`, `computed()`) or the Options API (`data()`, `computed`). Avenx-JS unifies reactive state and derived values into **two top-level compiler tags**: one `<state />` tag holds every reactive property, and `<computed />` tags declare derived values. There are no `.value` wrappers and no setters — state is a reactive Proxy you mutate directly, and the template re-evaluates for you. See [Reactive State](/core-concepts/reactivity) for the full model and [Computed Properties](/core-concepts/computed) for derivations, plus the [Migration Overview](/migration/overview) for where this sits in the paradigm map.

### Replacing `ref()` and `reactive()` with One `<state />` Tag

Every Vue ref and reactive object collapses into **one** `<state />` tag at the top of the component — each attribute is one reactive property. The tag sits in the `.component.js` file, is parsed at compile time, and is stripped before the class is emitted.

#### Before — Vue 3 Composition API (`ref` / `reactive`)

```javascript
import { ref, reactive } from 'vue';

const count = ref(0);
const user = reactive({ name: 'Jane', role: 'admin' });

function increment() {
  count.value++;
}
```

#### After — One Avenx `<state />` Tag

```html
<!-- src/components/counter/counter.component.js -->
<state count="0" user='{"name": "Jane", "role": "admin"}' />

<action name="increment">
  state.count++;
</action>

<div>
  <p>Count: {{ state.count }}</p>
  <p>User: {{ state.user.name }} ({{ state.user.role }})</p>
  <button @click="increment()">Increment</button>
</div>
```

Attribute values are coerced to their JavaScript types — numbers, booleans, arrays, and objects all work. `@click="increment()"` calls the action defined by the `<action>` tag (see [Events](/core-concepts/events)).

### No `.value` Unwrapping

Vue's `ref()` returns a wrapper object, so script blocks read `count.value` and write `count.value = 1`. Avenx state properties are accessed **directly** — `state.count`, not `state.count.value` — because `state` is already the reactive Proxy. The same is true in expressions: `{{ state.count }}`, not `{{ state.count.value }}`.

:::caution
In Vue you can pass `ref` objects around and read `.value` wherever they land. In Avenx there is no wrapper to pass around: if you need a value outside the template, reference `state.<name>` in the action that consumes it.
:::

### JSON Attribute Rules for Objects and Arrays

`<state />` attributes are evaluated as JSON/JavaScript expressions. The one rule to remember: **object and array values must be valid JSON strings** — wrap them in single quotes and use double quotes inside:

```html
<state user='{"name": "Jane", "role": "admin"}' tags='["student", "verified"]' />
```

This is the one formatting difference Vue developers hit most: bare `{ name: "Jane" }` or single quotes inside the value are not valid JSON, and the attribute will not parse as you expect.

### Replacing `computed()` with `<computed />`

A Vue `computed(() => expr)` becomes a `<computed name="..." value="..." />` tag. The `value` attribute is a stringified JavaScript expression that can reference `state` properties and other computed names.

#### Before — Vue `computed()`

```javascript
import { ref, reactive, computed } from 'vue';

const count = ref(0);
const user = reactive({ name: 'Jane', role: 'admin' });

const doubleCount = computed(() => count.value * 2);
const greeting = computed(() => `Hello ${user.name}, count is ${count.value}`);
```

#### After — Avenx `<computed />` Tags

```html
<state count="0" user='{"name": "Jane", "role": "admin"}' />
<computed name="doubleCount" value="state.count * 2" />
<computed name="greeting" value="'Hello ' + state.user.name + ', count is ' + state.count" />

<div>
  <p>{{ greeting }} (Double: {{ doubleCount }})</p>
</div>
```

Template literals like Vue's `` `Hello ${user.name}` `` become string concatenation in the `value` expression (template literals inside an HTML attribute are awkward to escape); the computed tag accepts any stringified JS expression, so concatenation works cleanly.

### No Vue Watchers

Vue's `watch()`, `watchEffect()`, and the Options API `watch` option have **no direct counterpart** in Avenx. You do not subscribe to changes — every mutation of `state` re-renders the template automatically, and `<computed />` covers the "react to a state change with a derived value" case that `watch` is often used for.

```javascript
// Vue: imperative side effect on change
watch(count, (next) => console.log('count is', next));
```

```html
<!-- Avenx: derived value declared once; the template re-evaluates on state change -->
<computed name="countLog" value="'count is ' + state.count" />
```

If you genuinely need to run a side effect when a value changes, Avenx does offer `this.$watch(source, callback, options)` as an advanced, explicit tool — but it is an Avenx API, not Vue's `watch`, and most Vue `watch` usages (derived UI state, logging, syncing) are better expressed as `<computed />` or as work inside the action that mutates the state. See [Watchers](/core-concepts/reactivity#watchers--advanced-options-watch) in the Reactivity guide.

---

## 5. Global Stores & Pinia to Bridges

*This section will document migrating Pinia stores to `AvenxBridge` classes.*
