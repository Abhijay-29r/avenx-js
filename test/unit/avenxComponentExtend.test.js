import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';

console.log('🧪 Testing AvenxComponent.extend() helper method...');

// ==========================================
// 1. Basic expected behavior: state & methods
// ==========================================
{
  console.log('  1. Testing basic AvenxComponent.extend() with state and methods...');

  const BaseCard = AvenxComponent.extend({
    name: 'BaseCard',
    state: { theme: 'dark' },
    methods: {
      toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
      },
    },
  });

  assert.strictEqual(BaseCard.name, 'BaseCard', 'Dynamic class name should match options.name');
  assert.ok(typeof BaseCard.prototype.toggleTheme === 'function', 'Method should be attached to prototype');

  const card = new BaseCard();
  assert.ok(card instanceof AvenxComponent, 'Instance should be instanceof AvenxComponent');
  assert.ok(card instanceof BaseCard, 'Instance should be instanceof BaseCard');
  assert.strictEqual(card.state.theme, 'dark', 'Initial state should be set');

  card.toggleTheme();
  assert.strictEqual(card.state.theme, 'light', 'Method should toggle state to light');

  card.toggleTheme();
  assert.strictEqual(card.state.theme, 'dark', 'Method should toggle state back to dark');

  console.log('  ✅ Basic AvenxComponent.extend() works as expected!');
}

// ==========================================
// 2. Functional state/data and state isolation
// ==========================================
{
  console.log('  2. Testing functional state and per-instance state isolation...');

  const CounterComponent = AvenxComponent.extend({
    name: 'CounterComponent',
    state() {
      return { count: 0, nested: { value: 10 } };
    },
    methods: {
      increment() {
        this.state.count++;
      },
    },
  });

  const c1 = new CounterComponent();
  const c2 = new CounterComponent();

  assert.strictEqual(c1.state.count, 0);
  assert.strictEqual(c2.state.count, 0);

  c1.increment();
  c1.increment();
  c1.state.nested.value = 99;

  assert.strictEqual(c1.state.count, 2, 'c1 count should be 2');
  assert.strictEqual(c2.state.count, 0, 'c2 count should remain 0');
  assert.strictEqual(c1.state.nested.value, 99, 'c1 nested value should be 99');
  assert.strictEqual(c2.state.nested.value, 10, 'c2 nested value should remain 10');

  console.log('  ✅ Functional state isolation verified!');
}

// ==========================================
// 3. Plain object state deep isolation
// ==========================================
{
  console.log('  3. Testing plain object state isolation across instances...');

  const ItemComp = AvenxComponent.extend({
    state: {
      tags: ['alpha', 'beta'],
      meta: { views: 0 },
    },
  });

  const i1 = new ItemComp();
  const i2 = new ItemComp();

  i1.state.tags.push('gamma');
  i1.state.meta.views = 5;

  assert.deepStrictEqual([...i1.state.tags], ['alpha', 'beta', 'gamma']);
  assert.deepStrictEqual([...i2.state.tags], ['alpha', 'beta'], 'i2 tags must not be mutated');
  assert.strictEqual(i1.state.meta.views, 5);
  assert.strictEqual(i2.state.meta.views, 0, 'i2 views must not be mutated');

  console.log('  ✅ Plain object state deep isolation verified!');
}

// ==========================================
// 4. Computed properties (function and expression)
// ==========================================
{
  console.log('  4. Testing computed properties on extended component...');

  const MathComp = AvenxComponent.extend({
    state: { num: 5 },
    computed: {
      doubled() {
        return this.state.num * 2;
      },
      tripled() {
        return this.state.num * 3;
      },
    },
  });

  const mathInst = new MathComp();
  assert.strictEqual(mathInst.state.doubled, 10, 'Function computed should evaluate');
  assert.strictEqual(mathInst.doubled, 10, 'Prototype computed getter should delegate to state');
  assert.strictEqual(mathInst.state.tripled, 15, 'Second computed function should evaluate');
  assert.strictEqual(mathInst.tripled, 15, 'Prototype getter should evaluate');

  mathInst.state.num = 10;
  assert.strictEqual(mathInst.state.doubled, 20, 'Computed should react to state change');
  assert.strictEqual(mathInst.doubled, 20);
  assert.strictEqual(mathInst.state.tripled, 30);
  assert.strictEqual(mathInst.tripled, 30);

  console.log('  ✅ Computed properties verified!');
}

// ==========================================
// 5. Multi-level extension (Subclassing extended components)
// ==========================================
{
  console.log('  5. Testing multi-level component extension...');

  const ParentComp = AvenxComponent.extend({
    name: 'ParentComp',
    state: { parentVal: 'parent', overrideVal: 'parent' },
    methods: {
      parentMethod() {
        return 'from parent';
      },
      overrideMethod() {
        return 'parent method';
      },
    },
  });

  const ChildComp = ParentComp.extend({
    name: 'ChildComp',
    state: { childVal: 'child', overrideVal: 'child' },
    methods: {
      childMethod() {
        return 'from child';
      },
      overrideMethod() {
        return 'child method';
      },
    },
  });

  const GrandchildComp = ChildComp.extend({
    name: 'GrandchildComp',
    state: { grandchildVal: 'grandchild' },
  });

  const gc = new GrandchildComp();

  assert.ok(gc instanceof AvenxComponent, 'gc is AvenxComponent');
  assert.ok(gc instanceof ParentComp, 'gc is ParentComp');
  assert.ok(gc instanceof ChildComp, 'gc is ChildComp');
  assert.ok(gc instanceof GrandchildComp, 'gc is GrandchildComp');

  assert.strictEqual(gc.state.parentVal, 'parent');
  assert.strictEqual(gc.state.childVal, 'child');
  assert.strictEqual(gc.state.grandchildVal, 'grandchild');
  assert.strictEqual(gc.state.overrideVal, 'child', 'Child state overrides parent');

  assert.strictEqual(gc.parentMethod(), 'from parent');
  assert.strictEqual(gc.childMethod(), 'from child');
  assert.strictEqual(gc.overrideMethod(), 'child method', 'Child method overrides parent');

  console.log('  ✅ Multi-level component extension verified!');
}

// ==========================================
// 6. Template rendering & mounting
// ==========================================
{
  console.log('  6. Testing template rendering and mounting...');

  const RenderComp = AvenxComponent.extend({
    name: 'RenderComp',
    template: '<div class="render-box"><span class="val">{{state.msg}}</span></div>',
    state: { msg: 'Hello Avenx' },
    methods: {
      setMsg(newMsg) {
        this.state.msg = newMsg;
      },
    },
  });

  const container = document.createElement('div');
  document.body.appendChild(container);

  const inst = new RenderComp();
  inst.mount(container);

  assert.ok(container.innerHTML.includes('Hello Avenx'), 'Template should render initial state');

  inst.setMsg('Updated Avenx');
  inst.update();

  assert.ok(container.innerHTML.includes('Updated Avenx'), 'DOM should update on state change');

  inst.unmount();
  container.remove();

  console.log('  ✅ Template rendering and mounting verified!');
}

// ==========================================
// 7. Lifecycle hooks execution
// ==========================================
{
  console.log('  7. Testing lifecycle hooks on extended component...');

  const lifecycleEvents = [];

  const LifecycleComp = AvenxComponent.extend({
    name: 'LifecycleComp',
    template: '<div>{{state.val}}</div>',
    state: { val: 1 },
    onBeforeMount() {
      lifecycleEvents.push('beforeMount');
    },
    onMount() {
      lifecycleEvents.push('mount');
    },
    onBeforeUpdate() {
      lifecycleEvents.push('beforeUpdate');
    },
    onUpdate() {
      lifecycleEvents.push('update');
    },
    onUnmount() {
      lifecycleEvents.push('unmount');
    },
  });

  const container = document.createElement('div');
  document.body.appendChild(container);

  const inst = new LifecycleComp();
  inst.mount(container);

  assert.deepStrictEqual(lifecycleEvents, ['beforeMount', 'mount']);

  inst.state.val = 2;
  inst.update();

  assert.ok(lifecycleEvents.includes('beforeUpdate'));
  assert.ok(lifecycleEvents.includes('update'));

  inst.unmount();
  assert.ok(lifecycleEvents.includes('unmount'));

  container.remove();
  console.log('  ✅ Lifecycle hooks verified!');
}

// ==========================================
// 8. Declarative watch options
// ==========================================
{
  console.log('  8. Testing declarative watch options...');

  let watchedValue = null;
  let watchedOldValue = null;

  const WatchComp = AvenxComponent.extend({
    state: { status: 'idle' },
    watch: {
      status(newVal, oldVal) {
        watchedValue = newVal;
        watchedOldValue = oldVal;
      },
    },
  });

  const inst = new WatchComp();
  inst.state.status = 'active';

  assert.strictEqual(watchedValue, 'active');
  assert.strictEqual(watchedOldValue, 'idle');

  console.log('  ✅ Declarative watch options verified!');
}

// ==========================================
// 9. Integration with AvenxApp
// ==========================================
{
  console.log('  9. Testing integration with AvenxApp register & mount...');

  const AppCard = AvenxComponent.extend({
    name: 'AppCard',
    template: '<div id="card-inner">{{state.title}}</div>',
    state: { title: 'App Card' },
  });

  const appDiv = document.createElement('div');
  appDiv.id = 'app-root';
  document.body.appendChild(appDiv);

  const app = new AvenxApp({ target: '#app-root' });
  app.register('AppCard', AppCard);

  assert.ok(app.getRegisteredComponents().includes('AppCard'), 'AppCard should be in registered components');

  app.mount('AppCard');
  assert.ok(appDiv.innerHTML.includes('App Card'), 'Mounted component should render into app target');

  appDiv.remove();
  console.log('  ✅ AvenxApp integration verified!');
}

// ==========================================
// 10. Top-level methods vs methods object
// ==========================================
{
  console.log('  10. Testing top-level functions vs methods object...');

  const TopLevelComp = AvenxComponent.extend({
    state: { text: 'start' },
    customTopLevel() {
      this.state.text = 'top-level-called';
      return this.state.text;
    },
    methods: {
      customMethod() {
        this.state.text = 'method-called';
        return this.state.text;
      },
    },
  });

  const inst = new TopLevelComp();
  assert.strictEqual(inst.customTopLevel(), 'top-level-called');
  assert.strictEqual(inst.state.text, 'top-level-called');

  assert.strictEqual(inst.customMethod(), 'method-called');
  assert.strictEqual(inst.state.text, 'method-called');

  console.log('  ✅ Top-level functions and methods verified!');
}

console.log('\n🎉 All AvenxComponent.extend() tests passed successfully!');
