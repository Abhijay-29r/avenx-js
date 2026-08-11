import assert from 'assert';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';
import { SafeHtml } from '../../lib/core/security/escapeHtml.js';

function runTests() {
  console.log('🧪 Testing TemplateRenderer with LruCache bounded capacity...');

  // 1. Constructor capacity initialization
  const defaultRenderer = new TemplateRenderer();
  assert.strictEqual(defaultRenderer.capacity, 500, 'Default capacity should be 500');
  assert.strictEqual(defaultRenderer.cache.limit, 500, 'Cache limit should be 500');

  const customCapacityRenderer = new TemplateRenderer(5);
  assert.strictEqual(customCapacityRenderer.capacity, 5, 'Custom capacity number should be 5');
  assert.strictEqual(customCapacityRenderer.cache.limit, 5);

  const configObjectRenderer = new TemplateRenderer({ templateCacheCapacity: 10 });
  assert.strictEqual(configObjectRenderer.capacity, 10, 'Config object capacity should be 10');
  assert.strictEqual(configObjectRenderer.cache.limit, 10);

  // 2. Rendering correctness and caching
  const renderer = new TemplateRenderer(3);
  const scope = { name: 'Alice', html: '<b>Bold</b>' };
  const resolver = (expr) => scope[expr.trim()];

  const t1 = 'Hello {{ name }}!';
  const out1 = renderer.render(t1, resolver);
  assert.strictEqual(out1, 'Hello Alice!');
  assert.strictEqual(renderer.cache.size, 1, 'Cache size should be 1 after rendering t1');
  assert.ok(renderer.cache.has(t1), 'Cache should contain t1');

  // Raw HTML interpolation
  const t2 = 'Body: {{{ html }}}';
  const out2 = renderer.render(t2, resolver);
  assert.strictEqual(out2, 'Body: <b>Bold</b>');
  assert.strictEqual(renderer.cache.size, 2);

  // SafeHtml interpolation
  const t3 = 'Safe: {{ html }}';
  const safeScope = { html: new SafeHtml('<i>Italic</i>') };
  const out3 = renderer.render(t3, (expr) => safeScope[expr.trim()]);
  assert.strictEqual(out3, 'Safe: <i>Italic</i>');
  assert.strictEqual(renderer.cache.size, 3, 'Cache size should reach limit 3');

  // 3. LRU Eviction behavior
  const t4 = 'Extra {{ name }}';
  const out4 = renderer.render(t4, resolver);
  assert.strictEqual(out4, 'Extra Alice');
  assert.strictEqual(renderer.cache.size, 3, 'Cache size should remain at limit 3');
  assert.strictEqual(renderer.cache.has(t1), false, 'Oldest template t1 should be evicted');
  assert.ok(renderer.cache.has(t2), 't2 should remain in cache');
  assert.ok(renderer.cache.has(t3), 't3 should remain in cache');
  assert.ok(renderer.cache.has(t4), 't4 should be in cache');

  // 4. Seamless re-rendering after eviction
  const reRenderedOut1 = renderer.render(t1, resolver);
  assert.strictEqual(reRenderedOut1, 'Hello Alice!', 'Evicted template t1 should re-render correctly');
  assert.ok(renderer.cache.has(t1), 't1 should be re-cached after re-rendering');

  // 5. clearCache functionality
  renderer.clearCache();
  assert.strictEqual(renderer.cache.size, 0, 'clearCache() should empty the cache');

  console.log('  ✅ TemplateRenderer LruCache unit tests passed successfully!');
}

try {
  runTests();
} catch (error) {
  console.error('❌ TemplateRenderer LruCache unit tests failed!');
  console.error(error);
  process.exit(1);
}
