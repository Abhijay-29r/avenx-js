import assert from 'assert';
import { StateFactory } from '../../lib/core/reactive/createState.js';
import { IS_REACTIVE_PROXY, PROXY_REF_SYMBOL } from '../../lib/core/reactive/proxyHandler.js';
import { AvenxWatcher } from '../../lib/core/reactive/watcher.js';

function testLazyProxyInitializationSpeed() {
  console.log('🧪 Testing lazy proxy initialization performance for large deep state...');

  // Create a deep, complex object array with 20,000 items
  const largeData = {
    metadata: { version: '1.0.0', author: 'Avenx' },
    items: Array.from({ length: 20000 }, (_, i) => ({
      id: i,
      details: {
        title: `Item ${i}`,
        tags: ['a', 'b', 'c'],
        nested: { count: i * 2 },
      },
    })),
  };

  const startTime = performance.now();
  const state = new StateFactory().create(largeData);
  const endTime = performance.now();

  const initTimeMs = endTime - startTime;
  console.log(`  ⏱️ StateFactory.create() for 20,000 items took: ${initTimeMs.toFixed(3)} ms`);

  // Acceptance Criteria: Negligible initialization cost (< 10ms for 20,000 deep items)
  assert.ok(initTimeMs < 10, `Initialization time should be negligible (<10ms), took ${initTimeMs}ms`);

  // Unaccessed elements must not have PROXY_REF_SYMBOL or IS_REACTIVE_PROXY set yet
  const item10000Raw = largeData.items[10000];
  assert.strictEqual(item10000Raw[IS_REACTIVE_PROXY], undefined);
  assert.strictEqual(item10000Raw[PROXY_REF_SYMBOL], undefined);

  // Read element 10000 lazily
  const item10000Proxy = state.items[10000];

  // Once read, it is now proxied
  assert.strictEqual(item10000Proxy[IS_REACTIVE_PROXY], true);
  assert.strictEqual(item10000Raw[PROXY_REF_SYMBOL], item10000Proxy);

  // Unread child details.nested should still be raw until accessed
  const detailsRaw = item10000Raw.details;
  assert.strictEqual(detailsRaw.nested[IS_REACTIVE_PROXY], undefined);

  // Access nested child
  const nestedProxy = state.items[10000].details.nested;
  assert.strictEqual(nestedProxy[IS_REACTIVE_PROXY], true);
  assert.strictEqual(nestedProxy.count, 20000);

  console.log('  ✅ Lazy proxy initialization speed and on-demand wrapping tests passed!');
}

function testLazyProxyReferentialIdentityAndReactivity() {
  console.log('🧪 Testing referential identity and reactivity after lazy proxy access...');

  let changeCount = 0;
  const state = new StateFactory().create(
    {
      config: {
        theme: 'dark',
        settings: {
          notifications: true,
        },
      },
      list: [{ id: 1, val: 10 }, { id: 2, val: 20 }],
    },
    {
      onChange: () => {
        changeCount++;
      },
    }
  );

  // Accessing same property multiple times returns exact same proxy instance
  const configProxy1 = state.config;
  const configProxy2 = state.config;
  assert.strictEqual(configProxy1, configProxy2);

  const itemProxy1 = state.list[0];
  const itemProxy2 = state.list[0];
  assert.strictEqual(itemProxy1, itemProxy2);

  // Verify watcher tracks lazy access properly
  let watchedVal = null;
  const watcher = new AvenxWatcher(
    () => state.config.settings.notifications,
    () => {
      watchedVal = state.config.settings.notifications;
    }
  );

  assert.strictEqual(watcher.value, true);

  // Mutate deep setting
  state.config.settings.notifications = false;
  assert.strictEqual(changeCount, 1);
  assert.strictEqual(watchedVal, false);

  // Mutate list item
  state.list[0].val = 99;
  assert.strictEqual(changeCount, 2);
  assert.strictEqual(state.list[0].val, 99);

  watcher.teardown();

  console.log('  ✅ Referential identity and reactivity after lazy access tests passed!');
}

function runLazyReactivityTests() {
  console.log('🚀 Running Lazy Proxy Reactivity Unit Tests...\n');
  testLazyProxyInitializationSpeed();
  testLazyProxyReferentialIdentityAndReactivity();
  console.log('\n✅ All Lazy Proxy Reactivity Unit Tests Passed Successfully!\n');
}

runLazyReactivityTests();
