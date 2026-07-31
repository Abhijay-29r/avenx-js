import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';

/**
 * Test 1: Verifies component instance preservation and zero lifecycle teardown/remount during list sorting.
 */
async function testComponentInstancePreservationOnSort() {
  console.log('🧪 Testing component instance preservation and lifecycle stability during list sorting...');

  let unmountCount = 0;
  let mountCount = 0;

  class ItemChildComponent extends AvenxComponent {
    onMount() {
      mountCount++;
    }
    onUnmount() {
      unmountCount++;
    }
  }

  const initialItems = [
    { id: 101, title: 'Alpha' },
    { id: 102, title: 'Beta' },
    { id: 103, title: 'Gamma' },
    { id: 104, title: 'Delta' },
  ];

  const parentComp = new AvenxComponent(
    { items: initialItems },
    {},
    {},
    `<div>
      <template data-ax-for="items" data-ax-as="item" data-ax-key="item.id">
        <div class="item-container" data-ax-ref="item">
          <span>{% item.title %}</span>
        </div>
      </template>
    </div>`
  );

  const root = document.createElement('div');
  document.body.appendChild(root);

  parentComp.mount(root);
  await parentComp.nextTick();

  let renderedNodes = Array.from(root.querySelectorAll('.item-container'));
  assert.strictEqual(renderedNodes.length, 4, 'Should render 4 list items initially');

  // Attach mock component instances to elements to verify instance preservation
  const mockInstances = new Map();
  renderedNodes.forEach((node, index) => {
    const compInstance = new ItemChildComponent({}, {}, {}, `<div>${initialItems[index].title}</div>`);
    compInstance.__setMountTarget(node);
    compInstance.__afterMount();
    mockInstances.set(initialItems[index].id, compInstance);
    assert.strictEqual(node.__avenx_comp_instance, compInstance);
  });

  const initialMounts = mountCount;
  assert.strictEqual(initialMounts, 4, 'Initial mount hooks should have fired 4 times.');
  assert.strictEqual(unmountCount, 0, 'No unmount hooks should have fired initially.');

  // Reorder items (reverse order: Delta, Gamma, Beta, Alpha)
  parentComp.state.items = [
    { id: 104, title: 'Delta' },
    { id: 103, title: 'Gamma' },
    { id: 102, title: 'Beta' },
    { id: 101, title: 'Alpha' },
  ];
  await parentComp.nextTick();

  renderedNodes = Array.from(root.querySelectorAll('.item-container'));
  assert.strictEqual(renderedNodes.length, 4);

  // Assert that DOM node references and attached component instances were preserved without unmounting
  assert.strictEqual(renderedNodes[0].__avenx_comp_instance, mockInstances.get(104), 'Delta instance preserved');
  assert.strictEqual(renderedNodes[1].__avenx_comp_instance, mockInstances.get(103), 'Gamma instance preserved');
  assert.strictEqual(renderedNodes[2].__avenx_comp_instance, mockInstances.get(102), 'Beta instance preserved');
  assert.strictEqual(renderedNodes[3].__avenx_comp_instance, mockInstances.get(101), 'Alpha instance preserved');

  assert.strictEqual(unmountCount, 0, 'Sorting operations MUST NOT trigger unmount lifecycles on existing items.');
  assert.strictEqual(mountCount, initialMounts, 'Sorting operations MUST NOT trigger mount lifecycles on existing items.');

  console.log('  ✅ Component instances and lifecycles strictly preserved during sorting!');
}

/**
 * Test 2: Verifies complex middle-sequence reordering (LIS diffing) with DOM node identity preservation.
 */
async function testComplexLISReordering() {
  console.log('🧪 Testing complex middle-sequence list reordering with LIS diffing...');

  const items = [
    { id: 1, text: 'Item 1' },
    { id: 2, text: 'Item 2' },
    { id: 3, text: 'Item 3' },
    { id: 4, text: 'Item 4' },
    { id: 5, text: 'Item 5' },
  ];

  const parentComp = new AvenxComponent(
    { items },
    {},
    {},
    `<div>
      <template data-ax-for="items" data-ax-as="item" data-ax-key="item.id">
        <div class="row">{% item.text %}</div>
      </template>
    </div>`
  );

  const root = document.createElement('div');
  document.body.appendChild(root);
  parentComp.mount(root);
  await parentComp.nextTick();

  const nodeMap = new Map();
  Array.from(root.querySelectorAll('.row')).forEach((el) => {
    const key = el.getAttribute('data-ax-key-val');
    nodeMap.set(key, el);
  });

  // Reorder items: move item 2 to end, item 4 to start -> [4, 1, 3, 5, 2]
  parentComp.state.items = [
    { id: 4, text: 'Item 4' },
    { id: 1, text: 'Item 1' },
    { id: 3, text: 'Item 3' },
    { id: 5, text: 'Item 5' },
    { id: 2, text: 'Item 2' },
  ];
  await parentComp.nextTick();

  const newNodes = Array.from(root.querySelectorAll('.row'));
  assert.strictEqual(newNodes.length, 5);

  assert.strictEqual(newNodes[0], nodeMap.get('4'), 'Index 0 is Item 4 node');
  assert.strictEqual(newNodes[1], nodeMap.get('1'), 'Index 1 is Item 1 node');
  assert.strictEqual(newNodes[2], nodeMap.get('3'), 'Index 2 is Item 3 node');
  assert.strictEqual(newNodes[3], nodeMap.get('5'), 'Index 3 is Item 5 node');
  assert.strictEqual(newNodes[4], nodeMap.get('2'), 'Index 4 is Item 2 node');

  console.log('  ✅ Complex middle-sequence LIS reordering verified!');
}

async function runAllTests() {
  try {
    await testComponentInstancePreservationOnSort();
    await testComplexLISReordering();

    console.log('✅ All LCS list diffing integration tests passed successfully!');
  } catch (err) {
    console.error('❌ LCS list diffing integration tests failed!');
    console.error(err);
    process.exit(1);
  }
}

runAllTests();
