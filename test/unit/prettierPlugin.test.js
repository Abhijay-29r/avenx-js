/**
 * @file prettierPlugin.test.js
 * @description The Avenx Prettier plugin formats a plain nested template.
 *
 * `printers.html` used to shadow Prettier's HTML printer `preprocess` with a
 * wrapper that never called the original. The printer then read normalisation
 * flags that were never set, and any node with a child crashed with
 * `TypeError: Cannot read properties of undefined (reading 'startsWith')`
 * (issue #1346). The plugin had no test file, so nothing caught it.
 */
import assert from 'node:assert';
import * as prettier from 'prettier';
import plugin from '../../lib/core/tooling/prettierPlugin.js';

/**
 * Formats an Avenx template with the repository's plugin.
 * @param {string} source - The Avenx template source.
 * @returns {Promise<string>} Formatted source.
 */
function format(source) {
  return prettier.format(source, {
    parser: 'avenx-template',
    plugins: [plugin],
  });
}

try {
  console.log('🧪 The Avenx Prettier plugin formats plain nesting');

  // The reported crash: a template as plain as this one failed to format.
  const plain = await format('<div>x</div>\n');
  assert.strictEqual(plain, '<div>x</div>\n');

  console.log('  ✅ A plain element formats without crashing');

  // Plain nesting -- a parent with children is the case that threw.
  const nested = await format('<div><p>hi</p><span>there</span></div>\n');
  assert.strictEqual(nested, '<div>\n  <p>hi</p>\n  <span>there</span>\n</div>\n');

  console.log('  ✅ Nested elements format correctly');

  // Round-trip: formatting an already-formatted file is a no-op.
  const again = await format(nested);
  assert.strictEqual(again, nested);

  console.log('  ✅ Reformatting formatted output is a no-op');

  // No encoding placeholders may leak into the printed source.
  assert.ok(!/avenx-|data-avenx-/.test(plain), 'no placeholder names in plain output');
  assert.ok(!/avenx-|data-avenx-/.test(nested), 'no placeholder names in nested output');

  console.log('  ✅ No avenx- placeholders survive');

  console.log('All Avenx Prettier plugin tests passed!');
} catch (error) {
  console.error('❌ Avenx Prettier plugin tests failed:', error);
  process.exitCode = 1;
}
