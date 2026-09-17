<state emphasised="true" count="0" draft="" label="idle" />

<main @css page>
  <h1 data-testid="heading">Styling</h1>

  <AlphaBox />
  <BetaBox />

  <p @css note data-testid="page-note">Styled by the page's own stylesheet</p>

  <!-- data-ax-style is documented public API but applies nothing today;
       see the documented gap in specs/styling/scoped-css.spec.js. -->
  <p data-testid="emphasis" data-ax-style="{{ { fontWeight: emphasised ? '700' : '400' } }}">Emphasis target</p>

  <!-- Operators and quotes inside attribute values, on tags that also carry
       @css or data-ax-bind. Each of these was a silent miscompile when the
       template front-end used regular expressions; see
       specs/styling/attribute-content.spec.js. -->
  <section>
    <button data-testid="css-after" @click="count > 1 ? count = 10 : count++" @css guarded>after</button>
    <button data-testid="css-before" @css guarded @click="count > 1 ? count = 10 : count++">before</button>
    <output data-testid="count">{{ count }}</output>

    <input data-testid="bound" title="a > b" data-ax-bind="draft" />
    <output data-testid="draft">{{ draft }}</output>

    <button data-testid="quoted" @click='label = "clicked"'>quoted</button>
    <output data-testid="label" title="<!-- not a comment -->">{{ label }}</output>
  </section>
</main>
