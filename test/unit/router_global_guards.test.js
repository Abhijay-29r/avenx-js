import assert from 'assert';
import { AvenxGuard } from '../../lib/core/runtime/AvenxGuard.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

class PageHome extends AvenxPage {
  render() {
    return '<div>Home Page</div>';
  }
}

class PageDashboard extends AvenxPage {
  render() {
    return '<div>Dashboard Page</div>';
  }
}

class PageLogin extends AvenxPage {
  render() {
    return '<div>Login Page</div>';
  }
}

class PageAdmin extends AvenxPage {
  render() {
    return '<div>Admin Page</div>';
  }
}

let hashListeners = [];
function setupWindowMock() {
  hashListeners = [];
  global.window = {
    addEventListener: (event, cb) => {
      if (event === 'hashchange') hashListeners.push(cb);
    },
    removeEventListener: (event, cb) => {
      if (event === 'hashchange') hashListeners = hashListeners.filter((l) => l !== cb);
    },
    location: {
      _hash: '',
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

async function testBeforeEachExecutionOrder() {
  console.log('🧪 Testing beforeEach execution order before route guards...');
  setupDOMMock();
  setupWindowMock();

  const executionLog = [];

  class RouteGuard extends AvenxGuard {
    canActivate() {
      executionLog.push('routeGuard');
      return true;
    }
  }

  window.location.hash = '#/home';

  const app = new AvenxApp({ target: 'div' });
  app.registerPage('Home', PageHome);
  app.registerPage('Dashboard', PageDashboard);

  const router = app.initRouter({
    '#/home': 'Home',
    '#/dashboard': {
      page: 'Dashboard',
      guards: [RouteGuard],
    },
  });

  router.beforeEach((to, from) => {
    executionLog.push('globalBefore1');
    return true;
  });

  router.beforeEach((to, from) => {
    executionLog.push('globalBefore2');
    return true;
  });

  await new Promise((r) => setTimeout(r, 0));
  executionLog.length = 0; // reset initial load log

  window.location.hash = '#/dashboard';
  await new Promise((r) => setTimeout(r, 0));

  assert.deepStrictEqual(executionLog, ['globalBefore1', 'globalBefore2', 'routeGuard']);
  assert.strictEqual(router.currentRoute.page, 'Dashboard');

  router.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ beforeEach execution order test passed!');
}

async function testBeforeEachHaltAndRedirect() {
  console.log('🧪 Testing beforeEach halt (cancel) and redirect...');
  setupDOMMock();
  setupWindowMock();

  window.location.hash = '#/home';

  const app = new AvenxApp({ target: 'div' });
  app.registerPage('Home', PageHome);
  app.registerPage('Login', PageLogin);
  app.registerPage('Admin', PageAdmin);

  let isAuthenticated = false;

  const router = app.initRouter({
    '#/home': 'Home',
    '#/login': 'Login',
    '#/admin': 'Admin',
  });

  // Global auth check: redirect unauthenticated users away from /admin
  router.beforeEach((to, from) => {
    if (to.page === 'Admin' && !isAuthenticated) {
      return '#/login';
    }
    return true;
  });

  await new Promise((r) => setTimeout(r, 0));

  // Try to access /admin
  window.location.hash = '#/admin';
  await new Promise((r) => setTimeout(r, 0));

  assert.strictEqual(window.location.hash, '#/login', 'Should redirect to /login');
  assert.strictEqual(router.currentRoute.page, 'Login');

  // Test halt/cancel
  let blockAll = false;
  router.beforeEach((to, from) => {
    if (blockAll) return false;
    return true;
  });

  blockAll = true;
  window.location.hash = '#/home';
  await new Promise((r) => setTimeout(r, 0));

  // Should stay on /login
  assert.strictEqual(router.currentRoute.page, 'Login');

  router.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ beforeEach halt and redirect test passed!');
}

async function testAsyncBeforeEach() {
  console.log('🧪 Testing async beforeEach hooks...');
  setupDOMMock();
  setupWindowMock();

  window.location.hash = '#/home';

  const app = new AvenxApp({ target: 'div' });
  app.registerPage('Home', PageHome);
  app.registerPage('Dashboard', PageDashboard);

  const router = app.initRouter({
    '#/home': 'Home',
    '#/dashboard': 'Dashboard',
  });

  let asyncChecked = false;
  router.beforeEach(async (to, from) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    asyncChecked = true;
    return true;
  });

  await new Promise((r) => setTimeout(r, 0));

  window.location.hash = '#/dashboard';
  await new Promise((r) => setTimeout(r, 50));

  assert.strictEqual(asyncChecked, true);
  assert.strictEqual(router.currentRoute.page, 'Dashboard');

  router.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ Async beforeEach test passed!');
}

async function testAfterEachAndUnregister() {
  console.log('🧪 Testing afterEach hooks and unregistration...');
  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });
  app.registerPage('Home', PageHome);
  app.registerPage('Dashboard', PageDashboard);

  window.location.hash = '#/home';

  const router = app.initRouter({
    '#/home': 'Home',
    '#/dashboard': 'Dashboard',
  });

  await new Promise((r) => setTimeout(r, 10));

  const afterLog = [];
  const unsubAfter = router.afterEach((to, from) => {
    afterLog.push({ toHash: to.hash, fromHash: from ? from.hash : null });
  });

  const beforeLog = [];
  const unsubBefore = router.beforeEach((to, from) => {
    beforeLog.push(to.hash);
    return true;
  });

  await new Promise((r) => setTimeout(r, 0));

  window.location.hash = '#/dashboard';
  await new Promise((r) => setTimeout(r, 0));

  assert.strictEqual(afterLog.length, 1);
  assert.strictEqual(afterLog[0].toHash, '#/dashboard');
  assert.strictEqual(afterLog[0].fromHash, '#/home');
  assert.strictEqual(beforeLog.length, 1);
  assert.strictEqual(beforeLog[0], '#/dashboard');

  // Test unregistration
  unsubAfter();
  unsubBefore();

  window.location.hash = '#/home';
  await new Promise((r) => setTimeout(r, 0));

  assert.strictEqual(afterLog.length, 1, 'afterEach hook should not run after unregistering');
  assert.strictEqual(beforeLog.length, 1, 'beforeEach hook should not run after unregistering');

  router.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ afterEach and unregister test passed!');
}

(async () => {
  try {
    await testBeforeEachExecutionOrder();
    await testBeforeEachHaltAndRedirect();
    await testAsyncBeforeEach();
    await testAfterEachAndUnregister();
    console.log('🎉 All router global guard hook tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Router global guard hook tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
