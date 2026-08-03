---
title: 'AvenxPage API'
description: 'API reference for AvenxPage, the specialized component class for views and routing.'
---

A specialized sub-class extending `AvenxComponent`. Pages represent root layouts in router configurations.

## Key Differences from AvenxComponent

- **Child Component Resolution**: Pages are configured with a registry of components. Whenever a page renders, it scans the DOM for custom element tags (e.g. `<div data-avenx-comp="Navbar">`) and instantiates them automatically.
- **Props Propagation**: If a child component is declared with attributes (e.g., `<Card title="My Card" />`), `AvenxPage` extracts and feeds them to the child component as props dynamically.

## Constructor

Compiled page classes receive the application bridge map and component registry.
The compiler emits page constructors with this shape:

```javascript
constructor(bridges, componentRegistry, props) {
  super(
    initialState,
    computed,
    bridges,
    template,
    methods,
    componentRegistry,
    props,
  );
}
```

This differs from a regular component constructor, which receives only
`bridges` and `props`. The extra `componentRegistry` argument is an object mapping component names to their class definitions. This registry allows `AvenxPage` to resolve and mount child components found inside the page's template.

### Manual Component Registration

If you are not using the Avenx compiler and prefer to set up your pages manually, you must provide the `componentRegistry` to the page constructor.

Here is an example of manually registering a `Navbar` component within a `HomePage`:

```javascript
import { AvenxPage, AvenxComponent } from 'avenx';

// 1. Define the child component
class Navbar extends AvenxComponent {
  // ... Navbar implementation
}

// 2. Define the page
class HomePage extends AvenxPage {
  constructor(bridges, componentRegistry, props) {
    // 3. Provide the components used in this page's template
    const myRegistry = {
      ...componentRegistry,
      Navbar: Navbar
    };

    super(
      { /* initialState */ },
      { /* computed */ },
      bridges,
      `<div>
         <div data-avenx-comp="Navbar" title="Home"></div>
       </div>`,
      { /* methods */ },
      myRegistry,
      props
    );
  }
}
```

In the example above, the `HomePage` template references the `Navbar` component via `data-avenx-comp="Navbar"`. By providing `{ Navbar: Navbar }` in the registry, the `AvenxPage` can successfully find, instantiate, and mount the `Navbar` when the page renders.

## Route Parameters

When a route pattern contains dynamic segments, such as `/profile/:id`, the
router decodes the matched values and passes them into the mounted page.

```javascript
app.initRouter({
  '/profile/:id': 'Profile',
});
```

For `#/profile/42?tab=settings`, the page receives:

```javascript
this.params.id; // "42"
this.params.query; // { tab: "settings" }
this.state.id; // "42"
this.state.query; // { tab: "settings" }
```

Route parameters are copied into both `this.params` and `this.state`, so they
can be read inside page actions or rendered directly in templates.

## Page Reuse During Navigation

If navigation resolves to the same page class, Avenx reuses the active page
instance. It updates route parameters in place instead of unmounting and
mounting the page again. Parameters that are no longer present on the new route
are removed from both `this.params` and `this.state`.
If navigation resolves to a different page class, the current page is unmounted
before the new page is mounted.
:::caution
Because the existing instance is reused, `onMount()` and `onUnmount()` do **not** run again during this kind of navigation — only `onUpdate()` fires. If your page needs to react to a changed route parameter (for example, re-fetching data for a new `:id`), do not rely on `onMount()` alone. Compare the new parameter value against the previously seen value inside `onUpdate()` instead:

```javascript
onUpdate() {
  if (this.state.id !== this._lastId) {
    this._lastId = this.state.id;
    this.fetchProfile(this.state.id);
  }
}
```

See [In-Place Parameter Updates](/core-concepts/routing/#4-in-place-parameter-updates) in the Pages & Routing guide for the full pattern.
:::

## Lifecycle

Pages use the same lifecycle hooks as components:
| Hook | When it runs |
| ------------- | ----------------------------------------------------------------------------- |
| `onMount()` | After the page is first mounted into the application target. |
| `onUpdate()` | After page state changes, including route parameter updates on a reused page. |
| `onUnmount()` | Before the page is removed, including cleanup of child components. |
`AvenxPage.update()` first updates the page itself and then mounts or updates
child components found in the rendered template. `AvenxPage.unmount()` unmounts
all child components before delegating to the base component cleanup.
