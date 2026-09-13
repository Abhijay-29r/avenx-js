<state label="'deadlock'" />

<div data-testid="dl-root">
  <p data-testid="dl-outside">outside {{ label }}</p>
  <@deadlock name="e2e-boundary">
    <span data-testid="dl-body">inside {{ label }}</span>
    <@fallback as="err"><i data-testid="dl-tripped">tripped {{ err.message }}</i></@fallback>
  </@deadlock>
</div>
