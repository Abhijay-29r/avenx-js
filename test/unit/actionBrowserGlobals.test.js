/**
 * @file actionBrowserGlobals.test.js
 * @description `<action>` and `<resource>` bodies are ordinary JavaScript.
 *
 * The documentation says so (template-expressions.md: "an `<action>` body is
 * ordinary JavaScript"), and lifecycle-hooks.md, resources.md, the README and
 * the migration guides use `fetch`, `window`, `setInterval` and
 * `clearInterval` in them. avenx-core 0.4.x ran bodies through `new Function`,
 * so those names resolved to the page's globals. Since 2026-09-10 the action
 * compiler refused them at build time (AVX_C21), and the runtime refused any
 * other global (AVX_R15): the README's own <resource> example did not build.
 *
 * Template expressions and inline event handlers keep their documented rule --
 * best-practices/guide.md shows `@click="localStorage.clear()"` as "Don't".
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileActionToSource } from '../../lib/compiler/codegen/actions.js';
import {
  compileExpressionToSource,
  compileStatementsToSource,
  ExpressionCodegenError,
  RUNTIME_IMPORT_NAMES,
} from '../../lib/compiler/codegen/expression.js';
import { EXPRESSION_OPS } from '../../lib/core/expression/ops.js';
import * as runtime from '../../lib/core/index.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import { AvenxErrorCodes } from '../../lib/core/runtime/AvenxError.js';

/**
 * Turns generated `($s) => …` source into a callable, with the primitives bound.
 * @param {string} generated - Generated source.
 * @returns {Function} The compiled body.
 */
function link(generated) {
  const names = Object.keys(EXPRESSION_OPS);
  return new Function(...names, `return (${generated});`)(...Object.values(EXPRESSION_OPS));
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avenx-action-globals-'));

try {
  console.log('🧪 Action bodies resolve browser globals');

  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(url);
    return { json: async () => [{ username: 'ada' }] };
  };
  globalThis.requestAnimationFrame = (callback) => callback(16);
  globalThis.AppUtils = { formatName: (name) => name.toUpperCase() };
  globalThis.pageFlag = false;

  // The README <resource> body, through both action compilers.
  const readme = "return fetch('/api/users').then(res => res.json());";
  for (const generate of [
    (source) => compileActionToSource(source, { ambient: true }),
    (source) => compileStatementsToSource(source, { ambient: true }),
  ]) {
    let generated;
    try {
      generated = generate(readme);
    } catch (error) {
      if (!(error instanceof ExpressionCodegenError) || /restricted|constructs code/.test(error.message)) throw error;
      continue; // statement syntax this generator does not cover; the other one does
    }
    const users = await link(generated)({});
    assert.deepStrictEqual(users, [{ username: 'ada' }]);
  }
  assert.deepStrictEqual(fetched, ['/api/users']);

  // A lifecycle body using timers, window listeners and a page-provided global.
  const scope = { state: { count: 0, name: 'ada' }, count: 0 };
  const onMount = link(
    compileActionToSource(
      [
        'const handle = setInterval(() => {}, 1000);',
        'clearInterval(handle);',
        'requestAnimationFrame((t) => { state.count = t; });',
        'state.name = AppUtils.formatName(state.name);',
        'window.pageFlag = typeof IntersectionObserverThatDoesNotExist === "undefined";',
        'return typeof fetch;',
      ].join('\n'),
      { ambient: true },
    ),
  );
  assert.strictEqual(onMount(scope), 'function');
  assert.strictEqual(scope.state.count, 16);
  assert.strictEqual(scope.state.name, 'ADA');
  // Under the test runner `window` is happy-dom's window, not Node's globalThis;
  // in a browser the two are the same object.
  const pageWindow = globalThis.window || globalThis;
  assert.strictEqual(pageWindow.pageFlag, true);

  // Assigning to a name the page already defines writes the global; an
  // undeclared name still becomes a scope key, as it always did.
  const assigns = link(compileActionToSource('pageFlag = "set"; brandNew = 1;', { ambient: true }));
  const assignScope = {};
  assigns(assignScope);
  assert.strictEqual(globalThis.pageFlag, 'set');
  assert.strictEqual(assignScope.brandNew, 1);
  assert.ok(!('brandNew' in globalThis));

  // Component scope still wins over a global of the same name.
  const shadowed = link(compileActionToSource('return fetch;', { ambient: true }));
  assert.strictEqual(shadowed({ fetch: 'from state' }), 'from state');

  // An allow-listed global is still resolved through Trace's substitution point.
  assert.strictEqual(link(compileActionToSource('return Math.max(1, 2);', { ambient: true }))({}), 2);

  // The expression-statement generator follows the same rules in action mode.
  const statementScope = {};
  link(compileStatementsToSource('window.pageFlag = 42', { ambient: true }))(statementScope);
  assert.strictEqual(pageWindow.pageFlag, 42);

  console.log('🧪 eval and Function stay refused everywhere');

  for (const body of ['return eval("1");', 'return new Function("return 1")();', 'return eval;']) {
    assert.throws(() => compileActionToSource(body, { ambient: true }), /constructs code from a string/);
  }
  assert.throws(() => compileStatementsToSource('eval("1")', { ambient: true }), /constructs code from a string/);

  console.log('🧪 Template expressions and inline handlers keep the documented rule');

  assert.throws(() => compileExpressionToSource('localStorage.getItem("k")'), /restricted global/);
  assert.throws(() => compileStatementsToSource('localStorage.clear()'), /restricted global/);
  assert.throws(() => compileActionToSource('if (x) { window.close(); }'), /restricted global/);
  assert.throws(
    () => link(compileExpressionToSource('requestAnimationFrame'))({}),
    (error) => error.code === AvenxErrorCodes.SANDBOX_VIOLATION,
  );

  console.log('🧪 The primitives are exported where compiled modules import them');

  for (const name of RUNTIME_IMPORT_NAMES) {
    assert.strictEqual(typeof runtime[name], 'function', `avenx-core/runtime must export ${name}`);
    assert.strictEqual(runtime[name], EXPRESSION_OPS[name], `${name} must be the same function everywhere`);
  }

  console.log('🧪 Components: the documented examples build');

  const cases = {
    'readme-resource': "<resource name=\"users\">\n  return fetch('/api/users').then(res => res.json());\n</resource>\n<div><@for user in users><p>{{ user.username }}</p></@for></div>",
    'lifecycle-timers': '<state count="0" />\n<action name="onMount">\n  this._timerId = setInterval(() => { this.state.count++; }, 1000);\n  this.handleResize = () => console.log(window.innerWidth);\n  window.addEventListener("resize", this.handleResize);\n</action>\n<action name="onUnmount">\n  clearInterval(this._timerId);\n  window.removeEventListener("resize", this.handleResize);\n</action>\n<div>{{ count }}</div>',
    'routing-tutorial': "<state username=\"''\" />\n<action name=\"handleLogin\">\n  if (this.state.username === 'admin') {\n    window.isLoggedIn = true;\n  } else {\n    alert('Invalid credentials!');\n  }\n</action>\n<div><button @click=\"handleLogin()\">Log In</button></div>",
  };
  for (const [label, source] of Object.entries(cases)) {
    const dir = path.join(workDir, label);
    fs.mkdirSync(dir);
    const file = path.join(dir, 'probe.component.js');
    fs.writeFileSync(file, source);
    const parser = new ComponentParser(new StyleProcessor());
    parser.production = true;
    parser.parse(file);
    assert.deepStrictEqual(parser.expressionGaps.flatMap((unit) => unit.refusals), [], `${label}: nothing refused`);
    assert.deepStrictEqual(parser.expressionGaps.flatMap((unit) => unit.gaps), [], `${label}: nothing left uncompiled`);
  }

  // The documented "Don't" still fails the build.
  const dontDir = path.join(workDir, 'dont');
  fs.mkdirSync(dontDir);
  fs.writeFileSync(path.join(dontDir, 'probe.component.js'), '<div><button @click="localStorage.clear()">Clear</button></div>');
  const dontParser = new ComponentParser(new StyleProcessor());
  dontParser.parse(path.join(dontDir, 'probe.component.js'));
  assert.ok(
    dontParser.expressionGaps.flatMap((unit) => unit.refusals).some((r) => /localStorage/.test(r.source)),
    'a browser global in an inline handler is still refused',
  );

  console.log('  ✅ Action browser-global tests passed!');
} catch (error) {
  console.error('❌ Action browser-global tests failed:', error);
  process.exitCode = 1;
} finally {
  for (const name of ['fetch', 'requestAnimationFrame', 'AppUtils', 'pageFlag']) delete globalThis[name];
  if (globalThis.window) delete globalThis.window.pageFlag;
  fs.rmSync(workDir, { recursive: true, force: true });
}
