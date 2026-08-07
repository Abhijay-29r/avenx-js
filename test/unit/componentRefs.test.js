import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

/**
 * Tests that elements marked with data-ax-ref are exposed through $refs.
 */
function testComponentRefCollection() {
  console.log('🧪 Testing data-ax-ref collection...');

  const component = new AvenxComponent({}, {}, {}, '<input data-ax-ref="myInput"></input>');
  const root = document.createElement('div');

  component.__setMountTarget(root);
  component.runUpdate();

  const input = root.childNodes[0];
  assert.ok(input, 'Input element should be created');
  assert.strictEqual(component.$refs.myInput, input, '$refs.myInput should point to the referenced DOM element.');

  console.log('  ✅ data-ax-ref element is available through $refs.');
}

/**
 * Tests that refs are scoped to the current component boundary.
 */
function testComponentRefScoping() {
  console.log('🧪 Testing data-ax-ref component scoping...');

  const template = `
    <div>
      <input data-ax-ref="parentInput"></input>
      <div data-avenx-comp="child-component">
        <input data-ax-ref="childInput"></input>
      </div>
    </div>
  `;
  const component = new AvenxComponent({}, {}, {}, template);
  const root = document.createElement('div');

  component.__setMountTarget(root);
  component.runUpdate();

  const outerDiv = root.childNodes[0];
  const parentInput = outerDiv.querySelector('[data-ax-ref="parentInput"]');

  assert.strictEqual(component.$refs.parentInput, parentInput, 'The parent component should collect its own ref.');
  assert.strictEqual(
    component.$refs.childInput,
    undefined,
    'The parent component should not collect refs inside nested components.',
  );

  console.log('  ✅ Refs remain scoped to the current component boundary.');
}

/**
 * Tests that a ref on an element with __avenx_comp_instance resolves to the instance.
 */
function testComponentRefResolvesToInstance() {
  console.log('🧪 Testing data-ax-ref resolving to component instance...');

  const component = new AvenxComponent({}, {}, {}, '<div data-ax-ref="childHost"></div>');
  const root = document.createElement('div');

  component.__setMountTarget(root);
  component.runUpdate();

  const host = root.childNodes[0];
  assert.ok(host, 'Host element should be created');

  const fakeInstance = { __isFakeChild: true };
  host.__avenx_comp_instance = fakeInstance;

  assert.strictEqual(
    component.$refs.childHost,
    fakeInstance,
    '$refs.childHost should resolve to __avenx_comp_instance.',
  );

  console.log('  ✅ data-ax-ref on component host resolves to the instance.');
}

/**
 * Tests that refs are cleared when the component is unmounted.
 */
function testComponentRefCleanup() {
  console.log('🧪 Testing data-ax-ref cleanup...');

  const component = new AvenxComponent({}, {}, {}, '<input data-ax-ref="myInput"></input>');
  const root = document.createElement('div');

  component.__setMountTarget(root);
  component.runUpdate();

  const input = root.childNodes[0];
  assert.strictEqual(component.$refs.myInput, input, '$refs.myInput should exist before unmount.');

  component.unmount();

  assert.deepStrictEqual(component.$refs, {}, '$refs should be cleared after component unmount.');

  console.log('  ✅ $refs are cleared after unmount.');
}

/**
 * Tests that querySelectorAll for refs is not triggered multiple times during multiple updates.
 */
function testBatchedRefResolution() {
  console.log('🧪 Testing batched data-ax-ref resolution during updates...');

  const component = new AvenxComponent(
    { count: 0 },
    {},
    {},
    '<div><button data-ax-ref="myBtn">{{ state.count }}</button></div>'
  );
  const root = document.createElement('div');

  component.__setMountTarget(root);
  component.runUpdate();

  const button = root.querySelector('[data-ax-ref="myBtn"]');
  assert.ok(button, 'Button ref element should exist.');

  // Spy on root element querySelectorAll to count DOM queries for refs
  let queryCount = 0;
  const originalQuerySelectorAll = root.querySelectorAll.bind(root);
  root.querySelectorAll = function (selector) {
    if (selector === '[data-ax-ref]') {
      queryCount++;
    }
    return originalQuerySelectorAll(selector);
  };

  // Perform multiple component updates in a single cycle
  component.runUpdate();
  component.runUpdate();
  component.runUpdate();

  // Up to this point, DOM queries for refs should NOT have fired repeatedly for each update
  assert.strictEqual(queryCount, 0, 'querySelectorAll for $refs should not run eagerly on every update.');

  // Accessing $refs or resolving refs should execute querySelectorAll exactly once
  const btnRef = component.$refs.myBtn;
  assert.strictEqual(btnRef, button, '$refs.myBtn should resolve to the correct element.');
  assert.strictEqual(queryCount, 1, 'querySelectorAll for $refs should fire at most once upon resolution.');

  // Subsequent accesses to $refs should use the cached reference without querying DOM again
  const btnRef2 = component.$refs.myBtn;
  assert.strictEqual(btnRef2, button);
  assert.strictEqual(queryCount, 1, 'Subsequent $refs accesses must use cached references.');

  console.log('  ✅ Reference resolution is correctly batched and cached.');
}

function runTests() {
  try {
    testComponentRefCollection();
    testComponentRefScoping();
    testComponentRefResolvesToInstance();
    testComponentRefCleanup();
    testBatchedRefResolution();

    console.log('✅ All component ref tests passed successfully!');
  } catch (error) {
    console.error('❌ Component ref tests failed!');
    console.error(error);
    process.exit(1);
  }
}

runTests();

