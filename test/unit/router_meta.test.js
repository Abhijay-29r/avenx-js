import assert from 'assert';

import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

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
class PageProfile extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>Profile Page</div>';
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
      if (event === 'hashchange') {
        hashListeners.push(cb);
      }
    },

    removeEventListener: (event, cb) => {
      if (event === 'hashchange') {
        hashListeners = hashListeners.filter((listener) => listener !== cb);
      }
    },

    location: {
      _hash: '#/',

      get hash() {
        return this._hash;
      },

      set hash(value) {
        this._hash = value;

        for (const listener of hashListeners) {
          listener();
        }
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
function waitForRoute() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 *
 */
async function testRouteMetaIsAvailableInCurrentRoute() {
  console.log('🧪 Testing route meta in currentRoute...');

  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });

  app.registerPage('Home', PageHome);
  app.registerPage('Profile', PageProfile);

  const router = app.initRouter({
    '#/': 'Home',

    '#/profile': {
      page: 'Profile',
      meta: {
        layout: 'admin',
        requiresAuth: true,
      },
    },
  });

  await waitForRoute();

  window.location.hash = '#/profile';

  await waitForRoute();

  assert.strictEqual(
    router.currentRoute.meta.layout,
    'admin',
    'Current route meta should contain layout',
  );

  assert.strictEqual(
    router.currentRoute.meta.requiresAuth,
    true,
    'Current route meta should contain requiresAuth',
  );

  router.destroy();

  teardownWindowMock();
  teardownDOMMock();

  console.log('  ✅ Route meta in currentRoute test passed!');
}

/**
 *
 */
async function testRouteMetaIsAvailableInNavigationGuard() {
  console.log('🧪 Testing route meta in navigation guard...');

  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });

  app.registerPage('Home', PageHome);
  app.registerPage('Profile', PageProfile);

  const router = app.initRouter({
    '#/': 'Home',

    '#/profile': {
      page: 'Profile',
      meta: {
        layout: 'admin',
        requiresAuth: true,
      },
    },
  });

  let receivedToMeta = null;

  router.beforeEach((to) => {
    if (to.page === 'Profile') {
      receivedToMeta = to.meta;
    }
  });

  await waitForRoute();

  window.location.hash = '#/profile';

  await waitForRoute();
  await waitForRoute();

  assert.ok(
    receivedToMeta,
    'Navigation guard should receive meta in to',
  );

  assert.strictEqual(
    receivedToMeta.layout,
    'admin',
    'Navigation guard should receive layout meta in to',
  );

  assert.strictEqual(
    receivedToMeta.requiresAuth,
    true,
    'Navigation guard should receive requiresAuth meta in to',
  );

  router.destroy();

  teardownWindowMock();
  teardownDOMMock();

  console.log('  ✅ Route meta in navigation guard test passed!');
}

/**
 *
 */
async function testRouteMetaIsAvailableInFromNavigationGuard() {
  console.log('🧪 Testing previous route meta in navigation guard...');

  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });

  app.registerPage('Home', PageHome);
  app.registerPage('Profile', PageProfile);

  const router = app.initRouter({
    '#/': {
      page: 'Home',
      meta: {
        layout: 'public',
      },
    },

    '#/profile': {
      page: 'Profile',
      meta: {
        layout: 'admin',
      },
    },
  });

  let receivedFromMeta = null;

  router.beforeEach((to, from) => {
    if (to.page === 'Profile') {
      receivedFromMeta = from.meta;
    }
  });

  await waitForRoute();

  window.location.hash = '#/profile';

  await waitForRoute();
  await waitForRoute();

  assert.ok(
    receivedFromMeta,
    'Navigation guard should receive meta in from',
  );

  assert.strictEqual(
    receivedFromMeta.layout,
    'public',
    'Navigation guard should receive previous route meta in from',
  );

  router.destroy();

  teardownWindowMock();
  teardownDOMMock();

  console.log('  ✅ Previous route meta in navigation guard test passed!');
}

/**
 *
 */
async function testRouteWithoutMetaReturnsEmptyObject() {
  console.log('🧪 Testing route without meta...');

  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });

  app.registerPage('Home', PageHome);

  const router = app.initRouter({
    '#/': 'Home',
  });

  await waitForRoute();

  assert.strictEqual(
    typeof router.currentRoute.meta,
    'object',
    'Route meta should be an object',
  );

  assert.strictEqual(
    Object.keys(router.currentRoute.meta).length,
    0,
    'Route without meta should return an empty object',
  );

  router.destroy();

  teardownWindowMock();
  teardownDOMMock();

  console.log('  ✅ Route without meta test passed!');
}

/**
 *
 */
async function testRouteMetaCanContainDifferentValues() {
  console.log('🧪 Testing route meta can contain different values...');

  setupDOMMock();
  setupWindowMock();

  const app = new AvenxApp({ target: 'div' });

  app.registerPage('Home', PageHome);
  app.registerPage('Profile', PageProfile);

  const router = app.initRouter({
    '#/': 'Home',

    '#/profile': {
      page: 'Profile',
      meta: {
        requiresAuth: true,
        permissions: ['admin', 'editor'],
        title: 'Profile',
        layout: 'admin',
      },
    },
  });

  await waitForRoute();

  window.location.hash = '#/profile';

  await waitForRoute();

  assert.strictEqual(
    router.currentRoute.meta.requiresAuth,
    true,
    'Meta boolean value should be preserved',
  );

  assert.ok(
    Array.isArray(router.currentRoute.meta.permissions),
    'Meta array value should be preserved',
  );

  assert.strictEqual(
    router.currentRoute.meta.permissions.length,
    2,
    'Meta permissions should contain two values',
  );

  assert.strictEqual(
    router.currentRoute.meta.permissions[0],
    'admin',
    'First permission should be preserved',
  );

  assert.strictEqual(
    router.currentRoute.meta.permissions[1],
    'editor',
    'Second permission should be preserved',
  );

  assert.strictEqual(
    router.currentRoute.meta.title,
    'Profile',
    'Meta string value should be preserved',
  );

  assert.strictEqual(
    router.currentRoute.meta.layout,
    'admin',
    'Meta layout value should be preserved',
  );

  router.destroy();

  teardownWindowMock();
  teardownDOMMock();

  console.log('  ✅ Route meta values test passed!');
}

/**
 *
 */
(async () => {
  try {
    await testRouteMetaIsAvailableInCurrentRoute();
    await testRouteMetaIsAvailableInNavigationGuard();
    await testRouteMetaIsAvailableInFromNavigationGuard();
    await testRouteWithoutMetaReturnsEmptyObject();
    await testRouteMetaCanContainDifferentValues();

    console.log('🎉 All route meta tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Route meta tests failed!');
    console.error(error);

    teardownWindowMock();
    teardownDOMMock();

    process.exit(1);
  }
})();