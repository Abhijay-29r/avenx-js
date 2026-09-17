/**
 * @file dynamicAttributeGuard.test.js
 * @description The string-renderer path refuses a dynamic attribute name that
 * resolves to an inline event handler.
 *
 * `:[expr]="value"` resolves the attribute name at run time, so the build
 * cannot see it. If it resolves to `onclick`, setting it would install a
 * handler from a value. `DomPatcher` refuses an `on*` resolved name and leaves
 * every other dynamic name working.
 */
import assert from 'node:assert';
import { Window } from 'happy-dom';

const win = new Window();
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousDOMParser = globalThis.DOMParser;
globalThis.window = win;
globalThis.document = win.document;
globalThis.DOMParser = win.DOMParser;

try {
  const { DomPatcher } = await import('../../lib/core/renderer/domPatch.js');
  const patcher = new DomPatcher();

  /**
   * Resolves the expressions the fixture template uses.
   * @param {string} expr - The expression source.
   * @returns {any} The value.
   */
  const resolve = (expr) => {
    // Lowercase identifiers: the HTML parser lowercases attribute names, so the
    // expression inside :[ ] arrives lowercased. Using lowercase keys keeps the
    // test exercising the guard rather than an accidental lookup miss.
    const scope = {
      handlername: 'onclick',
      handlerbody: 'globalThis.__dynPwn = true',
      safename: 'data-role',
      safevalue: 'admin',
    };
    return scope[expr.trim()];
  };

  console.log('🧪 A dynamic name resolving to onclick is refused');
  const target = win.document.createElement('div');
  patcher.patch(
    target,
    '<button :[handlername]="handlerbody">x</button><span :[safename]="safevalue">y</span>',
    resolve,
    null,
  );
  const button = target.querySelector('button');
  const span = target.querySelector('span');
  assert.ok(button, 'the button is rendered');
  assert.strictEqual(button.getAttribute('onclick'), null, 'onclick must not be set from a dynamic name');
  assert.ok(!('__dynPwn' in globalThis), 'nothing executed');

  console.log('🧪 A dynamic name that is not a handler still resolves');
  assert.strictEqual(span.getAttribute('data-role'), 'admin', 'a non-handler dynamic name is set');

  console.log('  ✅ Dynamic attribute guard tests passed!');
} catch (error) {
  console.error('❌ Dynamic attribute guard tests failed:', error);
  process.exitCode = 1;
} finally {
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
  globalThis.DOMParser = previousDOMParser;
  delete globalThis.__dynPwn;
}
