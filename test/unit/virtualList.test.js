import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { VirtualList } from '../../lib/core/runtime/VirtualList.js';

// Setup Mock ResizeObserver if not natively present in happy-dom environment
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observedTargets = new Set();
      MockResizeObserver.instances.push(this);
    }
    observe(target) {
      this.observedTargets.add(target);
    }
    unobserve(target) {
      this.observedTargets.delete(target);
    }
    disconnect() {
      this.observedTargets.clear();
      this.isDisconnected = true;
    }
    trigger(entry) {
      this.callback(Array.isArray(entry) ? entry : [entry]);
    }
  };
  global.ResizeObserver.instances = [];
}

async function runTests() {
  try {
    console.log('🧪 Testing VirtualList built-in component...');

    // 1. Setup host component (AvenxPage) and compile-simulate template
    class TestPage extends AvenxPage {
      constructor() {
        super(
          {
            items: Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
            height: 30,
          },
          {},
          {},
          `
          <div class="host">
            <div data-avenx-comp="VirtualList" data-props-items="state.items" data-props-item-height="state.height">
              <template data-ax-as="item">
                <div class="row">Item: {% item.name %}</div>
              </template>
            </div>
          </div>
          `,
          {},
          new Map([['VirtualList', VirtualList]])
        );
      }
    }

    const testRoot = document.createElement('div');
    document.body.appendChild(testRoot);

    const page = new TestPage();
    page.mount(testRoot);
    page.update();

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify mount successfully
    const virtualListEl = testRoot.querySelector('[data-avenx-comp="VirtualList"]');
    assert.ok(virtualListEl, 'VirtualList component should mount to DOM.');

    const virtualListInstance = virtualListEl.__avenx_comp_instance;
    assert.ok(virtualListInstance, 'VirtualList instance should be attached to element.');

    const spacer = virtualListInstance.$refs.spacer;
    assert.ok(spacer, 'Spacer ref should exist.');

    const viewport = virtualListInstance.$refs.viewport;
    assert.ok(viewport, 'Viewport ref should exist.');

    // 2. Validate initial render with DOM footprint constraints
    const initialChildrenCount = spacer.childNodes.length;
    console.log(`  Initial visible elements count: ${initialChildrenCount}`);
    
    assert.ok(initialChildrenCount > 0, 'Should render some visible elements.');
    assert.ok(initialChildrenCount < 50, 'Should render under 50 elements for DOM footprint constraints.');

    // Verify content of first item
    assert.strictEqual(
      spacer.childNodes[0].textContent.trim(),
      'Item: Item 0',
      'First visible element should render Item 0 content.'
    );

    // 3. Test Scroll and recycled node updates
    console.log('  Simulating scroll to index 100...');
    
    // Scroll past 100 items (100 * 30px = 3000px)
    viewport.scrollTop = 3000;
    virtualListInstance.onScroll();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const scrolledChildrenCount = spacer.childNodes.length;
    console.log(`  Scrolled visible elements count: ${scrolledChildrenCount}`);
    assert.ok(scrolledChildrenCount < 50, 'Scrolled DOM footprint must remain under 50 elements.');

    const firstChildIndex = parseInt(spacer.childNodes[0].getAttribute('data-index'), 10);
    console.log(`  First visible element index after scroll: ${firstChildIndex}`);
    assert.ok(firstChildIndex > 90 && firstChildIndex < 100, 'First visible index should align with scroll offset and buffer.');

    assert.strictEqual(
      spacer.childNodes[0].textContent.trim(),
      `Item: Item ${firstChildIndex}`,
      `First visible element should render Item ${firstChildIndex} after scroll.`
    );

    // Test scroll throttling: firing multiple scroll events synchronously
    console.log('  Testing scroll event throttling and requestAnimationFrame sync...');
    let layoutCalls = 0;
    const originalLayout = virtualListInstance.layout.bind(virtualListInstance);
    virtualListInstance.layout = () => {
      layoutCalls++;
      originalLayout();
    };

    virtualListInstance.onScroll();
    virtualListInstance.onScroll();
    virtualListInstance.onScroll();

    assert.ok(virtualListInstance.scrollRafId !== null, 'scrollRafId should be set during scroll animation frame.');
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(layoutCalls, 1, 'Multiple rapid scroll events must be throttled to 1 layout call per frame.');
    assert.strictEqual(virtualListInstance.scrollRafId, null, 'scrollRafId should reset after animation frame completes.');

    // 4. Verify spacer paddings update correctly to maintain scroll position
    const spacerPaddingTop = parseFloat(spacer.style.paddingTop);
    const spacerPaddingBottom = parseFloat(spacer.style.paddingBottom);
    assert.ok(spacerPaddingTop > 0, 'padding-top should represent scrolled-out content height.');
    assert.ok(spacerPaddingBottom > 0, 'padding-bottom should represent remaining bottom content height.');
    assert.strictEqual(
      spacerPaddingTop + spacerPaddingBottom + (scrolledChildrenCount * 30),
      300000,
      'Total height represented by padding + elements height should match 10,000 items * 30px.'
    );

    // 5. Test dynamic item resizing via ResizeObserver
    console.log('  Testing dynamic item resizing via ResizeObserver...');
    if (global.ResizeObserver.instances.length > 0) {
      const firstRow = spacer.childNodes[0];
      const observerInstance = global.ResizeObserver.instances[0];

      // Simulate first row height resizing to 100px
      Object.defineProperty(firstRow, 'offsetHeight', {
        value: 100,
        configurable: true
      });

      observerInstance.trigger({
        target: firstRow
      });

      // Wait for layout update requestAnimationFrame
      await new Promise((resolve) => setTimeout(resolve, 50));

      const updatedTotalHeight = parseFloat(spacer.style.minHeight);
      
      console.log(`  Total height after resizing one item: ${updatedTotalHeight}`);
      assert.strictEqual(
        updatedTotalHeight,
        300070, // original 300,000 + 70px difference (100px - 30px)
        'Total spacer height should reactively update to account for resized item.'
      );

      // 6. Test viewport container resizing via ResizeObserver
      console.log('  Testing viewport container resizing via ResizeObserver...');
      const countBeforeViewportResize = spacer.childNodes.length;
      
      // Simulate viewport clientHeight changing from 400px to 800px
      Object.defineProperty(viewport, 'clientHeight', {
        value: 800,
        configurable: true
      });

      observerInstance.trigger({
        target: viewport
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const countAfterViewportResize = spacer.childNodes.length;
      console.log(`  Visible elements count after viewport expansion (400px -> 800px): ${countAfterViewportResize}`);
      assert.ok(
        countAfterViewportResize > countBeforeViewportResize,
        'Expanding viewport height should trigger recalculation and increase visible rows count.'
      );
    } else {
      console.log('  ⚠️ ResizeObserver mock not registered or observed.');
    }

    // 7. Test observer cleanup on unmount
    console.log('  Testing unmount cleanup...');
    const observerInstance = virtualListInstance.resizeObserver;
    page.unmount();

    assert.strictEqual(virtualListInstance.resizeObserver, null, 'resizeObserver reference should be null after unmount.');
    assert.strictEqual(virtualListInstance.rafId, null, 'rafId handle should be reset after unmount.');
    assert.strictEqual(virtualListInstance.scrollRafId, null, 'scrollRafId handle should be reset after unmount.');
    if (observerInstance) {
      assert.strictEqual(observerInstance.isDisconnected, true, 'ResizeObserver should be disconnected on unmount.');
    }

    // Clean up DOM
    document.body.removeChild(testRoot);

    console.log('  ✅ VirtualList unit tests passed successfully!');
  } catch (error) {
    console.error('❌ VirtualList unit tests failed!');
    console.error(error);
    process.exit(1);
  }
}

runTests();
