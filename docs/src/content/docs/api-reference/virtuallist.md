---
title: 'VirtualList'
description: 'Full API reference and template slot scope documentation for the built-in VirtualList component.'
---

The `<VirtualList>` component is a built-in, globally available component designed for high-performance virtualized rendering of large datasets. It dynamically recycles DOM elements and only renders rows currently visible within the viewport scroll area.

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `items` | `Array` | `[]` | The array of dataset items to render in the virtual list. |
| `itemHeight` / `item-height` | `Number` | `40` | Default row height in pixels. Supports both camelCase (`itemHeight`) and kebab-case (`item-height`). |

> [!NOTE]
> `<VirtualList>` incorporates a built-in `ResizeObserver` to monitor item sizes and container dimensions automatically, adjusting scroll offsets when dynamic content resizes.

---

## Template Slot Scope & `index` Variable

To define row markup inside `<VirtualList>`, place a `<template data-ax-as="...">` slot tag inside the `<VirtualList>` component element. 

The slot scope automatically exposes two variables during rendering:

| Variable | Type | Description |
| :--- | :--- | :--- |
| `item` *(or custom alias)* | `Object \| any` | The dataset item object for the current row. Customize the variable name using `data-ax-as="alias"`. |
| `index` | `Number` | The zero-based numerical index of the current item in the `items` array. |

---

## Usage Examples

### 1. Basic Usage with `index` and Item Properties

```html
<state items="[
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' }
]" />

<VirtualList :item-height="50" :items="items">
  <template data-ax-as="user">
    <div class="user-row">
      <span class="user-index">#{{ index + 1 }}</span>
      <span class="user-name">{{ user.name }}</span>
    </div>
  </template>
</VirtualList>
```

### 2. Custom Item Alias (`data-ax-as`)

By default, the item variable is named `item`. Use `data-ax-as="customName"` on the `<template>` element to rename the item variable while keeping `index` available:

```html
<VirtualList :item-height="60" :items="products">
  <template data-ax-as="product">
    <div class="product-item">
      <span class="badge">Row {{ index }}</span>
      <strong>{{ product.title }}</strong> — ${{ product.price }}
    </div>
  </template>
</VirtualList>
```