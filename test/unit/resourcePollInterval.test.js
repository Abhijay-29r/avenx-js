import assert from 'assert';
import { Resource } from '../../lib/core/reactive/Resource.js';

console.log('🧪 Testing Resource pollInterval and teardown...');

async function runTest() {
  try {
    let callCount = 0;
    const mockHandler = () => {
      callCount++;
      return Promise.resolve(`data-${callCount}`);
    };

    const res = new Resource('testStats', mockHandler, null, { pollInterval: 50 });

    assert.strictEqual(res.name, 'testStats');
    assert.strictEqual(res.pollInterval, 50);
    assert.ok(res.pollTimer !== null, 'pollTimer should be active when pollInterval > 0');
    assert.strictEqual(callCount, 1, 'Initial fetch should be called immediately');

    // Wait for 130ms (should trigger polling ~2 more times)
    await new Promise((resolve) => setTimeout(resolve, 130));

    assert.ok(callCount >= 3, `Expected at least 3 calls, got ${callCount}`);
    assert.strictEqual(res.value, `data-${callCount}`);

    // Teardown resource
    const countBeforeTeardown = callCount;
    res.teardown();

    assert.strictEqual(res.pollTimer, null, 'pollTimer should be cleared after teardown');

    // Wait another 100ms to verify no further fetches occur
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(callCount, countBeforeTeardown, 'No additional calls should occur after teardown');

    console.log('  ✅ Resource pollInterval unit tests passed!');
  } catch (error) {
    console.error('❌ Resource pollInterval unit test failed:', error);
    process.exit(1);
  }
}

runTest();
