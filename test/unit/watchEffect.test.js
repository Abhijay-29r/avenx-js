import assert from 'assert';

// Mock DOM environment
const mockElement = {
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
  dispatchEvent: () => {},
  attributes: [],
  hasAttribute: () => false,
  setAttribute: () => {},
  removeAttribute: () => {},
  appendChild: () => {},
  removeChild: () => {},
  replaceWith: () => {},
  childNodes: [],
  __avenx_comp_instance: null,
};

global.document = {
  querySelector: () => mockElement,
};

global.DOMParser = class {
  parseFromString() {
    return { body: mockElement };
  }
};

global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

import { StateFactory } from '../../lib/core/reactive/createState.js';
import { AvenxWatcher, watchEffect } from '../../lib/core/index.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

/**
 * Tests top-level watchEffect function.
 */
function testTopLevelWatchEffect() {
  console.log('🧪 Testing top-level watchEffect(effect, options)...');

  const state = new StateFactory().create({
    count: 0,
    name: 'Alice',
    unrelated: 'foo',
  });

  let execCount = 0;
  let lastSeenCount = null;
  let lastSeenName = null;

  const stop = watchEffect(() => {
    execCount++;
    lastSeenCount = state.count;
    lastSeenName = state.name;
  });

  // 1. Immediate execution upon instantiation
  assert.strictEqual(execCount, 1, 'watchEffect should run immediately upon creation');
  assert.strictEqual(lastSeenCount, 0);
  assert.strictEqual(lastSeenName, 'Alice');

  // 2. Re-runs automatically when tracked dependency mutates
  state.count = 1;
  assert.strictEqual(execCount, 2);
  assert.strictEqual(lastSeenCount, 1);

  state.name = 'Bob';
  assert.strictEqual(execCount, 3);
  assert.strictEqual(lastSeenName, 'Bob');

  // 3. Untracked mutation should NOT trigger effect
  state.unrelated = 'bar';
  assert.strictEqual(execCount, 3);

  // 4. Calling stop handle tears down watcher
  stop();

  state.count = 99;
  state.name = 'Charlie';
  assert.strictEqual(execCount, 3, 'Stopped effect should not re-run on state mutation');

  console.log('  ✅ Top-level watchEffect tests passed!');
}

/**
 * Tests AvenxWatcher constructor supporting effect watchers without callback.
 */
function testAvenxWatcherEffectConstructor() {
  console.log('🧪 Testing AvenxWatcher effect constructor syntax...');

  const state = new StateFactory().create({
    value: 10,
  });

  let runs = 0;
  let currentVal = 0;

  // Passing options directly as second argument
  const watcher = new AvenxWatcher(
    () => {
      runs++;
      currentVal = state.value;
    },
    { name: 'effectWatcher' },
  );

  assert.strictEqual(watcher.isEffect, true);
  assert.strictEqual(runs, 1);
  assert.strictEqual(currentVal, 10);

  state.value = 20;
  assert.strictEqual(runs, 2);
  assert.strictEqual(currentVal, 20);

  watcher.teardown();
  state.value = 30;
  assert.strictEqual(runs, 2);

  console.log('  ✅ AvenxWatcher effect constructor tests passed!');
}

/**
 * Tests component $watchEffect API and lifecycle teardown.
 */
function testComponentWatchEffectAPI() {
  console.log('🧪 Testing AvenxComponent $watchEffect API & unmount teardown...');

  let effectExecutions = 0;
  let observedMsg = '';

  class TestComponent extends AvenxComponent {
    constructor() {
      super({ count: 1, message: 'Hello' });
    }

    onMount() {
      this.$watchEffect(() => {
        effectExecutions++;
        observedMsg = `${this.state.message} #${this.state.count}`;
      });
    }

    render() {
      return `<div>${this.state.message}</div>`;
    }
  }

  const comp = new TestComponent();
  comp.__setMountTarget(mockElement);
  comp.onMount();

  // 1. Immediate execution in component context
  assert.strictEqual(effectExecutions, 1);
  assert.strictEqual(observedMsg, 'Hello #1');

  // 2. State update triggers re-execution
  comp.state.count = 2;
  assert.strictEqual(effectExecutions, 2);
  assert.strictEqual(observedMsg, 'Hello #2');

  comp.state.message = 'Welcome';
  assert.strictEqual(effectExecutions, 3);
  assert.strictEqual(observedMsg, 'Welcome #2');

  // 3. Unmounting component automatically tears down registered $watchEffect
  assert.strictEqual(comp._watchers.length, 1);
  comp.unmount();
  assert.strictEqual(comp._watchers.length, 0);

  comp.state.count = 100;
  assert.strictEqual(effectExecutions, 3, 'Effect should not run after component unmount');

  console.log('  ✅ Component $watchEffect API & unmount teardown tests passed!');
}

/**
 * Tests manual stop function returned by component $watchEffect.
 */
function testComponentWatchEffectManualStop() {
  console.log('🧪 Testing component $watchEffect manual stop handle...');

  class TestComponent extends AvenxComponent {
    constructor() {
      super({ val: 5 });
    }
    render() {
      return '<div></div>';
    }
  }

  const comp = new TestComponent();
  let runs = 0;

  const stop = comp.$watchEffect(function () {
    runs++;
    return this.state.val;
  });

  assert.strictEqual(runs, 1);
  assert.strictEqual(comp._watchers.length, 1);

  comp.state.val = 10;
  assert.strictEqual(runs, 2);

  // Stop effect manually
  stop();
  assert.strictEqual(comp._watchers.length, 0);

  comp.state.val = 20;
  assert.strictEqual(runs, 2, 'Manually stopped effect should not re-run');

  console.log('  ✅ Component $watchEffect manual stop tests passed!');
}

/**
 * Tests watchEffect options (debounce & throttle).
 */
async function testWatchEffectOptions() {
  console.log('🧪 Testing watchEffect options (debounce & throttle)...');

  const state = new StateFactory().create({ num: 0 });

  // Debounced watchEffect
  let debounceRuns = 0;
  let lastNum = null;

  const stopDebounce = watchEffect(
    () => {
      debounceRuns++;
      lastNum = state.num;
    },
    { debounce: 50 },
  );

  assert.strictEqual(debounceRuns, 1, 'Initial execution is immediate');
  assert.strictEqual(lastNum, 0);

  state.num = 1;
  state.num = 2;
  state.num = 3;

  assert.strictEqual(debounceRuns, 1, 'Debounced effect should wait');

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.strictEqual(debounceRuns, 2, 'Debounced effect should execute once after window');
  assert.strictEqual(lastNum, 3);

  stopDebounce();

  console.log('  ✅ watchEffect options tests passed!');
}

async function runTests() {
  try {
    testTopLevelWatchEffect();
    testAvenxWatcherEffectConstructor();
    testComponentWatchEffectAPI();
    testComponentWatchEffectManualStop();
    await testWatchEffectOptions();
    console.log('✅ All watchEffect tests passed successfully!');
  } catch (error) {
    console.error('❌ watchEffect tests failed!');
    console.error(error);
    process.exit(1);
  }
}

runTests();
