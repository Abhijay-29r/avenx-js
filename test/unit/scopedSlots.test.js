import assert from 'assert';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import StyleProcessor from '../../lib/compiler/StyleProcessor.js';
import ComponentParser from '../../lib/compiler/ComponentParser.js';

try {
  console.log('🧪 Testing Scoped Slots in Avenx components...');

  // 1. Define child component that exposes properties on its slot
  class ListContainer extends AvenxComponent {
    constructor(bridges, props) {
      super(
        {
          current: { name: 'Initial Item' },
          visible: true
        },
        {},
        bridges,
        '<div class="list-container">' +
          '  <slot :item="state.current" :visible="state.visible"></slot>' +
          '</div>',
        {},
        props
      );
    }
  }

  // 2. Define parent component (page) that transcludes scoped slot template
  class ScopedSlotPage extends AvenxPage {
    constructor(bridges, componentRegistry) {
      const cp = new ComponentParser(new StyleProcessor());
      const compiledTemplate = cp.processComponentTags(
        '<div>' +
          '  <ListContainer>' +
          '    <template data-slot-props="slotProps">' +
          '      <span class="item-name" data-ax-show="slotProps.visible">Item Name: {{ slotProps.item.name }}</span>' +
          '      <button class="item-btn" @click="handleItemClick(slotProps.item)">Click Me</button>' +
          '    </template>' +
          '  </ListContainer>' +
          '</div>'
      );
      super(
        {
          clickedItem: null
        },
        {},
        bridges,
        compiledTemplate,
        {
          handleItemClick(item) {
            this.clickedItem = item;
          }
        },
        componentRegistry
      );
    }
  }

  const registry = new Map();
  registry.set('ListContainer', ListContainer);

  const page = new ScopedSlotPage({}, registry);
  const mountTarget = document.createElement('div');
  document.body.appendChild(mountTarget);

  page.mount(mountTarget);

  // Allow next tick for compilation / initial render to complete
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Verify that the slot content rendered successfully with child's data
  const itemNameEl = mountTarget.querySelector('.item-name');
  assert.ok(itemNameEl, 'Scoped slot element should render in DOM');
  assert.strictEqual(
    itemNameEl.textContent.trim(),
    'Item Name: Initial Item',
    'Should correctly pass child item properties to parent template'
  );

  // Verify dynamic directives (like data-ax-show) access slotProps correctly
  assert.notStrictEqual(itemNameEl.style.display, 'none', 'Element should be visible initially');

  // Verify reactivity: mutate child component data, should trigger slot content updates
  const childContainerEl = mountTarget.querySelector('[data-avenx-comp="ListContainer"]');
  assert.ok(childContainerEl, 'Child component container should be in DOM');
  const childInstance = childContainerEl.__avenx_comp_instance;
  assert.ok(childInstance, 'Child component instance should be registered');

  childInstance.state.current = { name: 'Reactively Updated Item' };
  await new Promise((resolve) => setTimeout(resolve, 0));

  const updatedItemNameEl = mountTarget.querySelector('.item-name');
  assert.ok(updatedItemNameEl, 'Scoped slot element should still render in DOM');
  assert.strictEqual(
    updatedItemNameEl.textContent.trim(),
    'Item Name: Reactively Updated Item',
    'Scoped slot template should update when child state changes'
  );

  // Verify event handler context binding & parameter extraction from slotProps
  const clickBtn = mountTarget.querySelector('.item-btn');
  assert.ok(clickBtn, 'Button inside scoped slot should exist');
  clickBtn.click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(page.state.clickedItem, 'clickedItem should be set');
  assert.strictEqual(
    page.state.clickedItem.name,
    'Reactively Updated Item',
    'Event handler inside scoped slot should receive correct slotProps parameter'
  );

  // Verify data-ax-show reactivity inside slot
  childInstance.state.visible = false;
  await new Promise((resolve) => setTimeout(resolve, 0));
  const hiddenItemNameEl = mountTarget.querySelector('.item-name');
  assert.strictEqual(hiddenItemNameEl.style.display, 'none', 'Directives inside scoped slot should react to child state changes');

  // Cleanup
  document.body.removeChild(mountTarget);

  console.log('  ✅ Scoped Slots integration and event handling tests successfully passed!');
} catch (error) {
  console.error('❌ Scoped Slots tests failed!');
  console.error(error);
  process.exit(1);
}
