import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

async function runTests() {
  console.log('🧪 Testing Global Mixins and Plugins API...');

  // Setup DOM target
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);

  // Helper to create App instance
  const createApp = () => new AvenxApp({ target: '#app' });

  // Clear global mixins before and after each test
  AvenxComponent.clearMixins();

  // Test 1: Functional Plugin registration
  {
    console.log('  1. Testing Functional Plugins...');
    const app = createApp();
    let called = 0;
    let receivedApp = null;
    let receivedOptions = null;

    const plugin = (a, opts) => {
      called++;
      receivedApp = a;
      receivedOptions = opts;
    };

    app.use(plugin, { foo: 'bar' });
    assert.strictEqual(called, 1);
    assert.strictEqual(receivedApp, app);
    assert.deepStrictEqual(receivedOptions, { foo: 'bar' });

    // Test duplicate prevention
    app.use(plugin);
    assert.strictEqual(called, 1, 'Functional plugin should not be installed twice');
  }

  // Test 2: Object Plugin registration
  {
    console.log('  2. Testing Object Plugins with install method...');
    const app = createApp();
    let called = 0;
    let receivedApp = null;
    let receivedOptions = null;

    const plugin = {
      install(a, opts) {
        called++;
        receivedApp = a;
        receivedOptions = opts;
      }
    };

    app.use(plugin, { hello: 'world' });
    assert.strictEqual(called, 1);
    assert.strictEqual(receivedApp, app);
    assert.deepStrictEqual(receivedOptions, { hello: 'world' });

    // Test duplicate prevention
    app.use(plugin);
    assert.strictEqual(called, 1, 'Object plugin should not be installed twice');
  }

  // Test 2b: Dynamic Imports & Async Loader Plugin registration
  {
    console.log('  2b. Testing Async Loader Functions and Dynamic Imports in app.use()...');
    const app = createApp();

    // 2b-1: Async loader function returning ES module with default functional plugin
    let calledAsync1 = 0;
    let options1 = null;
    const asyncPlugin1 = (a, opts) => {
      calledAsync1++;
      options1 = opts;
    };

    const loader1 = async () => ({ default: asyncPlugin1 });
    const res1 = await app.use(loader1, { mode: 'async-1' });

    assert.strictEqual(res1, app, 'app.use should return app instance when awaited');
    assert.strictEqual(calledAsync1, 1);
    assert.deepStrictEqual(options1, { mode: 'async-1' });

    // Test duplicate prevention for async loader
    await app.use(loader1);
    assert.strictEqual(calledAsync1, 1, 'Async loader plugin should not be installed twice');

    // 2b-2: Async loader returning ES module with default object plugin (.install)
    let calledAsync2 = 0;
    let options2 = null;
    const asyncObjPlugin = {
      install(a, opts) {
        calledAsync2++;
        options2 = opts;
      }
    };
    const loader2 = async () => ({ default: asyncObjPlugin });
    await app.use(loader2, { mode: 'async-2' });

    assert.strictEqual(calledAsync2, 1);
    assert.deepStrictEqual(options2, { mode: 'async-2' });

    // 2b-3: Direct Promise argument (e.g. app.use(import(...)))
    let calledAsync3 = 0;
    const directPromisePlugin = (a) => {
      calledAsync3++;
      assert.strictEqual(a, app);
    };
    await app.use(Promise.resolve({ default: directPromisePlugin }));
    assert.strictEqual(calledAsync3, 1);

    // 2b-4: Async installer function
    let calledAsync4 = 0;
    const asyncInstaller = async (a) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      calledAsync4++;
      assert.strictEqual(a, app);
    };
    await app.use(asyncInstaller);
    assert.strictEqual(calledAsync4, 1);
  }

  // Test 3: Mixin State, Computed, Methods, Props, Styles merging
  {
    console.log('  3. Testing Mixin options merging (state, computed, methods, props, styles)...');
    AvenxComponent.clearMixins();

    const app = createApp();

    app.mixin({
      state: {
        mixinState: 'mixin-value',
        overriddenState: 'mixin-value'
      },
      computed: {
        mixinComputed() {
          return this.state.mixinState + '-computed';
        }
      },
      methods: {
        mixinMethod() {
          return 'mixin-method-result';
        }
      },
      props: {
        mixinProp: 'mixin-prop-default'
      },
      styles: {
        mixinStyle: 'mixin-style-value'
      }
    });

    class TestComponent extends AvenxComponent {
      constructor(bridges = {}) {
        super(
          { overriddenState: 'comp-value', compState: 123 },
          {},
          bridges,
          '<div>{{mixinState}} - {{mixinComputed}} - {{mixinMethod()}} - {{overriddenState}}</div>',
          {},
          {},
          {}
        );
      }
    }

    app.register('TestComponent', TestComponent);
    app.mount('TestComponent');

    const comp = container.__avenx_comp_instance;
    assert.ok(comp, 'Component should be instantiated');

    // Check state merging
    assert.strictEqual(comp.state.mixinState, 'mixin-value');
    assert.strictEqual(comp.state.compState, 123);
    assert.strictEqual(comp.state.overriddenState, 'comp-value', 'Subclass state should override mixin state');

    // Check computed merging
    assert.strictEqual(comp.state.mixinComputed, 'mixin-value-computed');

    // Check methods merging
    assert.strictEqual(comp.mixinMethod(), 'mixin-method-result');

    // Check props & styles merging
    assert.strictEqual(comp.props.mixinProp, 'mixin-prop-default');
    assert.strictEqual(comp.styles.mixinStyle, 'mixin-style-value');

    // Check availability in templates/rendering
    const html = container.innerHTML;
    assert.ok(html.includes('mixin-value - mixin-value-computed - mixin-method-result - comp-value'), `Rendering output should match, got: ${html}`);

    comp.unmount();
  }

  // Test 4: Merging functions for state/data
  {
    console.log('  4. Testing functional mixin state/data...');
    AvenxComponent.clearMixins();
    const app = createApp();

    app.mixin({
      state() {
        return { val1: 'func-state' };
      },
      data() {
        return { val2: 'func-data' };
      }
    });

    class TestCompFuncState extends AvenxComponent {
      constructor() {
        super();
      }
    }

    app.register('TestCompFuncState', TestCompFuncState);
    app.mount('TestCompFuncState');
    const comp = container.__avenx_comp_instance;

    assert.strictEqual(comp.state.val1, 'func-state');
    assert.strictEqual(comp.state.val2, 'func-data');
    comp.unmount();
  }

  // Test 5: Custom non-reserved properties and methods on mixin object
  {
    console.log('  5. Testing custom non-reserved properties/methods directly on mixin...');
    AvenxComponent.clearMixins();
    const app = createApp();

    app.mixin({
      customHelper() {
        return 'helper-run';
      },
      customProp: 99
    });

    class TestCompCustomProps extends AvenxComponent {
      constructor() {
        super({}, {}, {}, '<div>{{customProp}} - {{customHelper()}}</div>');
      }
    }

    app.register('TestCompCustomProps', TestCompCustomProps);
    app.mount('TestCompCustomProps');
    const comp = container.__avenx_comp_instance;

    // Check they are on the instance
    assert.strictEqual(comp.customProp, 99);
    assert.strictEqual(comp.customHelper(), 'helper-run');

    // Check they are in template
    const html = container.innerHTML;
    assert.ok(html.includes('99 - helper-run'), `Template rendering should resolve custom mixin properties/methods, got: ${html}`);
    comp.unmount();
  }

  // Test 6: Lifecycle hook merging, ordering, and robustness
  {
    console.log('  6. Testing lifecycle hooks merging, ordering and robustness...');
    AvenxComponent.clearMixins();
    const app = createApp();

    const order = [];

    app.mixin({
      onBeforeMount() {
        order.push('mixin1-before-mount');
      },
      onMount() {
        order.push('mixin1-mount');
      },
      onBeforeUpdate() {
        order.push('mixin1-before-update');
      },
      onUpdate() {
        order.push('mixin1-update');
      },
      onUnmount() {
        order.push('mixin1-unmount');
      }
    });

    app.mixin({
      onBeforeMount() {
        order.push('mixin2-before-mount');
      },
      onMount() {
        order.push('mixin2-mount');
      }
    });

    class TestCompLifecycle extends AvenxComponent {
      constructor() {
        super({ x: 1 }, {}, {}, '<div>{{x}}</div>', {
          onBeforeMount() {
            order.push('comp-before-mount');
          },
          onMount() {
            order.push('comp-mount');
          },
          onBeforeUpdate() {
            order.push('comp-before-update');
          },
          onUpdate() {
            order.push('comp-update');
          },
          onUnmount() {
            order.push('comp-unmount');
          }
        });
      }
    }

    app.register('TestCompLifecycle', TestCompLifecycle);
    app.mount('TestCompLifecycle');

    // Check mount order
    assert.deepStrictEqual(order, [
      'mixin1-before-mount',
      'mixin2-before-mount',
      'comp-before-mount',
      'mixin1-mount',
      'mixin2-mount',
      'comp-mount'
    ]);

    // Reset order
    order.length = 0;

    // Trigger update
    const comp = container.__avenx_comp_instance;
    comp.state.x = 2;
    comp.update();

    // Check update order
    assert.deepStrictEqual(order, [
      'mixin1-before-update',
      'comp-before-update',
      'mixin1-update',
      'comp-update'
    ]);

    // Reset order
    order.length = 0;

    // Trigger unmount
    comp.unmount();

    // Check unmount order
    assert.deepStrictEqual(order, [
      'mixin1-unmount',
      'comp-unmount'
    ]);
  }

  // Test 7: Hook robustness (if one mixin hook throws, others still run)
  {
    console.log('  7. Testing hook robustness (errors in mixin hooks)...');
    AvenxComponent.clearMixins();
    const app = createApp();

    let afterThrowRun = false;
    let compHookRun = false;

    // Silent warnings / errors during robustness tests
    const originalError = console.error;
    console.error = () => {};

    app.mixin({
      onMount() {
        throw new Error('Mixin hook failed intentionally');
      }
    });

    app.mixin({
      onMount() {
        afterThrowRun = true;
      }
    });

    class RobustComponent extends AvenxComponent {
      constructor() {
        super({}, {}, {}, '<div>Robust</div>', {
          onMount() {
            compHookRun = true;
          }
        });
      }
    }

    app.register('RobustComponent', RobustComponent);
    app.mount('RobustComponent');

    assert.ok(afterThrowRun, 'Subsequent mixin hooks should run even if one throws');
    assert.ok(compHookRun, 'Component own hook should run even if a mixin hook throws');

    // Restore error logging
    console.error = originalError;

    const comp = container.__avenx_comp_instance;
    comp.unmount();
  }

  // Cleanup
  document.body.removeChild(container);
  AvenxComponent.clearMixins();
  console.log('✅ All Global Mixins and Plugins API tests passed!');
}

(async () => {
  try {
    await runTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Global Mixins and Plugins API tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
