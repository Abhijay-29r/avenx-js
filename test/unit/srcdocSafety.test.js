/**
 * @file srcdocSafety.test.js
 * @description A bound `srcdoc` is HTML, not a URL.
 *
 * `srcdoc` was in URL_ATTRIBUTES, so a bound value was scheme-checked and
 * otherwise set verbatim. Its content is an HTML document, and `<img onerror>`
 * has no scheme, so it passed the check and ran in a same-origin iframe.
 *
 * A bound `srcdoc` is now treated exactly like `data-ax-html`: a plain value is
 * escaped, and only a `SafeHtml` value introduces markup. A developer who wants
 * to render trusted HTML in an iframe wraps it in `html(...)`.
 */
import assert from 'node:assert';
import { Window } from 'happy-dom';
import { isUrlAttribute } from '../../lib/core/security/urlPolicy.js';
import { html } from '../../lib/core/security/escapeHtml.js';

const win = new Window();
const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
globalThis.window = win;
globalThis.document = win.document;

try {
  const { applyAttribute, applyAttributeParts } = await import('../../lib/core/renderer/program/bindings.js');
  const d = win.document;

  console.log('🧪 srcdoc is not classified as a URL attribute');
  assert.strictEqual(isUrlAttribute('srcdoc'), false);
  assert.strictEqual(isUrlAttribute('href'), true);

  console.log('🧪 A bound srcdoc string is escaped');
  const iframe = d.createElement('iframe');
  applyAttribute(iframe, 'srcdoc', '<img src=x onerror="parent.__pwn=1">');
  const set = iframe.getAttribute('srcdoc');
  assert.ok(!/<img/i.test(set), `markup must be escaped, got ${set}`);
  assert.ok(set.includes('&lt;img'), `got ${set}`);

  console.log('🧪 A SafeHtml srcdoc value passes through as markup');
  const trusted = d.createElement('iframe');
  applyAttribute(trusted, 'srcdoc', html('<b>trusted</b>'));
  assert.strictEqual(trusted.getAttribute('srcdoc'), '<b>trusted</b>');

  console.log('🧪 srcdoc assembled from parts is escaped');
  const parts = d.createElement('iframe');
  applyAttributeParts(parts, 'srcdoc', '<script>evil()</script>');
  assert.ok(!/<script>/i.test(parts.getAttribute('srcdoc')), parts.getAttribute('srcdoc'));

  console.log('🧪 null clears srcdoc rather than writing "null"');
  const cleared = d.createElement('iframe');
  applyAttribute(cleared, 'srcdoc', null);
  assert.strictEqual(cleared.getAttribute('srcdoc'), '');

  console.log('🧪 URL attributes are still scheme-checked (control)');
  const link = d.createElement('a');
  applyAttribute(link, 'href', 'javascript:alert(1)');
  assert.strictEqual(link.getAttribute('href'), 'about:blank');

  console.log('  ✅ srcdoc safety tests passed!');
} catch (error) {
  console.error('❌ srcdoc safety tests failed:', error);
  process.exitCode = 1;
} finally {
  globalThis.window = previousWindow;
  globalThis.document = previousDocument;
}
