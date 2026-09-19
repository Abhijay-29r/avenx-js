<state revenue="100" title="Revenue" rows="[]" />

<action name="raiseRevenue"> state.revenue = state.revenue + 50; </action>

<action name="renameTitle"> state.title = 'Net revenue'; </action>

<!-- The list arrives after mount, as it does when a page fetches. Each row
     renders a component that renders another component, which is the shape
     that left every grandchild unmounted: the host for the inner component
     does not exist while the page's mount pass is collecting mount points. -->
<action name="onMount"> state.rows = [{ n: 10 }, { n: 80 }]; </action>

<main>
  <h1 data-testid="heading">Composition</h1>

  <button data-testid="raise" @click="raiseRevenue()">Raise revenue</button>
  <button data-testid="rename" @click="renameTitle()">Rename</button>

  <!-- Props from parent state, plus content projected into both slots. -->
  <section data-testid="filled">
    <StatCard label="{{ title }}" value="{{ revenue }}">
      <span data-testid="projected-body">Quarterly total</span>
      <span slot="footer" data-testid="projected-footer">Updated just now</span>
    </StatCard>
  </section>

  <!-- Nothing projected, so both slots fall back to their own content. -->
  <section data-testid="bare">
    <StatCard label="Headcount" value="12" />
  </section>

  <!-- Components rendered from a list that was assigned after mount. -->
  <section data-testid="late">
    <@for row in rows>
      <StatCard label="Late" value="{{ row.n }}" />
    </@for>
  </section>
</main>
