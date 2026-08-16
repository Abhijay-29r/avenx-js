import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

class WatchTestComponent extends AvenxComponent {
  constructor() {
    super({
      count: 0,
      user: {
        name: 'Alice',
        details: {
          age: 30,
        },
      },
      tags: ['html', 'js'],
    });
  }
}

/**
 * Test 1: Watch a state key string.
 */
function testWatchKeyString() {
  console.log('🧪 Testing $watch with a key string...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  comp.$watch('count', (newVal, oldVal) => {
    watchCount++;
    lastNew = newVal;
    lastOld = oldVal;
  });

  assert.strictEqual(watchCount, 0);

  comp.state.count = 5;
  assert.strictEqual(watchCount, 1);
  assert.strictEqual(lastNew, 5);
  assert.strictEqual(lastOld, 0);

  console.log('  ✅ Key string watcher triggered successfully.');
}

/**
 * Test 2: Watch a state dot-separated path string.
 */
function testWatchPathString() {
  console.log('🧪 Testing $watch with a nested path string...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  comp.$watch('user.name', (newVal, oldVal) => {
    watchCount++;
    lastNew = newVal;
    lastOld = oldVal;
  });

  assert.strictEqual(watchCount, 0);

  comp.state.user.name = 'Bob';
  assert.strictEqual(watchCount, 1);
  assert.strictEqual(lastNew, 'Bob');
  assert.strictEqual(lastOld, 'Alice');

  console.log('  ✅ Nested path string watcher triggered successfully.');
}

/**
 * Test 3: Watch a function getter.
 */
function testWatchGetter() {
  console.log('🧪 Testing $watch with a function getter...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  comp.$watch(
    () => comp.state.count + comp.state.user.details.age,
    (newVal, oldVal) => {
      watchCount++;
      lastNew = newVal;
      lastOld = oldVal;
    },
  );

  assert.strictEqual(watchCount, 0);

  // Change first dependency
  comp.state.count = 2;
  assert.strictEqual(watchCount, 1);
  assert.strictEqual(lastNew, 32);
  assert.strictEqual(lastOld, 30);

  // Change second dependency
  comp.state.user.details.age = 31;
  assert.strictEqual(watchCount, 2);
  assert.strictEqual(lastNew, 33);
  assert.strictEqual(lastOld, 32);

  console.log('  ✅ Function getter watcher evaluated dependencies and triggered successfully.');
}

/**
 * Test 4: Option { immediate: true }.
 */
function testWatchImmediate() {
  console.log('🧪 Testing $watch with { immediate: true } option...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  comp.$watch(
    'count',
    (newVal, oldVal) => {
      watchCount++;
      lastNew = newVal;
      lastOld = oldVal;
    },
    { immediate: true },
  );

  // Should trigger immediately on register
  assert.strictEqual(watchCount, 1);
  assert.strictEqual(lastNew, 0);
  assert.strictEqual(lastOld, undefined);

  // Mutate should trigger normally
  comp.state.count = 10;
  assert.strictEqual(watchCount, 2);
  assert.strictEqual(lastNew, 10);
  assert.strictEqual(lastOld, 0);

  console.log('  ✅ Immediate watcher executed immediately on creation.');
}

/**
 * Test 5: Option { deep: true }.
 */
function testWatchDeep() {
  console.log('🧪 Testing $watch with { deep: true } option...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  // Deep watch the user object
  comp.$watch(
    'user',
    (newVal, oldVal) => {
      watchCount++;
      lastNew = newVal;
      lastOld = oldVal;
    },
    { deep: true },
  );

  assert.strictEqual(watchCount, 0);

  // Mutate nested field
  comp.state.user.details.age = 35;
  assert.strictEqual(watchCount, 1);
  // newVal and oldVal point to the same object
  assert.strictEqual(lastNew, comp.state.user);
  assert.strictEqual(lastOld, comp.state.user);
  assert.strictEqual(lastNew.details.age, 35);

  // Deep watch an array
  let arrayWatchCount = 0;
  comp.$watch(
    'tags',
    () => {
      arrayWatchCount++;
    },
    { deep: true },
  );

  comp.state.tags.push('css');
  assert.strictEqual(arrayWatchCount, 1);

  console.log('  ✅ Deep watcher tracked and triggered on nested mutations.');
}

/**
 * Test 6: Automatic watcher cleanup on unmount.
 */
function testWatcherTeardown() {
  console.log('🧪 Testing $watch automatic cleanup on component unmount...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  comp.$watch('count', () => {
    watchCount++;
  });

  comp.state.count = 1;
  assert.strictEqual(watchCount, 1);

  // Unmount
  comp.unmount();

  // Mutating after unmount should NOT trigger callback
  comp.state.count = 2;
  assert.strictEqual(watchCount, 1);

  console.log('  ✅ Watcher cleaned up successfully on component unmount.');
}

/**
 * Test 7: Watch an array of sources (multi-source watching).
 */
function testWatchArrayOfSources() {
  console.log('🧪 Testing $watch with an array of sources...');
  const comp = new WatchTestComponent();

  let watchCount = 0;
  let lastNew = null;
  let lastOld = null;

  // Watch an array combining a getter function and a key string path
  comp.$watch(
    [() => comp.state.count, 'user.name'],
    (newVals, oldVals) => {
      watchCount++;
      lastNew = newVals;
      lastOld = oldVals;
    },
  );

  assert.strictEqual(watchCount, 0);

  // Mutate first source in array (count)
  comp.state.count = 5;
  assert.strictEqual(watchCount, 1);
  assert.deepStrictEqual(lastNew, [5, 'Alice']);
  assert.deepStrictEqual(lastOld, [0, 'Alice']);

  // Mutate second source in array (user.name)
  comp.state.user.name = 'Bob';
  assert.strictEqual(watchCount, 2);
  assert.deepStrictEqual(lastNew, [5, 'Bob']);
  assert.deepStrictEqual(lastOld, [5, 'Alice']);

  // Unmount cleanup test for array watcher
  comp.unmount();
  comp.state.count = 10;
  comp.state.user.name = 'Charlie';
  assert.strictEqual(watchCount, 2, 'Watchers should be cleaned up on unmount');

  console.log('  ✅ Array of sources watcher triggered and cleaned up successfully.');
}

function runTests() {
  try {
    testWatchKeyString();
    testWatchPathString();
    testWatchGetter();
    testWatchImmediate();
    testWatchDeep();
    testWatcherTeardown();
    testWatchArrayOfSources();
    console.log('✅ All $watch API tests passed!');
  } catch (error) {
    console.error('❌ $watch API tests failed!');
    console.error(error);
    process.exit(1);
  }
}

runTests();
