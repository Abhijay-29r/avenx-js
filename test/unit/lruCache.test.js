import assert from 'assert';
import { LruCache } from '../../lib/core/utils/LruCache.js';

function testLruCacheBasic() {
  console.log('🧪 Testing LruCache basics...');

  const cache = new LruCache(3);

  // Set items
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);

  assert.strictEqual(cache.size, 3);
  assert.strictEqual(cache.get('a'), 1);
  assert.strictEqual(cache.get('b'), 2);
  assert.strictEqual(cache.get('c'), 3);

  // Add a 4th item, triggering eviction of 'a' since 'a' was accessed first, but wait!
  // In the lines above, we accessed 'a', 'b', then 'c'. So the order of access/recency is:
  // a (least recent), b, c (most recent). Wait, we did:
  // cache.get('a') -> makes 'a' most recent!
  // cache.get('b') -> makes 'b' most recent!
  // cache.get('c') -> makes 'c' most recent!
  // Let's verify.
  // After cache.get('a'), order: b, c, a.
  // After cache.get('b'), order: c, a, b.
  // After cache.get('c'), order: a, b, c.
  // So 'a' is the least recent.
  cache.set('d', 4); // should evict 'a'

  assert.strictEqual(cache.has('a'), false, 'Key a should be evicted');
  assert.strictEqual(cache.get('b'), 2);
  assert.strictEqual(cache.get('c'), 3);
  assert.strictEqual(cache.get('d'), 4);
  assert.strictEqual(cache.size, 3);

  console.log('  ✅ Basic LruCache tests passed!');
}

function testLruCacheEvictionCallback() {
  console.log('🧪 Testing LruCache eviction callback...');

  const evicted = [];
  const cache = new LruCache(2, (key, val) => {
    evicted.push({ key, val });
  });

  cache.set('a', 10);
  cache.set('b', 20);
  cache.set('c', 30); // evicts 'a'

  assert.strictEqual(evicted.length, 1);
  assert.strictEqual(evicted[0].key, 'a');
  assert.strictEqual(evicted[0].val, 10);

  cache.get('b'); // makes 'b' most recent, 'c' is least recent
  cache.set('d', 40); // evicts 'c'

  assert.strictEqual(evicted.length, 2);
  assert.strictEqual(evicted[1].key, 'c');
  assert.strictEqual(evicted[1].val, 30);

  console.log('  ✅ LruCache eviction callback tests passed!');
}

function testLruCacheEdgeCases() {
  console.log('🧪 Testing LruCache edge cases...');

  // Invalid constructor
  assert.throws(() => new LruCache(-1), /LRU Cache limit must be a positive number/);
  assert.throws(() => new LruCache(0), /LRU Cache limit must be a positive number/);
  assert.throws(() => new LruCache('three'), /LRU Cache limit must be a positive number/);

  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);

  // Deleting
  assert.strictEqual(cache.delete('a'), true);
  assert.strictEqual(cache.has('a'), false);
  assert.strictEqual(cache.size, 1);

  // Clearing
  cache.clear();
  assert.strictEqual(cache.size, 0);
  assert.strictEqual(cache.get('b'), undefined);

  console.log('  ✅ LruCache edge cases tests passed!');
}

try {
  testLruCacheBasic();
  testLruCacheEvictionCallback();
  testLruCacheEdgeCases();
  console.log('✅ All LruCache tests passed!');
} catch (error) {
  console.error('❌ LruCache tests failed!');
  console.error(error);
  process.exit(1);
}
