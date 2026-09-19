/**
 * @file unusedStyleBlock.test.js
 * @description AVX_W55 -- a style block the template never names.
 *
 * An Avenx style block is a *named block*, not a CSS selector: `card { ... }`
 * in the stylesheet is attached by `<div @css card>` in the template. A block
 * nothing names is dropped -- nothing hashes it, so none of its rules reach the
 * stylesheet -- and that was entirely silent.
 *
 * Silence is the whole defect. This project's own Quick Start tutorial wrote
 * the stylesheet as ordinary CSS (`.counter-card { ... }`, `button { ... }`) and
 * the template with `class` attributes. Following it produced a successful
 * build, an empty bundle.css, an unstyled page and not one word of explanation.
 * `.counter-card` is a block *named* ".counter-card", a name no `@css`
 * directive can even spell, so it could never have worked.
 */

import assert from 'assert';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';

console.log('Testing AVX_W55 (unused style block)...');

/**
 * Processes a template against a set of blocks and returns the codes reported.
 * @param {string} template - The template markup.
 * @param {object} blocks - Declared style blocks by name.
 * @returns {{codes: string[], diagnostics: object[]}} What was reported.
 */
function report(template, blocks) {
  const processor = new StyleProcessor();
  processor.process(template, blocks, 'Counter', '/tmp/counter.component.css');
  const diagnostics = processor.lastDiagnostics || [];
  return { codes: diagnostics.map((d) => d.code), diagnostics };
}

// --- the quickstart's shape: CSS selectors and class attributes ----------
{
  const { codes, diagnostics } = report(
    '<div class="counter-card"><p class="number">x</p><button>Plus</button></div>',
    { '.counter-card': 'padding: 2rem;', '.number': 'font-size: 1rem;', button: 'color: white;' },
  );
  assert.deepStrictEqual(codes, ['AVX_W55'], 'one finding for the component, not one per block');
  const names = diagnostics[0].args[1];
  for (const expected of ['.counter-card', '.number', 'button']) {
    assert.ok(names.includes(expected), `the message should name ${expected}, got: ${names}`);
  }
  assert.ok(
    diagnostics[0].args[2].includes('counter.component.css'),
    'and name the stylesheet the blocks are declared in',
  );
  console.log('  ✅ reports a stylesheet the template never references');
}

// --- a named block is silent ---------------------------------------------
{
  assert.deepStrictEqual(
    report('<div @css card>x</div>', { card: 'padding: 2rem;' }).codes,
    [],
    'correct usage must not be reported',
  );
  console.log('  ✅ silent when the template names the block');
}

// --- only the unused blocks are named ------------------------------------
{
  const { codes, diagnostics } = report('<div @css card>x</div>', {
    card: 'padding: 2rem;',
    stale: 'color: red;',
  });
  assert.deepStrictEqual(codes, ['AVX_W55']);
  assert.ok(diagnostics[0].args[1].includes('stale'), 'the unused block is named');
  assert.ok(!diagnostics[0].args[1].includes('"card"'), 'the used block is not');
  console.log('  ✅ names only the blocks that are unused');
}

// --- the <@css name /> tag form counts as a use --------------------------
{
  assert.deepStrictEqual(
    report('<div>x</div><@css card />', { card: 'padding: 2rem;' }).codes,
    [],
    'the tag form attaches a block too, and must count as a use',
  );
  console.log('  ✅ the <@css name /> tag form counts as a use');
}

// --- nothing declared, nothing reported ----------------------------------
{
  assert.deepStrictEqual(report('<div>x</div>', {}).codes, [], 'a component with no stylesheet is fine');
  assert.deepStrictEqual(report('<div>x</div>', null).codes, [], 'no blocks at all is fine');
  console.log('  ✅ silent when the component has no stylesheet');
}

// --- source-map metadata is not mistaken for a block ---------------------
{
  assert.deepStrictEqual(
    report('<div @css card>x</div>', {
      card: 'padding: 2rem;',
      _sourceMapInfo: { card: { sourceFile: 'x.css', startLine: 1 } },
    }).codes,
    [],
    'the metadata key on the blocks map is not a style block',
  );
  console.log('  ✅ blocks-map metadata is not reported as a block');
}

// --- the finding carries no template offset ------------------------------
{
  const { diagnostics } = report('<div class="card">x</div>', { card: 'padding: 2rem;' });
  assert.strictEqual(
    diagnostics[0].offset,
    -1,
    'the finding is in the stylesheet, so it must not claim a position in the ' +
      'template -- a code frame cut from there would point at the wrong file',
  );
  console.log('  ✅ the finding claims no position in the template');
}

console.log('✅ AVX_W55 tests passed!');
