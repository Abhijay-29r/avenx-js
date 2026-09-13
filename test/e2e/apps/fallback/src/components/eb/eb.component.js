<state label="'boundary'" />

<div data-testid="eb-root">
  <p data-testid="eb-outside">outside {{ label }}</p>
  <@errorBoundary>
    <@fallback as="err"><b data-testid="eb-caught">caught {{ err.message }}</b></@fallback>
    <span data-testid="eb-body">inside {{ label }}</span>
  </@errorBoundary>
</div>
