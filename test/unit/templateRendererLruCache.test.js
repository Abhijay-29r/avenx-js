import assert from 'assert';
import { TemplateRenderer } from '../../lib/core/renderer/renderTemplate.js';

function testTemplateRendererLruCacheEviction() {
  console.log('🧪 Testing TemplateRenderer LRU Cache Eviction under 10,000 unique templates workload...');

  const capacity = 200;
  let evictions = 0;
  const evictedKeys = [];

  const renderer = new TemplateRenderer(capacity);
  renderer.cache.onEvict = (key) => {
    evictions++;
    evictedKeys.push(key);
  };

  const iterations = 10000;
  const resolve = (expr) => `val_${expr}`;

  for (let i = 0; i < iterations; i++) {
    const template = `<div id="tpl-${i}">Hello {{ name_${i} }}</div>`;
    const result = renderer.render(template, resolve);
    assert.strictEqual(result, `<div id="tpl-${i}">Hello val_name_${i}</div>`);

    assert.ok(renderer.cache.size <= capacity, `Cache size ${renderer.cache.size} exceeded capacity ${capacity}`);
  }

  assert.strictEqual(renderer.cache.size, capacity, `Final cache size should equal capacity limit ${capacity}`);
  assert.strictEqual(evictions, iterations - capacity, `Eviction count should equal ${iterations - capacity}`);

  const firstEvictedTemplate = `<div id="tpl-0">Hello {{ name_0 }}</div>`;
  assert.strictEqual(renderer.cache.has(firstEvictedTemplate), false, 'First template should have been evicted');
  assert.strictEqual(renderer.cache.get(firstEvictedTemplate), undefined);

  const latestTemplate = `<div id="tpl-${iterations - 1}">Hello {{ name_${iterations - 1} }}</div>`;
  assert.strictEqual(renderer.cache.has(latestTemplate), true, 'Latest template should be in cache');

  console.log('  ✅ TemplateRenderer LRU Cache Eviction tests passed!');
}

try {
  testTemplateRendererLruCacheEviction();
  console.log('✅ All TemplateRenderer LRU Cache tests successfully completed!');
  process.exit(0);
} catch (error) {
  console.error('❌ TemplateRenderer LRU Cache tests failed!');
  console.error(error);
  process.exit(1);
}
