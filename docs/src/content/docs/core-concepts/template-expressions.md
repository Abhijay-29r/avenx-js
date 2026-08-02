---
title: 'Template Expressions & Data Binding'
description: 'Learn how to use template expressions, event binding syntax, and structural directives inside Avenx-JS component templates.'
---

Avenx-JS templates use a small, declarative expression syntax to bind state, handle events, and control structure directly inside your HTML.

## Interpolation

Use double curly braces `{{ }}` to interpolate reactive state or computed values directly into your markup:

```html
<state name="Ada" />
<p>Hello, {{ state.name }}!</p>
```

Any valid JavaScript expression is supported inside the braces, including property access and simple operations:

```html
<state price="100" />
<p>Total: {{ state.price * 1.1 }}</p>
```

## Attribute Binding

Bind standard HTML attributes to a reactive value by using interpolation `{{ }}` directly inside the attribute string. Avenx-JS also automatically handles boolean attributes (like `disabled`, `checked`):

```html
<state isSubmitting="true" />
<button disabled="{{ state.isSubmitting }}">Submit</button>
```

For CSS classes specifically, you can use the `data-ax-class` directive which supports object syntax:

```html
<state isActive="true" />
<div data-ax-class="{ active: state.isActive, inactive: !state.isActive }"></div>
```

## Event Binding

Bind DOM events using the `@` prefix, followed by the event name and the handler expression:

```html
<button @click="increment()">Add</button>
```

The referenced handler must be defined as an action in your component's script, or be an inline expression.

Avenx-JS also supports event modifiers like `.prevent`, `.stop`, and keyboard modifiers like `.enter`:

```html
<form @submit.prevent="save()">
  <button type="submit">Save</button>
</form>
```

## Structural Directives

Structural directives control whether and how elements are rendered using special tags or attributes.

- `data-ax-show` — conditionally renders an element by toggling its inline `display` property.
- `<@for>` — repeats an element for each item in an array using a custom loop tag.

```html
<ul>
  <@for item in state.items key="item.id">
    <li>{{ item.name }}</li>
  </@for>
</ul>

<p data-ax-show="state.items.length === 0">No items yet.</p>
```
