<!--
  A keyed list whose rows carry event handlers, filtered down and back.

  This is the ordinary shape of a list in an application -- every row has a
  button on it -- and it is the shape the rest of the list fixtures leave out.
  `<@for item in items>` with an inert row body exercises reconciliation
  without ever exercising it alongside a row binding that has no watcher, and
  an event op is exactly that.

  `ForBinding` refreshes a reused row whose locals changed, and it does so
  between moving the survivors and disposing the rows that left. When that
  refresh threw, the survivors were reordered and every removed row stayed on
  screen, with nothing reported. The count and the rendered rows disagreeing
  is the assertion that matters here.
-->
<state
  items="[{'id':1,'label':'one','keep':true},{'id':2,'label':'two','keep':false},{'id':3,'label':'three','keep':true}]"
  mode="all"
  lastClicked="none"
/>

<computed name="visible" value="mode === 'all' ? items : items.filter(function (i) { return i.keep; })" />

<action name="showKept"> mode = 'kept'; </action>
<action name="showAll"> mode = 'all'; </action>
<action name="dropAll"> items = []; </action>

<main>
  <h1 data-testid="heading">Filtered list</h1>

  <p data-testid="visible-count">{{ visible.length }}</p>
  <p data-testid="last-clicked">{{ lastClicked }}</p>

  <ul data-testid="list">
    <@for item in visible key="item.id">
      <li data-testid="row" data-row-id="{{ item.id }}">
        <span data-testid="row-label">{{ item.label }}</span>
        <!-- The handler is the whole point: it compiles to a binding with no
             watcher, sitting in the same block as the row's other bindings. -->
        <button data-testid="row-button" @click="lastClicked = item.label">pick</button>
      </li>
    <@empty>
      <li data-testid="row-empty">nothing</li>
    </@for>
  </ul>

  <button data-testid="show-kept" @click="showKept()">kept only</button>
  <button data-testid="show-all" @click="showAll()">all</button>
  <button data-testid="drop-all" @click="dropAll()">drop all</button>
</main>
