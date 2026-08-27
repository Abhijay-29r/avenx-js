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

/**
 *
 */
class PageUser extends AvenxPage {
  /**
   *
   */
  render() {
    return '<div>User Page</div>';
  }
}

let hashListeners = [];
let replaceCalls = [];
let hashSetCalls = [];

/**
 *
 */
function setupWindowMock() {
  hashListeners = [];
  replaceCalls = [];
  hashSetCalls = [];

  const applyHash = (value) => {
    // Apply the new hash and call all the listeners
    window.location._hash = value;
    hashListeners.forEach((listener) => listener());
  };

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
        // Store the normal hash changes for testing
        hashSetCalls.push(value);
        applyHash(value);
      },

      replace(value) {
        // Store the replace calls for testing
        replaceCalls.push(value);
        applyHash(value);
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
  // Wait for the router to complete the route change
  return new Promise((resolve) => setTimeout(resolve, 0));
}

(async () => {
  try {
    console.log('🧪 Testing route-level redirects...');

    setupDOMMock();
    setupWindowMock();

    /*
     * 1. Testing static redirect
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);
      app.registerPage('Profile', PageProfile);

      const router = app.initRouter({
        '#/': 'Home',
        '#/old-home': {
          redirect: '#/profile',
        },
        '#/profile': 'Profile',
      });

      await waitForRoute();

      window.location.hash = '#/old-home';
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(window.location.hash, '#/profile', 'Static redirect should navigate to the target route');

      assert.strictEqual(
        router.currentRoute.page,
        'Profile',
        'Destination page should be mounted after static redirect',
      );

      router.destroy();
    }

    /*
     * 2. Testing dynamic redirect with params
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);
      app.registerPage('User', PageUser);

      const router = app.initRouter({
        '#/': 'Home',
        '#/old-user/:id': {
          redirect: (params) => `#/user/${params.id}`,
        },
        '#/user/:id': 'User',
      });

      await waitForRoute();

      window.location.hash = '#/old-user/123';
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(
        window.location.hash,
        '#/user/123',
        'Dynamic redirect should build the target using route params',
      );

      assert.strictEqual(router.currentRoute.page, 'User', 'Dynamic redirect should mount the destination page');

      assert.strictEqual(
        router.currentRoute.params.id,
        '123',
        'Destination route should receive the correct parameter',
      );

      router.destroy();
    }

    /*
     * 3. Testing async redirect
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);
      app.registerPage('Profile', PageProfile);

      const router = app.initRouter({
        '#/': 'Home',
        '#/async-old': {
          redirect: async () => {
            await Promise.resolve();
            return '#/profile';
          },
        },
        '#/profile': 'Profile',
      });

      await waitForRoute();

      window.location.hash = '#/async-old';
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(
        window.location.hash,
        '#/profile',
        'Async redirect should navigate after the Promise resolves',
      );

      assert.strictEqual(router.currentRoute.page, 'Profile', 'Async redirect should mount the destination page');

      router.destroy();
    }

    /*
     * 4. Testing redirect with replace navigation
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);
      app.registerPage('Profile', PageProfile);

      const router = app.initRouter({
        '#/': 'Home',
        '#/old-home': {
          redirect: '#/profile',
        },
        '#/profile': 'Profile',
      });

      await waitForRoute();

      // Clear the old calls before testing the redirect
      replaceCalls = [];
      hashSetCalls = [];

      window.location.hash = '#/old-home';
      await waitForRoute();
      await waitForRoute();

      assert.ok(replaceCalls.includes('#/profile'), 'Route-level redirect should use replace navigation');

      router.destroy();
    }

    /*
     * 5. Testing redirect chain
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);

      const router = app.initRouter({
        '#/': 'Home',
        '#/a': {
          redirect: '#/b',
        },
        '#/b': {
          redirect: '#/c',
        },
        '#/c': 'Home',
      });

      await waitForRoute();

      window.location.hash = '#/a';
      await waitForRoute();
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(window.location.hash, '#/c', 'Redirect chain should reach the final destination');

      assert.strictEqual(router.currentRoute.page, 'Home', 'Final route in a redirect chain should be mounted');

      router.destroy();
    }

    /*
     * 6. Testing redirect loop
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);

      const router = app.initRouter({
        '#/': 'Home',
        '#/a': {
          redirect: '#/b',
        },
        '#/b': {
          redirect: '#/a',
        },
      });

      await waitForRoute();

      window.location.hash = '#/a';
      await waitForRoute();
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(window.location.hash, '#/b', 'Router should stop before navigating to already visited route');

      assert.strictEqual(router.redirectContext, null, 'Redirect context should be cleared after detecting a loop');

      router.destroy();
    }

    /*
     * 7. Testing maximum redirect limit
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);

      const router = app.initRouter({
        '#/': 'Home',
        '#/a': { redirect: '#/b' },
        '#/b': { redirect: '#/c' },
        '#/c': { redirect: '#/d' },
        '#/d': { redirect: '#/e' },
        '#/e': { redirect: '#/f' },
        '#/f': { redirect: '#/g' },
        '#/g': { redirect: '#/h' },
        '#/h': { redirect: '#/i' },
        '#/i': { redirect: '#/j' },
        '#/j': { redirect: '#/k' },
        '#/k': { redirect: '#/l' },
        '#/l': 'Home',
      });

      await waitForRoute();

      window.location.hash = '#/a';

      for (let index = 0; index < 12; index++) {
        await waitForRoute();
      }

      assert.strictEqual(
        window.location.hash,
        '#/k',
        'Redirect chain should stop when the maximum redirect limit is reached',
      );

      assert.strictEqual(
        router.redirectContext,
        null,
        'Redirect context should be cleared after reaching the maximum limit',
      );

      router.destroy();
    }

    /*
     * 8. Testing redirect context reset
     */
    {
      const app = new AvenxApp({ target: 'div' });

      app.registerPage('Home', PageHome);
      app.registerPage('Profile', PageProfile);

      const router = app.initRouter({
        '#/': 'Home',
        '#/old-home': {
          redirect: '#/profile',
        },
        '#/profile': 'Profile',
      });

      await waitForRoute();

      window.location.hash = '#/old-home';
      await waitForRoute();
      await waitForRoute();

      assert.strictEqual(router.redirectContext, null, 'Redirect context should reset after reaching a normal route');

      router.destroy();
    }

    teardownWindowMock();
    teardownDOMMock();

    console.log('  ✅ All route-level redirect tests passed!');
  } catch (error) {
    console.error('❌ Route-level redirect tests failed!');
    console.error(error);

    teardownWindowMock();
    teardownDOMMock();

    process.exit(1);
  }
})();
