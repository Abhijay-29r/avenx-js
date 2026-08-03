---
title: 'Actions & Event Handling'
description: 'Learn about actions, event handling, event delegation, and custom events in Avenx-JS.'
---

Avenx-JS simplifies capturing DOM events by letting you attach action handlers directly within elements using an `@` prefix.

## Binding Events

To bind an event listener, prefix the event name with `@` followed by the expression to execute:

```html
<button @click="increment()">Increment</button>
<input @input="state.inputValue = event.target.value" />
```

:::note
**Context Availability:** Inside event expressions, you have access to the component's `state`, computed values, component `methods`, registered `bridges`, the native DOM `event` object, and scoped slot properties (when available).

Event handlers can also pass the `event` object to methods (for example, `@click="selectItem(item.id, event)"`). Compiled action handlers additionally expose an implicit `args` array containing the arguments supplied when the handler is invoked.
:::

## Implicit Event Handler Scope

Event handlers execute inside the component's runtime scope, so several values are automatically available without needing to import or declare them.

### Using the DOM Event

The native DOM `event` object is always available inside inline event handlers.

```html
<button @click="event.preventDefault()">
  Prevent Default
</button>

<input
  @input="state.username = event.target.value"
  placeholder="Enter your username"
/>
```

### Passing Event to Methods

The `event` object can be passed directly to component methods together with your own arguments.

```html
<button @click="selectItem(item.id, event)">
  Select Item
</button>
```

### Action Arguments

Compiled action handlers expose an implicit `args` array containing the arguments supplied when the handler is invoked. This allows reusable actions to receive values passed from event bindings.

## Event Modifiers

Event bindings support dot-suffixed **modifiers** that adjust how the underlying DOM event is handled before your expression runs. Modifiers are appended directly to the event name, e.g. `@submit.prevent="save"` or `@keydown.enter="submit"`.
| Modifier | Applies to | Behavior |
|---|---|---|
| `.prevent` | Any event | Calls `event.preventDefault()` before invoking the handler. |
| `.stop` | Any event | Calls `event.stopPropagation()` before invoking the handler. |
| `.once` | Any event | Automatically removes the listener after it fires a single time. |
| `.enter` | Keyboard events | Only invokes the handler if the pressed key is `Enter`. |
| `.esc` / `.escape` | Keyboard events | Only invokes the handler if the pressed key is `Escape` (`.esc` is an alias for `.escape`). |
| `.space` | Keyboard events | Only invokes the handler if the pressed key is Space (`' '`). |
| `.tab` | Keyboard events | Only invokes the handler if the pressed key is `Tab`. |
| `.delete` | Keyboard events | Only invokes the handler if the pressed key is `Delete`. |

`.prevent` and `.stop` wrap the handler with the corresponding DOM method call:

```html
<form @submit.prevent="save()">
  <button type="submit">Save</button>
</form>
<div @click.stop="toggleMenu()">
  <!-- Click here won't bubble up to parent listeners -->
</div>
```

`.once` detaches the listener after the first invocation, useful for one-time actions like dismissing a banner:

```html
<button @click.once="dismissBanner()">Got it</button>
```

Key modifiers (`.enter`, `.esc`, `.escape`, `.space`, `.tab`, `.delete`) act as key filters on keyboard events, so the handler only runs when the matching key is pressed:

```html
<input @keydown.enter="submit()" placeholder="Press Enter to submit" />
<input @keydown.esc="clearInput()" placeholder="Press Esc to clear" />
<input @keydown.space="togglePlay()" placeholder="Press Space to toggle" />
<input @keydown.tab.prevent="focusNext()" placeholder="Press Tab to navigate" />
<button @keydown.delete="removeItem()">Delete Item</button>
```

:::note
**Combining modifiers:** Modifiers can be chained together. For example, `@keydown.enter.prevent="submit()"` filters for the Enter key and prevents default form submission, while `@keydown.tab.prevent="focusNext()"` catches the Tab key and suppresses default browser focus shifting in a single binding.
:::

## Scoped Slot Event Handling

Event handlers inside transcluded slot content automatically have access to scoped slot properties exposed through the `data-slot-props` attribute. This allows event handlers to work directly with slot data without requiring additional wiring.

```html
<ListContainer>
  <template data-slot-props="slotProps">
    <button @click="handleItemClick(slotProps.item)">
      Click Me
    </button>
  </template>
</ListContainer>
```

In this example, `slotProps.item` is available directly inside the event handler because the runtime resolves the scoped slot context before executing the handler.

## Event Delegation

Avenx does not attach event listeners to every single DOM node. Instead, the runtime's `EventBinder` uses **event delegation**. It listens for events at the component's root element and determines the correct target on invocation, saving browser memory and keeping dynamic list updates fast.

When rendering into a `DocumentFragment`, Avenx falls back to direct event binding because event delegation is not available in that context.

### Modifier Execution Order

When multiple modifiers are chained together, they execute in the following order:

1. `.once`
2. System key modifiers (`.ctrl`, `.alt`, `.shift`, `.meta`, `.cmd`)
3. Key modifiers (`.enter`, `.esc`, `.escape`, `.space`, `.tab`, `.delete`)
4. `.prevent`
5. `.stop`
6. Execute the event handler

For example:

```html
<input @keydown.enter.prevent="submit()" />
```

The runtime first verifies the key modifier, then applies `.prevent`, and finally executes the event handler.

### Modifier Execution Order

When multiple modifiers are chained together, they execute in the following order:

1. `.once`
2. System key modifiers (`.ctrl`, `.alt`, `.shift`, `.meta`, `.cmd`)
3. Key modifiers (`.enter`, `.esc`, `.escape`, `.space`, `.tab`, `.delete`)
4. `.prevent`
5. `.stop`
6. Execute the event handler

For example:

```html
<input @keydown.enter.prevent="submit()" />
```

The runtime first verifies the key modifier, then applies `.prevent`, and finally executes the event handler.

## Custom Component Events

Components can communicate with their parent containers by dispatching custom events. Avenx provides a built-in helper method, `$emit(eventName, detail)`, on the base `AvenxComponent` class to clean up component interactions.

### Emitting Events

To emit an event from a child component, call `$emit` inside actions or component methods. The second parameter is an optional payload (`detail`) passed to the parent handler:

```html
<!-- src/components/child/child.component.js -->
<state count="0" />
<action name="increment"> state.count++; $emit('change', { count: state.count }); </action>

<button @click="increment()">Click me</button>
```

### Listening to Custom Events

Parent components can bind listeners to these custom events using the standard `@eventName="handler"` syntax on the child component tag. You can access the event payload via `event.detail`:

```html
<!-- src/pages/home/home.page.js -->
<state currentCount="0" />
<action name="handleChildChange"> state.currentCount = event.detail.count; </action>

<div class="home-page">
  <p>Child count is: {{ currentCount }}</p>
  <Child @change="handleChildChange()" />
</div>
```
