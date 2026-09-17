<!--
  <state> initialisers written as JavaScript object and array literals, the way
  state-management.md, api-reference/virtuallist.md and components.md write
  them. Each one used to reach the component as a string: the list rendered
  nothing and `.length` counted characters. See
  specs/rendering/state-initialisers.spec.js.
-->
<state
  products="[
    { id: 1, name: 'Keyboard', tags: ['input'] },
    { id: 2, name: 'Monitor', tags: [] },
  ]"
  settings="{ theme: 'dark', notifications: true }"
  greeting="'Hello'"
  label="Plain text"
/>

<main>
  <p data-testid="product-count">{{ products.length }}</p>
  <ul>
    <@for product in products key="product.id">
      <li data-testid="product">{{ product.name }} ({{ product.tags.length }})</li>
    </@for>
  </ul>
  <p data-testid="theme">{{ settings.theme }}</p>
  <p data-testid="notifications">{{ settings.notifications ? 'on' : 'off' }}</p>
  <p data-testid="greeting">{{ greeting }}</p>
  <p data-testid="label">{{ label }}</p>
</main>
