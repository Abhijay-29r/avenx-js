import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';

/**
 * Tests basic $emit method presence and functionality on a component.
 */
function testEmitFunctionality() {
  console.log('🧪 Testing $emit basic functionality...');

  let emitted = false;
  let eventDetail = null;

  const component = new AvenxComponent(
    { count: 0 },
    {},
    {},
    '<button data-ax-ref="btn" @click="notify()">Click</button>',
    {
      notify() {
        this.$emit('custom-event', { count: this.count });
      },
    },
  );

  const root = document.createElement('div');
  root.addEventListener('custom-event', (e) => {
    emitted = true;
    eventDetail = e.detail;
  });

  component.__setMountTarget(root);
  component.runUpdate();

  const button = component.$refs.btn;
  button.click();

  assert.ok(emitted, 'custom-event should be emitted');
  assert.deepStrictEqual(eventDetail, { count: 0 }, 'event detail should match');

  console.log('  ✅ $emit successfully executes and dispatches CustomEvent.');
}

/**
 * Tests custom event listening from parent component with delegation.
 */
function testCustomEventDelegation() {
  console.log('🧪 Testing parent listening to custom events via @eventName...');

  const sp = new StyleProcessor();
  const cp = new ComponentParser(sp);

  const childTemplateRaw = `
    <state count="42" />
    <action name="send">
      $emit('hello', { value: count });
    </action>
    <button data-ax-ref="btn" @click="send()">Send</button>
  `;
  const childTemplate = cp.extractTemplate(childTemplateRaw, {}, 'ChildComponent');

  const parentTemplateRaw = `
    <state receivedValue="" />
    <action name="handleHello">
      state.receivedValue = args[0].detail.value;
    </action>
    <div>
      <ChildComponent @hello="handleHello(event)" />
    </div>
  `;
  const parentTemplate = cp.processComponentTags(parentTemplateRaw);

  class ChildComponent extends AvenxComponent {
    constructor(bridges, props) {
      super({ count: 42 }, {}, bridges, childTemplate, { send: "$emit('hello', { value: count });" }, props);
    }
  }

  class ParentPage extends AvenxPage {
    constructor(bridges, componentRegistry) {
      super(
        { receivedValue: 0 },
        {},
        bridges,
        parentTemplate,
        { handleHello: 'state.receivedValue = args[0].detail.value;' },
        componentRegistry,
      );
    }
  }

  const componentRegistry = new Map();
  componentRegistry.set('ChildComponent', ChildComponent);

  const parent = new ParentPage({}, componentRegistry);
  const root = document.createElement('div');
  parent.mount(root);
  parent.runUpdate();

  const childEl = root.querySelector('[data-avenx-comp="ChildComponent"]');
  assert.ok(childEl, 'Child component should be mounted');

  const childCompInstance = childEl.__avenx_comp_instance;
  assert.ok(childCompInstance, 'Child component instance should be linked');

  const btn = childCompInstance.$refs.btn;
  assert.ok(btn, 'Send button should exist in child component');

  btn.click();

  assert.strictEqual(parent.state.receivedValue, 42, 'Parent should receive custom event detail');

  console.log('  ✅ Parent captures child events via @eventName="handler" syntax.');
}

/**
 * Tests this.emit() with CustomEventInit options (bubbles, cancelable).
 */
function testEmitWithOptions() {
  console.log('🧪 Testing this.emit() with custom options (bubbles, cancelable)...');

  let caughtOnRoot = false;
  let caughtOnChild = false;
  let eventCancelable = null;
  let eventBubbles = null;

  const component = new AvenxComponent(
    {},
    {},
    {},
    '<button data-ax-ref="btn">Click</button>',
    {},
  );

  const root = document.createElement('div');
  const container = document.createElement('div');
  root.appendChild(container);
  component.mount(container);

  root.addEventListener('non-bubbling-event', () => {
    caughtOnRoot = true;
  });

  component.$element.addEventListener('non-bubbling-event', (e) => {
    caughtOnChild = true;
    eventBubbles = e.bubbles;
    eventCancelable = e.cancelable;
  });

  component.emit('non-bubbling-event', { payload: 123 }, { bubbles: false, cancelable: false });

  assert.strictEqual(caughtOnChild, true, 'Event should fire on target element');
  assert.strictEqual(caughtOnRoot, false, 'Non-bubbling event should not bubble up to parent');
  assert.strictEqual(eventBubbles, false, 'Event bubbles property should be false');
  assert.strictEqual(eventCancelable, false, 'Event cancelable property should be false');

  console.log('  ✅ this.emit() correctly handles CustomEventInit options (bubbles: false, cancelable: false).');
}

function runTests() {
  try {
    testEmitFunctionality();
    testCustomEventDelegation();
    testEmitWithOptions();
    console.log('✅ All component custom event emission tests passed!');
  } catch (error) {
    console.error('❌ Component custom event emission tests failed!');
    console.error(error);
    process.exit(1);
  }
}

runTests();
