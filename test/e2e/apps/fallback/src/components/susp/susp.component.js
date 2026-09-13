<state label="'suspense'" />

<div data-testid="susp-root">
  <p data-testid="susp-outside">outside {{ label }}</p>
  <@suspense>
    <@fallback><em data-testid="susp-pending">pending</em></@fallback>
    <span data-testid="susp-body">inside {{ label }}</span>
  </@suspense>
</div>
