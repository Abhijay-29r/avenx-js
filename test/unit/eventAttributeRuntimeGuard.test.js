/**
 * @file eventAttributeRuntimeGuard.test.js
 * @description Defence in depth: the runtime never sets an inline event
 * handler from a bound or dynamically-named attribute.
 *
 * A bound `on*` attribute is already a build error (AVX_C28). The runtime guard
 * covers the paths the build cannot see statically: the string-renderer
 * fallback and a dynamic attribute name (`:[expr]`) that resolves to `onclick`.
 */
import assert from 'node:assert';
import { Window } from 'happy-dom';
import { isEventHandlerAttribute } from '../../lib/core/security/eventAttributes.js';

const win = new Window();
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
globalThis.window = win;
globalThis.document = win.document;

try {
  const { applyAttribute } = await import('../../lib/core/renderer/program/bindings.js');
  const d = win.document;

  console.log('🧪 The handler set matches browser reality, not every "on" name');
  for (const name of ['onclick', 'onerror', 'onload', 'ONCLICK', 'onmouseover']) {
    assert.ok(isEventHandlerAttribute(name), `${name} is a handler`);
  }
  for (const name of ['once', 'online', 'ontology', 'on', 'data-on', 'class']) {
    assert.ok(!isEventHandlerAttribute(name), `${name} is not a handler`);
  }

  console.log('🧪 applyAttribute refuses to set an event handler');
  const btn = d.createElement('button');
  applyAttribute(btn, 'onclick', 'globalThis.__pwn = 1');
  assert.strictEqual(btn.getAttribute('onclick'), null, 'onclick must not be set');
  assert.ok(!('__pwn' in globalThis));

  console.log('🧪 A non-handler attribute is unaffected');
  applyAttribute(btn, 'title', 'ok');
  assert.strictEqual(btn.getAttribute('title'), 'ok');

  console.log('  ✅ Event attribute runtime guard tests passed!');
} catch (error) {
  console.error('❌ Event attribute runtime guard tests failed:', error);
  process.exitCode = 1;
} finally {
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
}
