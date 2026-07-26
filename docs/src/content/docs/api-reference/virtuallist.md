---
title: 'VirtualList'
description: 'Full API reference for the built-in VirtualList component.'
---

The `<VirtualList>` component is a built-in, globally available component designed for high-performance virtualized list rendering of massive datasets. It automatically handles dynamic element recycling, layout paddings, and dynamic item height updates.

## Props

| Prop | Type | Description |
| :--- | :--- | :--- |
| `items` | `Array` | The dataset array to be rendered in the list. |
| `itemHeight` / `item-height` | `Number` | The height of each item. Supports both camelCase (`itemHeight`) and kebab-case (`item-height`). |

> **Note:** `<VirtualList>` includes built-in `ResizeObserver` support to handle dynamic row resizing automatically.

---

## Usage Example

To pass templates into the `<VirtualList>`, use the `data-ax-as="item"` directive on your template slot.

The template exposes the following variables:

| Variable | Description |
| :--- | :--- |
| `item` | The current item being rendered. |
| `index` | The zero-based index of the current item in the list. |

```html
<VirtualList :item-height="50" :items="myLargeDataset">
  <template data-ax-as="item" let:item let:index>
    <div class="list-item">
      <span>#{{ index }}</span>
      <h3>{{ item.title }}</h3>
      <p>{{ item.description }}</p>
    </div>
  </template>
</VirtualList>

The `index` variable is automatically provided by `<VirtualList>` and represents the zero-based position of the current item in the rendered list.