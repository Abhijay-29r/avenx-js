import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { createCompiler } from '../../plugins/avenx-vite/src/compiler.js';
import { loadStyle } from '../../plugins/avenx-vite/src/css.js';

/**
 * Regression coverage for the Vite plugin diverging from the CLI build.
 *
 * The plugin never emitted scoped CSS: it stripped the <@css> markers and
 * returned the block bodies verbatim, producing selectors like `box { ... }`
 * that match nothing, so component styles silently did not apply. It also
 * shared one StyleProcessor for the lifetime of the dev server, which only the
 * CLI ever resets, so style state accumulated across every HMR transform.
 */

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-vite-css-'));

const componentPath = path.join(tmpDir, 'Card.component.js');
const componentCssPath = path.join(tmpDir, 'Card.component.css');
const pagePath = path.join(tmpDir, 'Home.page.js');
const pageCssPath = path.join(tmpDir, 'Home.page.css');
const otherPath = path.join(tmpDir, 'Panel.component.js');
const otherCssPath = path.join(tmpDir, 'Panel.component.css');

fs.writeFileSync(
  componentPath,
  '<state title="Hi" />\n<div @css box>\n  <h2 @css heading>{{ title }}</h2>\n</div>\n',
);
fs.writeFileSync(
  componentCssPath,
  '<@css>\nbox {\n  padding: 12px;\n}\nheading {\n  color: rebeccapurple;\n}\n</@css>\n',
);
fs.writeFileSync(pagePath, '<state x="1" />\n<section @css shell><p>{{ x }}</p></section>\n');
fs.writeFileSync(pageCssPath, '<@css>\nshell {\n  margin: 0 auto;\n}\n</@css>\n');
fs.writeFileSync(otherPath, '<state y="1" />\n<div @css panel>{{ y }}</div>\n');
fs.writeFileSync(otherCssPath, '<@css>\npanel {\n  color: teal;\n}\n</@css>\n');

/**
 * Compiles a module the way the CLI build does, returning its scoped CSS.
 * @param {string} filePath - Component or page path.
 * @param {'component'|'page'} type - Compilation type.
 * @returns {string} The scoped CSS.
 */
function cliScopedCss(filePath, type) {
  const styleProcessor = new StyleProcessor({}, {});
  new ComponentParser(styleProcessor, [], {}).parse(filePath, type);
  return styleProcessor.getGlobalStyles();
}

/**
 * The plugin's CSS must match what the CLI build produces.
 */
function testViteMatchesCliScopedCss() {
  console.log('🧪 Testing Vite scoped CSS matches the CLI build...');

  const compiler = createCompiler({});

  const componentCss = loadStyle(componentCssPath, compiler);
  assert.strictEqual(
    componentCss,
    cliScopedCss(componentPath, 'component'),
    'component CSS should be identical between the Vite and CLI paths',
  );

  const pageCss = loadStyle(pageCssPath, compiler);
  assert.strictEqual(
    pageCss,
    cliScopedCss(pagePath, 'page'),
    'page CSS should be identical between the Vite and CLI paths',
  );

  console.log('  ✅ Vite and CLI emit identical scoped CSS.');
}

/**
 * The emitted CSS must actually be scoped, not raw block names.
 */
function testEmittedCssIsScoped() {
  console.log('🧪 Testing emitted CSS is scoped rather than raw block names...');

  const compiler = createCompiler({});
  const css = loadStyle(componentCssPath, compiler);

  assert.ok(/\.avenx-[0-9a-f]+\s*\{/.test(css), 'CSS should use hashed scope class selectors');
  assert.ok(css.includes('padding: 12px'), 'declarations should be preserved');
  assert.ok(!/^\s*box\s*\{/m.test(css), 'raw block names must not be emitted as selectors');
  assert.ok(!/^\s*heading\s*\{/m.test(css), 'raw block names must not be emitted as selectors');

  // The scope class in the CSS must be the one injected into the template.
  const { code } = compiler.compileComponent(componentPath);
  const [, hash] = css.match(/\.(avenx-[0-9a-f]+)/) || [];
  assert.ok(hash, 'a scope hash should be present in the CSS');
  assert.ok(code.includes(hash), 'the template must carry the same scope class as the CSS');

  console.log('  ✅ CSS is scoped and matches the template classes.');
}

/**
 * The compiled module must pull its stylesheet into the graph.
 */
function testModuleImportsItsStylesheet() {
  console.log('🧪 Testing compiled modules import their stylesheet...');

  const compiler = createCompiler({});

  const component = compiler.compileComponent(componentPath);
  assert.ok(component.code.includes('Card.component.css'), 'component module should import its stylesheet');
  assert.ok(typeof component.css === 'string' && component.css.length > 0, 'compile result should expose the CSS');

  const page = compiler.compilePage(pagePath);
  assert.ok(page.code.includes('Home.page.css'), 'page module should import its stylesheet');

  // A module with no co-located stylesheet must not gain a broken import.
  const bare = path.join(tmpDir, 'Bare.component.js');
  fs.writeFileSync(bare, '<state z="1" />\n<div>{{ z }}</div>\n');
  const bareResult = compiler.compileComponent(bare);
  assert.ok(!bareResult.code.includes('.component.css'), 'a module without styles should not import one');

  console.log('  ✅ Stylesheets are imported only where they exist.');
}

/**
 * Repeated compilation (the HMR path) must not accumulate style state.
 */
function testRepeatedCompilationIsStable() {
  console.log('🧪 Testing repeated compilation does not accumulate style state...');

  const compiler = createCompiler({});
  const first = loadStyle(componentCssPath, compiler);

  for (let i = 0; i < 10; i++) {
    compiler.compileComponent(componentPath);
    loadStyle(componentCssPath, compiler);
  }

  const afterRebuilds = loadStyle(componentCssPath, compiler);
  assert.strictEqual(afterRebuilds, first, 'CSS must be identical after repeated compilation');

  const occurrences = afterRebuilds.split('padding: 12px').length - 1;
  assert.strictEqual(occurrences, 1, 'rules must not be duplicated across rebuilds');

  console.log('  ✅ Repeated compilation is stable.');
}

/**
 * One module's stylesheet must not contain another module's rules.
 */
function testStylesDoNotLeakBetweenModules() {
  console.log('🧪 Testing styles do not leak between modules...');

  const compiler = createCompiler({});

  compiler.compileComponent(otherPath);
  const cardCss = loadStyle(componentCssPath, compiler);

  assert.ok(!cardCss.includes('color: teal'), "one component's stylesheet must not contain another's rules");
  assert.ok(cardCss.includes('padding: 12px'), 'its own rules should still be present');

  console.log('  ✅ No cross-module style leakage.');
}

/**
 * A stylesheet with no resolvable owner must still load rather than throw.
 */
function testOrphanStylesheetFallback() {
  console.log('🧪 Testing orphan stylesheet falls back gracefully...');

  const orphan = path.join(tmpDir, 'Orphan.component.css');
  fs.writeFileSync(orphan, '<@css>\nlone {\n  color: red;\n}\n</@css>\n');

  const compiler = createCompiler({});
  const css = loadStyle(orphan, compiler);

  assert.ok(typeof css === 'string', 'an orphan stylesheet should still return CSS text');
  assert.ok(!css.includes('<@css>'), 'block markers should be stripped in the fallback');
  assert.strictEqual(loadStyle(path.join(tmpDir, 'Missing.component.css'), compiler), null);

  console.log('  ✅ Orphan stylesheets handled.');
}

try {
  testViteMatchesCliScopedCss();
  testEmittedCssIsScoped();
  testModuleImportsItsStylesheet();
  testRepeatedCompilationIsStable();
  testStylesDoNotLeakBetweenModules();
  testOrphanStylesheetFallback();
  console.log('🎉 All Vite plugin scoped CSS tests passed successfully!');
} catch (err) {
  console.error('❌ Vite plugin scoped CSS test failed:', err);
  process.exit(1);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
