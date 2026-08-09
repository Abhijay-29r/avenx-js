import assert from 'assert';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';

try {
  console.log('🧪 Testing StyleProcessor...');
  const sp = new StyleProcessor();

  sp.addVariable('primary-color', '#ff0000');
  assert.strictEqual(sp.cssVariables['primary-color'], '#ff0000');

  sp.addGlobalCSS('body { background: white; }');
  assert.ok(sp.rawGlobalCSS.has('body { background: white; }'));

  const processed = sp.process('<div @css my-class></div>', { 'my-class': 'color: red;' }, 'MyComp');
  assert.ok(processed.includes('class="avenx-'));

  // Test media queries and keyframes scoping
  const complexCss = `
    color: red;
    & h1 { color: blue; }
    @media (max-width: 600px) {
        & h2 { color: green; }
    }
    @keyframes slide {
        from { transform: translateX(0); }
        to { transform: translateX(100px); }
    }
    @supports (display: grid) {
        & .grid { display: grid; }
    }
    `;

  const sp2 = new StyleProcessor();
  const hash = sp2.getHash(complexCss, 'TestComponent');
  sp2.extractRules(complexCss, hash);

  const generatedCss = sp2.scopedStyles;

  // Verify top-level base rule scoping
  assert.ok(generatedCss.includes(`.${hash} { color: red; }`), 'Should scope top-level base properties');
  // Verify nested rule scoping
  assert.ok(generatedCss.includes(`.${hash} h1 { color: blue; }`), 'Should scope nested selectors');
  // Verify media query is compiled at top level and contains nested scoped rule
  assert.ok(generatedCss.includes(`@media (max-width: 600px) {`), 'Should retain @media query');
  assert.ok(generatedCss.includes(`.${hash} h2 { color: green; }`), 'Should scope nested selectors inside @media');
  // Verify keyframes are unmodified inside
  assert.ok(generatedCss.includes(`@keyframes slide {`), 'Should retain @keyframes');
  assert.ok(generatedCss.includes(`from { transform: translateX(0); }`), 'Should keep from keyframe unchanged');
  assert.ok(generatedCss.includes(`to { transform: translateX(100px); }`), 'Should keep to keyframe unchanged');
  // Verify supports queries
  assert.ok(generatedCss.includes(`@supports (display: grid) {`), 'Should retain @supports query');
  assert.ok(
    generatedCss.includes(`.${hash} .grid { display: grid; }`),
    'Should scope nested selectors inside @supports',
  );

  // Verify selector lists inside comma-separated media queries
  const mediaListCss = `
    @media screen and (min-width: 40rem), print {
        h1, h2 { color: navy; }
        &:is(.compact, .dense), [data-state="open,ready"] { display: block; }
    }
    `;
  const spMediaList = new StyleProcessor();
  const hashMediaList = spMediaList.getHash(mediaListCss, 'MediaListComponent');
  spMediaList.extractRules(mediaListCss, hashMediaList);
  const generatedMediaListCss = spMediaList.scopedStyles;

  assert.ok(
    generatedMediaListCss.includes('@media screen and (min-width: 40rem), print {'),
    'Should retain comma-separated media queries',
  );
  assert.ok(
    generatedMediaListCss.includes(`.${hashMediaList}h1, .${hashMediaList}h2 { color: navy; }`),
    'Should scope every selector inside media queries',
  );
  assert.ok(
    generatedMediaListCss.includes(
      `.${hashMediaList}:is(.compact, .dense), .${hashMediaList}[data-state="open,ready"] { display: block; }`,
    ),
    'Should preserve nested commas while scoping selector lists',
  );

  // Verify comments and braces inside quoted strings
  const commentCurlyCss = `
    /* comment { */
    content: "}";
    & sub {
        /* nested comment } */
        content: '{';
    }
    `;
  const spCurly = new StyleProcessor();
  const hashCurly = spCurly.getHash(commentCurlyCss, 'TestComponent');
  spCurly.extractRules(commentCurlyCss, hashCurly);
  const generatedCurlyCss = spCurly.scopedStyles;

  assert.ok(generatedCurlyCss.includes(`.${hashCurly} { content: "}"; }`), 'Should scope and keep content with brace');
  assert.ok(
    generatedCurlyCss.includes(`.${hashCurly} sub { content: '{'; }`),
    'Should scope nested selectors and keep brace',
  );

  // Verify mergeClassIntoTag edge cases
  const sp3 = new StyleProcessor();
  const tagDataClass = sp3.mergeClassIntoTag('div data-class="foo"', 'my-hash');
  assert.strictEqual(tagDataClass, 'div data-class="foo" class="my-hash"', 'Should not merge into data-class');

  const tagCustomClass = sp3.mergeClassIntoTag('div custom-class="foo"', 'my-hash');
  assert.strictEqual(tagCustomClass, 'div custom-class="foo" class="my-hash"', 'Should not merge into custom-class');

  const tagClassDouble = sp3.mergeClassIntoTag('div class="foo"', 'my-hash');
  assert.strictEqual(
    tagClassDouble,
    'div class="my-hash foo"',
    'Should merge into existing class attribute (double quotes)',
  );

  const tagClassSingle = sp3.mergeClassIntoTag("div class='foo'", 'my-hash');
  assert.strictEqual(
    tagClassSingle,
    "div class='my-hash foo'",
    'Should merge into existing class attribute (single quotes)',
  );

  // Verify specificity / rule ordering preservation
  const orderedCss = `
    color: red;
    &:hover { color: blue; }
    color: green;
    `;
  const spOrdered = new StyleProcessor();
  const hashOrdered = spOrdered.getHash(orderedCss, 'TestComponent');
  spOrdered.extractRules(orderedCss, hashOrdered);
  const generatedOrderedCss = spOrdered.scopedStyles;

  // Check exact order by comparing expected output format
  const expectedOrderedOutput = `.${hashOrdered} { color: red; }\n.${hashOrdered}:hover { color: blue; }\n.${hashOrdered} { color: green; }\n`;
  assert.strictEqual(
    generatedOrderedCss,
    expectedOrderedOutput,
    'Should preserve exact ordering of base rules and nested rules',
  );

  // Verify CSS Custom Property (variables) encapsulation
  const varCssCompA = `
    --primary-color: #ff0000;
    --primary-color-hover: #cc0000;
    & button {
        color: var(--primary-color);
        background: var(--primary-color-hover);
        border: 1px solid var(--global-border, var(--primary-color));
        content: "--primary-color: inside string";
    }
  `;
  const spVarA = new StyleProcessor();
  const hashVarA = spVarA.getHash(varCssCompA, 'CompA');
  const hashIdA = hashVarA.replace(/^avenx-/, '');
  spVarA.extractRules(varCssCompA, hashVarA);
  const genVarCssA = spVarA.scopedStyles;

  assert.ok(
    genVarCssA.includes(`--ax-${hashIdA}-primary-color: #ff0000;`),
    'Should scope --primary-color declaration',
  );
  assert.ok(
    genVarCssA.includes(`--ax-${hashIdA}-primary-color-hover: #cc0000;`),
    'Should scope --primary-color-hover declaration without substring collision',
  );
  assert.ok(
    genVarCssA.includes(`color: var(--ax-${hashIdA}-primary-color);`),
    'Should scope var(--primary-color) usage',
  );
  assert.ok(
    genVarCssA.includes(`background: var(--ax-${hashIdA}-primary-color-hover);`),
    'Should scope var(--primary-color-hover) usage',
  );
  assert.ok(
    genVarCssA.includes(`var(--global-border, var(--ax-${hashIdA}-primary-color))`),
    'Should scope local var fallback while preserving global var',
  );
  assert.ok(
    genVarCssA.includes('content: "--primary-color: inside string";'),
    'Should not modify custom properties inside string literals',
  );

  // Test isolation between CompA and CompB with identical variable names
  const varCssCompB = `
    --primary-color: #0000ff;
    & button { color: var(--primary-color); }
  `;
  const spVarB = new StyleProcessor();
  const hashVarB = spVarB.getHash(varCssCompB, 'CompB');
  const hashIdB = hashVarB.replace(/^avenx-/, '');
  spVarB.extractRules(varCssCompB, hashVarB);
  const genVarCssB = spVarB.scopedStyles;

  assert.ok(
    genVarCssB.includes(`--ax-${hashIdB}-primary-color: #0000ff;`),
    'CompB should scope its own --primary-color',
  );
  assert.ok(
    !genVarCssB.includes(`--ax-${hashIdA}-primary-color`),
    'CompB should not contain CompA scoped variable hash',
  );

  // Test Deep Scoped CSS Selectors (:deep() / ::v-deep)
  const deepCss = `
    .parent-container :deep(.child-button) { background-color: red; }
    :deep(.standalone-child) { color: blue; }
    & :deep(.nested-child) { color: green; }
    .card ::v-deep .legacy-child { display: flex; }
    .card ::v-deep(.legacy-paren-child) { margin: 10px; }
    .list :deep(.item:nth-child(2)) { font-weight: bold; }
    .nav :deep(> .link + .active) { opacity: 1; }
    .foo :deep(.bar), .other ::v-deep .baz { border: 1px solid black; }
  `;
  const spDeep = new StyleProcessor();
  const hashDeep = spDeep.getHash(deepCss, 'DeepComp');
  spDeep.extractRules(deepCss, hashDeep);
  const genDeepCss = spDeep.scopedStyles;

  assert.ok(
    genDeepCss.includes(`.${hashDeep}.parent-container .child-button { background-color: red; }`),
    'Should support :deep(.child-button) selector',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep} .standalone-child { color: blue; }`),
    'Should support top-level :deep() selector',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep} .nested-child { color: green; }`),
    'Should support & :deep() selector',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep}.card .legacy-child { display: flex; }`),
    'Should support legacy ::v-deep space selector syntax',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep}.card .legacy-paren-child { margin: 10px; }`),
    'Should support legacy ::v-deep() parenthesis selector syntax',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep}.list .item:nth-child(2) { font-weight: bold; }`),
    'Should support nested parens inside :deep()',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep}.nav > .link + .active { opacity: 1; }`),
    'Should support combinators inside :deep()',
  );
  assert.ok(
    genDeepCss.includes(`.${hashDeep}.foo .bar, .${hashDeep}.other .baz { border: 1px solid black; }`),
    'Should support deep selectors in comma-separated selector lists',
  );

  console.log('  ✅ StyleProcessor tests passed!');
} catch (error) {
  console.error('❌ StyleProcessor tests failed!');
  console.error(error);
  process.exit(1);
}
