import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

/**
 * Tests the shape of the $inspect() snapshot and its component name resolution.
 */
function testInspectSnapshotShape() {
  console.log('🧪 Testing $inspect() snapshot shape...');

  let computedEvaluations = 0;

  class ProfileCard extends AvenxComponent {
    constructor() {
      super(
        { count: 2 },
        {
          doubled() {
            computedEvaluations++;
            return this.state.count * 2;
          },
        },
        {},
        '<div>{{state.count}}</div>',
        {},
        { title: 'Hello' },
      );
    }
  }

  const component = new ProfileCard();
  const snapshot = component.$inspect();

  assert.strictEqual(snapshot.componentName, 'ProfileCard', 'componentName should come from the constructor');
  assert.deepStrictEqual(snapshot.state, { count: 2 }, 'state should be included in the snapshot');
  assert.strictEqual(computedEvaluations, 0, '$inspect() must not evaluate computed properties');
  assert.deepStrictEqual(snapshot.props, { title: 'Hello' }, 'props should be included in the snapshot');
  assert.deepStrictEqual(snapshot.computed, ['doubled'], 'computed should list keys only');
  assert.deepStrictEqual(snapshot.slots, [], 'slots should be empty before mount target setup');
  assert.strictEqual(snapshot.element, null, 'element should be null before mount');

  console.log('  ✅ $inspect() returns the expected snapshot schema.');
}

/**
 * Tests the component name fallback for anonymous/base-class instances.
 */
function testInspectComponentNameFallback() {
  console.log('🧪 Testing $inspect() component name fallback...');

  const component = new AvenxComponent({}, {}, {}, '<div></div>');
  const snapshot = component.$inspect();

  assert.strictEqual(snapshot.componentName, 'Component', 'base-class instances should fall back to "Component"');

  console.log('  ✅ $inspect() falls back to "Component" for unnamed components.');
}

/**
 * Tests that state and props snapshots are dead clones, detached from the
 * component's reactive proxies.
 */
function testInspectSnapshotIsDetached() {
  console.log('🧪 Testing $inspect() snapshot detachment...');

  const component = new AvenxComponent(
    { user: { name: 'Ada' } },
    {},
    {},
    '<div></div>',
    {},
    { level: 1 },
  );

  const snapshot = component.$inspect();
  snapshot.state.user.name = 'mutated';
  snapshot.props.level = 99;

  assert.strictEqual(component.state.user.name, 'Ada', 'mutating the snapshot must not touch component state');
  assert.strictEqual(component.props.level, 1, 'mutating the snapshot must not touch component props');

  component.state.user.name = 'Grace';
  assert.strictEqual(snapshot.state.user.name, 'mutated', 'later state changes must not alter an existing snapshot');

  console.log('  ✅ $inspect() snapshots are detached from reactive state.');
}

/**
 * Tests that functions and circular references in state are sanitized.
 */
function testInspectSanitizesUncloneableValues() {
  console.log('🧪 Testing $inspect() sanitization of functions and circular refs...');

  const circular = { id: 7 };
  circular.self = circular;

  const component = new AvenxComponent(
    { onPick: () => {}, node: circular },
    {},
    {},
    '<div></div>',
  );

  const snapshot = component.$inspect();

  assert.strictEqual(snapshot.state.onPick, '[Function]', 'functions should serialize to "[Function]"');
  assert.strictEqual(snapshot.state.node.id, 7, 'plain values inside circular objects should survive');
  assert.strictEqual(snapshot.state.node.self, '[Circular]', 'circular references should serialize to "[Circular]"');

  console.log('  ✅ $inspect() sanitizes functions and circular references.');
}

/**
 * Tests that slots list transcluded slot names and element is the live root.
 */
function testInspectSlotsAndElement() {
  console.log('🧪 Testing $inspect() slots and element after mount target setup...');

  const component = new AvenxComponent(
    {},
    {},
    {},
    '<div><slot></slot><slot name="footer"></slot></div>',
  );
  const root = document.createElement('div');
  const defaultNode = document.createElement('span');
  defaultNode.textContent = 'body';
  const footerNode = document.createElement('span');
  footerNode.setAttribute('slot', 'footer');
  footerNode.textContent = 'footer';
  root.appendChild(defaultNode);
  root.appendChild(footerNode);

  component.__setMountTarget(root);

  const snapshot = component.$inspect();

  assert.deepStrictEqual(snapshot.slots, ['default', 'footer'], 'slots should list default and named slot names');
  assert.strictEqual(snapshot.element, root, 'element should be the live root element');

  console.log('  ✅ $inspect() reports slot names and the live root element.');
}

testInspectSnapshotShape();
testInspectComponentNameFallback();
testInspectSnapshotIsDetached();
testInspectSanitizesUncloneableValues();
testInspectSlotsAndElement();

console.log('✅ All $inspect() tests passed.');
