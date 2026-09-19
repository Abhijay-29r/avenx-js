<div @css card data-testid="card">
  <h2 @css label data-testid="card-label">{{ props.label }}</h2>
  <p data-testid="card-value">{{ props.value }}</p>

  <!-- A component inside a component. Nothing in the suite nested one until
       now, which is how a defect that left every grandchild unmounted survived
       a full green E2E run. -->
  <CardBadge value="{{ props.value }}" />

  <div data-testid="card-body">
    <slot>No body provided</slot>
  </div>

  <footer data-testid="card-footer">
    <slot name="footer">No footer provided</slot>
  </footer>
</div>
