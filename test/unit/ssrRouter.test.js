import assert from 'assert';
import { AvenxRouter } from '../../lib/core/runtime/AvenxRouter.js';
import { RouteMatcher } from '../../lib/core/runtime/RouteMatcher.js';
import {
  MemoryNavigationDelegate,
  createNavigationDelegate,
} from '../../lib/core/runtime/navigation/index.js';

/**
 * Unit tests for SSR / Node.js headless router execution.
 */
async function runTests() {
  console.log('🧪 Testing Router SSR and MemoryNavigationDelegate in Node.js...');

  // 1. Test createNavigationDelegate with mode 'memory'
  const memoryDelegate = createNavigationDelegate({ mode: 'memory' });
  assert.ok(
    memoryDelegate instanceof MemoryNavigationDelegate,
    'Delegate with mode memory should be MemoryNavigationDelegate',
  );

  // 2. Test MemoryNavigationDelegate state & callbacks
  const delegate = new MemoryNavigationDelegate('#/initial');
  assert.strictEqual(delegate.getHash(), '#/initial');

  let changeCount = 0;
  let lastHash = '';
  const unsubscribe = delegate.onHashChange((h) => {
    changeCount++;
    lastHash = h;
  });

  delegate.setHash('#/dashboard');
  assert.strictEqual(delegate.getHash(), '#/dashboard');
  assert.strictEqual(changeCount, 1);
  assert.strictEqual(lastHash, '#/dashboard');

  delegate.setTitle('Dashboard Page');
  assert.strictEqual(delegate.title, 'Dashboard Page');

  unsubscribe();
  delegate.setHash('#/profile');
  assert.strictEqual(changeCount, 1, 'Callback should not fire after unsubscribe');

  // 3. Test RouteMatcher pure matching
  const routes = {
    '#/user/:id': 'UserPage',
    '#/search': 'SearchPage',
    '*': 'NotFoundPage',
  };

  assert.strictEqual(RouteMatcher.matches(routes, '#/user/42'), true);
  assert.strictEqual(RouteMatcher.matches(routes, '#/unknown'), false);

  const match1 = RouteMatcher.matchRoute(routes, '#/user/123?tab=settings');
  assert.ok(match1.matchedRoute);
  assert.strictEqual(match1.matchedRoute.definition, 'UserPage');
  assert.strictEqual(match1.params.id, '123');
  assert.strictEqual(match1.params.query.tab, 'settings');

  // 4. Test AvenxRouter running cleanly in Node.js without global window or document
  const mockApp = {
    mountedPage: null,
    mountedParams: null,
    mountPage(pageName, params) {
      this.mountedPage = pageName;
      this.mountedParams = params;
    },
  };

  const router = new AvenxRouter(
    mockApp,
    {
      '#/home': 'HomePage',
      '#/product/:id': 'ProductPage',
      '*': 'NotFoundPage',
    },
    { initialHash: '#/product/99', mode: 'memory' },
  );

  assert.ok(router.delegate instanceof MemoryNavigationDelegate);

  router.start();
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(mockApp.mountedPage, 'ProductPage');
  assert.strictEqual(mockApp.mountedParams.id, '99');

  router.navigate('#/home');
  await new Promise((r) => setTimeout(r, 10));

  assert.strictEqual(mockApp.mountedPage, 'HomePage');

  // 5. Test MemoryNavigationDelegate history stack, cursor, back, forward, go, truncation, and replace
  const historyDelegate = new MemoryNavigationDelegate('#/step1');
  assert.deepStrictEqual(historyDelegate.history, ['#/step1']);
  assert.strictEqual(historyDelegate.cursorIndex, 0);
  assert.strictEqual(historyDelegate.getHash(), '#/step1');

  const historyEvents = [];
  historyDelegate.onHashChange((h) => historyEvents.push(h));

  historyDelegate.setHash('#/step2');
  historyDelegate.setHash('#/step3');
  assert.deepStrictEqual(historyDelegate.history, ['#/step1', '#/step2', '#/step3']);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  assert.strictEqual(historyDelegate.getHash(), '#/step3');

  // Step back to step2
  historyDelegate.back();
  assert.strictEqual(historyDelegate.cursorIndex, 1);
  assert.strictEqual(historyDelegate.getHash(), '#/step2');
  assert.strictEqual(historyEvents[historyEvents.length - 1], '#/step2');

  // Step back to step1
  historyDelegate.back();
  assert.strictEqual(historyDelegate.cursorIndex, 0);
  assert.strictEqual(historyDelegate.getHash(), '#/step1');

  // Step back beyond bounds (should be a no-op)
  const prevCount = historyEvents.length;
  historyDelegate.back();
  assert.strictEqual(historyDelegate.cursorIndex, 0);
  assert.strictEqual(historyEvents.length, prevCount);

  // Step forward to step2
  historyDelegate.forward();
  assert.strictEqual(historyDelegate.cursorIndex, 1);
  assert.strictEqual(historyDelegate.getHash(), '#/step2');

  // Step forward to step3
  historyDelegate.forward();
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  assert.strictEqual(historyDelegate.getHash(), '#/step3');

  // Step forward beyond bounds (should be a no-op)
  historyDelegate.forward();
  assert.strictEqual(historyDelegate.cursorIndex, 2);

  // Go delta relative navigation
  historyDelegate.go(-2);
  assert.strictEqual(historyDelegate.cursorIndex, 0);
  assert.strictEqual(historyDelegate.getHash(), '#/step1');

  historyDelegate.go(2);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  assert.strictEqual(historyDelegate.getHash(), '#/step3');

  // Invalid go arguments / out-of-bounds go
  historyDelegate.go(0);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  historyDelegate.go(10);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  historyDelegate.go(-10);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  historyDelegate.go(null);
  assert.strictEqual(historyDelegate.cursorIndex, 2);

  // Forward history truncation: move back then push new route
  historyDelegate.go(-1); // now at step2 (index 1)
  assert.strictEqual(historyDelegate.cursorIndex, 1);
  historyDelegate.setHash('#/step2-alternative');
  assert.deepStrictEqual(historyDelegate.history, ['#/step1', '#/step2', '#/step2-alternative']);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  assert.strictEqual(historyDelegate.getHash(), '#/step2-alternative');

  // Replace current history entry
  historyDelegate.setHash('#/step2-replaced', { replace: true });
  assert.deepStrictEqual(historyDelegate.history, ['#/step1', '#/step2', '#/step2-replaced']);
  assert.strictEqual(historyDelegate.cursorIndex, 2);
  assert.strictEqual(historyDelegate.getHash(), '#/step2-replaced');

  // 6. Test AvenxRouter programmatic history methods (back, forward, go) in SSR memory mode
  const ssrApp = {
    mountedPage: null,
    mountPage(pageName) {
      this.mountedPage = pageName;
    },
  };

  const ssrRouter = new AvenxRouter(
    ssrApp,
    {
      '#/alpha': 'PageAlpha',
      '#/beta': 'PageBeta',
      '#/gamma': 'PageGamma',
    },
    { initialHash: '#/alpha', mode: 'memory' },
  );

  ssrRouter.start();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageAlpha');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageAlpha');

  ssrRouter.navigate('#/beta');
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageBeta');

  ssrRouter.navigate('#/gamma');
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageGamma');

  // Router back
  ssrRouter.back();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageBeta');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageBeta');

  ssrRouter.back();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageAlpha');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageAlpha');

  // Router forward
  ssrRouter.forward();
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageBeta');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageBeta');

  // Router go(1)
  ssrRouter.go(1);
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageGamma');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageGamma');

  // Router go(-2)
  ssrRouter.go(-2);
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(ssrApp.mountedPage, 'PageAlpha');
  assert.strictEqual(ssrRouter.currentRoute.page, 'PageAlpha');

  ssrRouter.destroy();

  console.log('  ✅ Router SSR and MemoryNavigationDelegate tests passed!');
}

try {
  await runTests();
} catch (error) {
  console.error('❌ Router SSR and MemoryNavigationDelegate tests failed!');
  console.error(error);
  process.exit(1);
}
