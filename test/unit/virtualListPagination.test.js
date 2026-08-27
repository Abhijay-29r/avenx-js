import assert from 'assert';
import '../helpers/register-happy-dom.js';
import { VirtualList } from '../../lib/core/runtime/VirtualList.js';

// Setup Mock ResizeObserver if not natively present in happy-dom environment
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observedTargets = new Set();
    }
    observe(target) {
      this.observedTargets.add(target);
    }
    unobserve(target) {
      this.observedTargets.delete(target);
    }
    disconnect() {
      this.observedTargets.clear();
    }
  };
}

async function runTests() {
  try {
    console.log('🧪 Testing VirtualList built-in pagination support...');

    const items = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
    const virtualListComp = new VirtualList({}, {
      items,
      pageSize: 10,
      itemHeight: 30,
    });

    const templateEl = document.createElement('template');
    templateEl.setAttribute('data-ax-as', 'item');
    templateEl.innerHTML = '<div class="row">Item: {{ item.name }}</div>';
    virtualListComp.templateNode = templateEl;

    const testRoot = document.createElement('div');
    testRoot.style.height = '300px';
    document.body.appendChild(testRoot);

    virtualListComp.mount(testRoot);

    let lastEmittedEvent = null;

    // Listen to page-change event on container
    testRoot.addEventListener('page-change', (e) => {
      lastEmittedEvent = e.detail;
    });

    // 2. Initial state verification (Page 1 of 5)
    assert.strictEqual(virtualListComp.currentPage, 1, 'Initial page should be 1');
    assert.strictEqual(virtualListComp.props.items.length, 50);

    const paginationEl = testRoot.querySelector('.virtual-list-pagination');
    assert.ok(paginationEl, 'Pagination controls element should be rendered');
    assert.strictEqual(paginationEl.style.display, 'flex', 'Pagination bar should be visible');

    const pageInfoEl = testRoot.querySelector('.virtual-list-pagination-info');
    assert.strictEqual(pageInfoEl.textContent, 'Page 1 of 5 (50 items)');

    const prevBtn = testRoot.querySelector('.prev-btn');
    const nextBtn = testRoot.querySelector('.next-btn');
    assert.strictEqual(prevBtn.disabled, true, 'Prev button should be disabled on page 1');
    assert.strictEqual(nextBtn.disabled, false, 'Next button should be enabled');

    // 3. Page navigation: nextPage()
    virtualListComp.nextPage();
    assert.strictEqual(virtualListComp.currentPage, 2, 'Current page should be 2 after nextPage()');
    assert.strictEqual(pageInfoEl.textContent, 'Page 2 of 5 (50 items)');
    assert.ok(lastEmittedEvent, 'page-change event should have been emitted');
    assert.strictEqual(lastEmittedEvent.page, 2);
    assert.strictEqual(lastEmittedEvent.totalPages, 5);

    // 4. Navigation: goToPage(5)
    virtualListComp.goToPage(5);
    assert.strictEqual(virtualListComp.currentPage, 5, 'Current page should be 5');
    assert.strictEqual(prevBtn.disabled, false, 'Prev button should be enabled on page 5');
    assert.strictEqual(nextBtn.disabled, true, 'Next button should be disabled on last page');
    assert.strictEqual(lastEmittedEvent.page, 5);

    // 5. Navigation: prevPage()
    virtualListComp.prevPage();
    assert.strictEqual(virtualListComp.currentPage, 4, 'Current page should be 4 after prevPage()');

    // 6. Server-side pagination override test (totalItems)
    const serverVirtualList = new VirtualList({}, {
      items: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Page1 Item ${i + 1}` })),
      pageSize: 10,
      totalItems: 100,
      page: 1,
    });
    serverVirtualList.templateNode = templateEl;

    const serverRoot = document.createElement('div');
    document.body.appendChild(serverRoot);
    serverVirtualList.mount(serverRoot);

    assert.strictEqual(serverVirtualList.currentPage, 1);
    const serverPageInfo = serverRoot.querySelector('.virtual-list-pagination-info');
    assert.strictEqual(serverPageInfo.textContent, 'Page 1 of 10 (100 items)');

    // 7. Non-paginated fallback mode
    const defaultVirtualList = new VirtualList({}, {
      items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      itemHeight: 30,
    });
    defaultVirtualList.templateNode = templateEl;

    const defaultRoot = document.createElement('div');
    document.body.appendChild(defaultRoot);
    defaultVirtualList.mount(defaultRoot);

    const defaultPaginationEl = defaultRoot.querySelector('.virtual-list-pagination');
    assert.strictEqual(defaultPaginationEl.style.display, 'none', 'Pagination bar should be hidden when pageSize is not set');

    console.log('  ✅ VirtualList pagination unit tests passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ VirtualList pagination unit tests failed!');
    console.error(err);
    process.exit(1);
  }
}

runTests();
