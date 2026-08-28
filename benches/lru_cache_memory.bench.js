import { performance } from 'perf_hooks';
import { TemplateRenderer } from '../lib/core/renderer/renderTemplate.js';

/**
 * Runs memory and eviction benchmarks on LruCache & TemplateRenderer.
 */
function benchmark() {
  const iterations = 10000;
  const cacheLimit = 500;
  let evictionCount = 0;

  const renderer = new TemplateRenderer({
    capacity: cacheLimit,
  });

  renderer.cache.onEvict = () => {
    evictionCount++;
  };

  const resolve = (expr) => `val_${expr}`;

  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const template = `<div><span>Template #${i}</span> <p>{{ state.var_${i} }}</p></div>`;
    renderer.render(template, resolve);
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;

  const finalCacheSize = renderer.cache.size;
  const expectedEvictions = iterations - cacheLimit;

  console.log(`Running LruCache Memory benchmark with ${iterations} unique templates...`);
  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per operation: ${avgTime.toFixed(4)}ms`);
  console.log(`Ops/sec: ${Math.round(1000 / avgTime)}`);
  console.log(`Final Cache Size: ${finalCacheSize} (Limit: ${cacheLimit})`);
  console.log(`Total Evictions: ${evictionCount} (Expected: ${expectedEvictions})`);

  if (finalCacheSize > cacheLimit) {
    throw new Error(`LRU Cache capacity limit exceeded! Size: ${finalCacheSize}, Limit: ${cacheLimit}`);
  }

  if (evictionCount !== expectedEvictions) {
    throw new Error(`Eviction count mismatch! Expected ${expectedEvictions}, got ${evictionCount}`);
  }
}

benchmark();
