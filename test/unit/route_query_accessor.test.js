import assert from 'assert';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { AvenxMock } from '../../lib/core/runtime/AvenxMock.js';
import { MockDOMElement, setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';
// import { meta } from '@eslint/js';

let hashListeners = [];

function setupWindowMock(initialHash = '#/') {
  hashListeners = [];
  global.window = {
    addEventListener: (event, cb) => {
      if (event === 'hashchange') {
        hashListeners.push(cb);
      }
    },
    removeEventListener: (event, cb) => {
      if (event === 'hashchange') {
        hashListeners = hashListeners.filter((l) => l !== cb);
      }
    },
    location: {
      _hash: initialHash,
      get hash() {
        return this._hash;
      },
      set hash(val) {
        this._hash = val;
        hashListeners.forEach((listener) => listener());
      },
    },
  };
}

function teardownWindowMock() {
  delete global.window;
}

(async () => {
  try {
    console.log('🧪 Testing Route Query & Path Accessor ($route.query & $route.path)...');

    // ==========================================
    // 1. Fallback when no router is active
    // ==========================================
    console.log('  Testing fallback $route object...');
    const standaloneComp = new AvenxComponent();
    assert.deepStrictEqual(standaloneComp.$route, {
      hash: '',
      path: '',
      page: '',
      params: {},
      query: {},
      meta:{}
    });
    console.log('  ✅ Fallback $route test passed!');

    // ==========================================
    // 2. Component and Template Access with Router
    // ==========================================
    console.log('  Testing $route.query and $route.path with active router...');
    setupDOMMock();
    setupWindowMock('#/products?category=shoes&sort=price_asc&inStock=true&page=2');

    const rootEl = new MockDOMElement('div');
    global.document.querySelector = () => rootEl;

    class ProductPage extends AvenxPage {
      constructor(bridges, componentRegistry) {
        super(
          {},
          {},
          bridges,
          '<div id="route-info">Path: {{ $route.path }}, Category: {{ $route.query.category }}, Sort: {{ $route.query.sort }}, InStock: {{ $route.query.inStock }}, Page: {{ $route.query.page }}</div>',
          {},
          componentRegistry,
        );
      }
    }

    class ProductDetailPage extends AvenxPage {
      constructor(bridges, componentRegistry) {
        super(
          {},
          {},
          bridges,
          '<div id="detail">ID: {{ $route.params.id }}, Path: {{ $route.path }}, Tab: {{ $route.query.tab }}, Rating: {{ $route.query.rating }}</div>',
          {},
          componentRegistry,
        );
      }
    }

    const app = new AvenxApp({ target: 'div' });
    app.registerPage('Products', ProductPage);
    app.registerPage('ProductDetail', ProductDetailPage);

    const router = app.initRouter({
      '#/products': 'Products',
      '#/products/:id': 'ProductDetail',
    });

    await new Promise((r) => setTimeout(r, 20));

    // Verify router.currentRoute
    assert.strictEqual(router.currentRoute.hash, '#/products?category=shoes&sort=price_asc&inStock=true&page=2');
    assert.strictEqual(router.currentRoute.path, '#/products');
    assert.strictEqual(router.currentRoute.page, 'Products');
    assert.strictEqual(router.currentRoute.query.category, 'shoes');
    assert.strictEqual(router.currentRoute.query.sort, 'price_asc');
    assert.strictEqual(router.currentRoute.query.inStock, true);
    assert.strictEqual(router.currentRoute.query.page, 2);

    // Verify component instance $route access
    const mountedInstance = rootEl.__avenx_comp_instance;
    assert.ok(mountedInstance, 'Page should be mounted to rootEl');
    assert.strictEqual(mountedInstance.$route.path, '#/products');
    assert.strictEqual(mountedInstance.$route.query.category, 'shoes');
    assert.strictEqual(mountedInstance.$route.query.sort, 'price_asc');
    assert.strictEqual(mountedInstance.$route.query.inStock, true);
    assert.strictEqual(mountedInstance.$route.query.page, 2);

    // Verify rendered output in component render
    const renderedHtml = mountedInstance.render();
    assert.ok(
      renderedHtml.includes('Path: #/products'),
      `Expected 'Path: #/products', got: ${renderedHtml}`,
    );
    assert.ok(
      renderedHtml.includes('Category: shoes'),
      `Expected 'Category: shoes', got: ${renderedHtml}`,
    );
    assert.ok(
      renderedHtml.includes('Sort: price_asc'),
      `Expected 'Sort: price_asc', got: ${renderedHtml}`,
    );
    assert.ok(
      renderedHtml.includes('InStock: true'),
      `Expected 'InStock: true', got: ${renderedHtml}`,
    );
    assert.ok(
      renderedHtml.includes('Page: 2'),
      `Expected 'Page: 2', got: ${renderedHtml}`,
    );
    console.log('  ✅ Template & component $route accessor test passed!');

    // ==========================================
    // 3. Reactive updates on navigation
    // ==========================================
    console.log('  Testing reactivity on router.navigate()...');
    router.navigate('#/products?category=hats&sort=desc&inStock=false&page=5');
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(router.currentRoute.path, '#/products');
    assert.strictEqual(router.currentRoute.query.category, 'hats');
    assert.strictEqual(router.currentRoute.query.sort, 'desc');
    assert.strictEqual(router.currentRoute.query.inStock, false);
    assert.strictEqual(router.currentRoute.query.page, 5);

    assert.strictEqual(mountedInstance.$route.query.category, 'hats');
    assert.strictEqual(mountedInstance.$route.query.inStock, false);
    assert.strictEqual(mountedInstance.$route.query.page, 5);

    const updatedHtml = mountedInstance.render();
    assert.ok(
      updatedHtml.includes('Category: hats'),
      `Expected updated 'Category: hats', got: ${updatedHtml}`,
    );
    assert.ok(
      updatedHtml.includes('InStock: false'),
      `Expected updated 'InStock: false', got: ${updatedHtml}`,
    );
    console.log('  ✅ Reactivity on navigation test passed!');

    // ==========================================
    // 4. Combined Route Params and Query Params
    // ==========================================
    console.log('  Testing combined route params and query params...');
    router.navigate('#/products/42?tab=reviews&rating=5');
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(router.currentRoute.hash, '#/products/42?tab=reviews&rating=5');
    assert.strictEqual(router.currentRoute.path, '#/products/42');
    assert.strictEqual(router.currentRoute.params.id, '42');
    assert.strictEqual(router.currentRoute.query.tab, 'reviews');
    assert.strictEqual(router.currentRoute.query.rating, 5);

    const detailInstance = rootEl.__avenx_comp_instance;
    assert.strictEqual(detailInstance.$route.path, '#/products/42');
    assert.strictEqual(detailInstance.$route.params.id, '42');
    assert.strictEqual(detailInstance.$route.query.tab, 'reviews');
    assert.strictEqual(detailInstance.$route.query.rating, 5);

    const detailHtml = detailInstance.render();
    assert.ok(
      detailHtml.includes('ID: 42'),
      `Expected 'ID: 42', got: ${detailHtml}`,
    );
    assert.ok(
      detailHtml.includes('Path: #/products/42'),
      `Expected 'Path: #/products/42', got: ${detailHtml}`,
    );
    assert.ok(
      detailHtml.includes('Tab: reviews'),
      `Expected 'Tab: reviews', got: ${detailHtml}`,
    );
    assert.ok(
      detailHtml.includes('Rating: 5'),
      `Expected 'Rating: 5', got: ${detailHtml}`,
    );
    console.log('  ✅ Route params + query params test passed!');

    // ==========================================
    // 5. Clean path without query parameters
    // ==========================================
    console.log('  Testing route without query parameters...');
    router.navigate('#/products');
    await new Promise((r) => setTimeout(r, 20));

    assert.strictEqual(router.currentRoute.hash, '#/products');
    assert.strictEqual(router.currentRoute.path, '#/products');
    assert.deepStrictEqual({ ...router.currentRoute.query }, {});
    assert.strictEqual(Object.keys(router.currentRoute.query).length, 0);
    console.log('  ✅ Clean path without query parameters test passed!');

    router.destroy();
    teardownWindowMock();
    teardownDOMMock();

    // ==========================================
    // 6. Mock Router ($route.query & $route.path in AvenxMock)
    // ==========================================
    console.log('  Testing AvenxMock.createMockRouter query and path support...');
    setupDOMMock();

    const mockRouter = AvenxMock.createMockRouter({
      hash: '#/catalog?category=books&page=1',
      page: 'Catalog',
      params: { id: '99' },
    });

    assert.strictEqual(mockRouter.currentRoute.hash, '#/catalog?category=books&page=1');
    assert.strictEqual(mockRouter.currentRoute.path, '#/catalog');
    assert.strictEqual(mockRouter.currentRoute.query.category, 'books');
    assert.strictEqual(mockRouter.currentRoute.query.page, 1);

    const compWithMock = new AvenxComponent();
    assert.strictEqual(compWithMock.$route.path, '#/catalog');
    assert.strictEqual(compWithMock.$route.query.category, 'books');

    mockRouter.push('#/catalog?category=electronics&featured=true');
    assert.strictEqual(mockRouter.currentRoute.path, '#/catalog');
    assert.strictEqual(mockRouter.currentRoute.query.category, 'electronics');
    assert.strictEqual(mockRouter.currentRoute.query.featured, true);
    assert.strictEqual(compWithMock.$route.query.category, 'electronics');
    assert.strictEqual(compWithMock.$route.query.featured, true);

    teardownDOMMock();
    console.log('  ✅ AvenxMock.createMockRouter test passed!');

    console.log('🎉 All Route Query & Path Accessor tests passed successfully!');
  } catch (err) {
    console.error('❌ Route Query & Path Accessor test failed:', err);
    process.exit(1);
  }
})();
