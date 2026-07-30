import assert from 'assert';
import { AvenxGuard } from '../../lib/core/runtime/AvenxGuard.js';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

// Define mock Page classes
/**
 *
 */
class PageHome extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>Home Page</div>';
  }
}
/**
 *
 */
class PageAbout extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>About Page</div>';
  }
}
/**
 *
 */
class PageDashboard extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>Dashboard Page</div>';
  }
}
/**
 *
 */
class PageLogin extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>Login Page</div>';
  }
}
/**
 *
 */
class PageNotFound extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>404 Not Found</div>';
  }
}

let hashListeners = [];
/**
 *
 */
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

/**
 *
 */
function teardownWindowMock() {
  delete global.window;
}

/**
 *
 */
async function testRouterCoexistence() {
  console.log('🧪 Testing router coexistence and conflict prevention (non-prefix)...');

  setupDOMMock();
  setupWindowMock();

  // Create App A
  const appA = new AvenxApp({ target: 'div' });
  appA.registerPage('HomeA', PageHome);
  appA.registerPage('NotFoundA', PageNotFound);

  const routerA = appA.initRouter({
    '#/home': 'HomeA',
    '*': 'NotFoundA',
  });

  // Create App B
  const appB = new AvenxApp({ target: 'div' });
  appB.registerPage('DashboardB', PageDashboard);
  appB.registerPage('NotFoundB', PageNotFound);

  const routerB = appB.initRouter({
    '#/dashboard': 'DashboardB',
    '*': 'NotFoundB',
  });

  // Wait for the initial start() microtasks to resolve completely!
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Reset current routes to null to test the transition cleanly
  routerA.currentRoute = null;
  routerB.currentRoute = null;

  // Simulate navigation to dashboard.
  // This will trigger the hashchange listeners for both routers.
  window.location.hash = '#/dashboard';

  // Wait for promise resolution of guards/route handling
  await new Promise((resolve) => setTimeout(resolve, 0));

  // App B should mount DashboardB
  assert.strictEqual(routerB.currentRoute.page, 'DashboardB');

  // App A should NOT have its fallback NotFoundA triggered because Router B matched the route!
  assert.strictEqual(routerA.currentRoute, null, 'Router A should not have run fallback');

  routerA.destroy();
  routerB.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ Non-prefixed router coexistence tests passed!');
}

/**
 *
 */
async function testRouterPrefixes() {
  console.log('🧪 Testing router namespace prefixes...');

  setupDOMMock();
  setupWindowMock();

  // Create App A with prefix '/app1'
  const app1 = new AvenxApp({ target: 'div' });
  app1.registerPage('Home1', PageHome);
  app1.registerPage('About1', PageAbout);
  app1.registerPage('NotFound1', PageNotFound);

  const router1 = app1.initRouter(
    {
      '#/home': 'Home1',
      '#/about': 'About1',
      '*': 'NotFound1',
    },
    { prefix: '/app1' },
  );

  // Create App B with prefix '/app2'
  const app2 = new AvenxApp({ target: 'div' });
  app2.registerPage('Home2', PageHome);
  app2.registerPage('Dashboard2', PageDashboard);
  app2.registerPage('NotFound2', PageNotFound);

  const router2 = app2.initRouter(
    {
      '#/home': 'Home2',
      '#/dashboard': 'Dashboard2',
      '*': 'NotFound2',
    },
    { prefix: '/app2' },
  );

  // Wait for the initial start() microtasks to resolve completely!
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Reset current routes to null to test the transition cleanly
  router1.currentRoute = null;
  router2.currentRoute = null;

  // 1. Test hash change targeted at app1
  window.location.hash = '#/app1/home';
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Router 1 should match and strip prefix
  assert.strictEqual(router1.currentRoute.page, 'Home1');
  assert.strictEqual(router1.currentRoute.hash, '#/home');
  // Router 2 should ignore entirely
  assert.strictEqual(router2.currentRoute, null);

  // 2. Test navigate prepends prefix
  router1.navigate('#/about');
  assert.strictEqual(window.location.hash, '#/app1/about');

  router1.destroy();
  router2.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ Namespace-prefixed routing tests passed!');
}

/**
 *
 */
async function testStringGuardRedirect() {
  console.log('🧪 Testing guard string redirects...');

  setupDOMMock();
  setupWindowMock();

  class StringRedirectGuard extends AvenxGuard {
    canActivate() {
      return '#/login';
    }
  }

  const app = new AvenxApp({ target: 'div' });
  app.registerPage('Dashboard', PageDashboard);
  app.registerPage('Login', PageLogin);

  const router = app.initRouter({
    '#/dashboard': {
      page: 'Dashboard',
      guards: [StringRedirectGuard],
    },
    '#/login': 'Login',
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  router.currentRoute = null;

  window.location.hash = '#/dashboard';
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.strictEqual(window.location.hash, '#/login', 'Guard should redirect to the returned URL string');
  assert.strictEqual(router.currentRoute.page, 'Login', 'Redirect target should be mounted');
  assert.strictEqual(router.currentRoute.hash, '#/login');

  router.destroy();
  teardownWindowMock();
  teardownDOMMock();
  console.log('  ✅ Guard string redirect tests passed!');
}

(async () => {
  try {
    await testRouterCoexistence();
    await testRouterPrefixes();
    await testStringGuardRedirect();
    console.log('  ✅ Router conflict resolution tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Router conflict resolution tests failed!');
    console.error(error);
    process.exit(1);
  }
})();
