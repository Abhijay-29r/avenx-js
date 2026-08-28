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
    return '<div>Home</div>';
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
    return '<div>About</div>';
  }
}

let hashListeners = [];
let rafQueue = [];
let scrollCalls = [];
let scrollX = 0;
let scrollY = 0;

/**
 *
 */
function flushRaf(times = 2) {
  for (let i = 0; i < times; i++) {
    const queue = rafQueue.splice(0);
    queue.forEach((cb) => cb());
  }
}

/**
 *
 */
function setupWindowMock() {
  hashListeners = [];
  rafQueue = [];
  scrollCalls = [];
  scrollX = 0;
  scrollY = 0;

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
    get scrollX() {
      return scrollX;
    },
    get scrollY() {
      return scrollY;
    },
    scrollTo(x, y) {
      scrollCalls.push({ x, y });
      scrollX = x;
      scrollY = y;
    },
    requestAnimationFrame(cb) {
      rafQueue.push(cb);
      return rafQueue.length;
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
 * Wait for guard promise microtasks to settle.
 */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  try {
    console.log('🧪 Testing router scrollRestoration...');

    setupDOMMock();

    // --- default 'top' ---
    setupWindowMock();
    scrollX = 40;
    scrollY = 120;

    {
      const app = new AvenxApp({ target: 'div' });
      app.registerPage('Home', PageHome);
      app.registerPage('About', PageAbout);
      const router = app.initRouter({
        '#/': 'Home',
        '#/about': 'About',
      });

      await settle();
      flushRaf();
      assert.ok(scrollCalls.length >= 1, 'default mode should scroll after initial navigation');
      const lastTop = scrollCalls[scrollCalls.length - 1];
      assert.deepStrictEqual(lastTop, { x: 0, y: 0 }, "default scrollRestoration should be 'top'");

      scrollCalls = [];
      scrollX = 80;
      scrollY = 200;
      window.location.hash = '#/about';
      await settle();
      flushRaf();
      assert.deepStrictEqual(scrollCalls[scrollCalls.length - 1], { x: 0, y: 0 }, "'top' scrolls to origin on navigate");

      router.destroy();
    }
    teardownWindowMock();

    // --- 'manual' ---
    setupWindowMock();
    scrollX = 10;
    scrollY = 20;
    {
      const app = new AvenxApp({ target: 'div' });
      app.registerPage('Home', PageHome);
      app.registerPage('About', PageAbout);
      const router = app.initRouter(
        {
          '#/': 'Home',
          '#/about': 'About',
        },
        { scrollRestoration: 'manual' },
      );

      await settle();
      flushRaf();
      assert.strictEqual(scrollCalls.length, 0, "'manual' must not call scrollTo");

      window.location.hash = '#/about';
      await settle();
      flushRaf();
      assert.strictEqual(scrollCalls.length, 0, "'manual' must not scroll on subsequent navigation");

      router.destroy();
    }
    teardownWindowMock();

    // --- 'auto' save + restore ---
    setupWindowMock();
    {
      const app = new AvenxApp({ target: 'div' });
      app.registerPage('Home', PageHome);
      app.registerPage('About', PageAbout);
      const router = app.initRouter(
        {
          '#/': 'Home',
          '#/about': 'About',
        },
        { scrollRestoration: 'auto' },
      );

      await settle();
      flushRaf();
      // First visit to home has no saved position → scroll to top
      assert.deepStrictEqual(scrollCalls[scrollCalls.length - 1], { x: 0, y: 0 });

      scrollCalls = [];
      scrollX = 15;
      scrollY = 250;
      window.location.hash = '#/about';
      await settle();
      flushRaf();
      // Leaving home should save (15,250); about has no saved → top
      assert.deepStrictEqual(scrollCalls[scrollCalls.length - 1], { x: 0, y: 0 });

      scrollCalls = [];
      scrollX = 5;
      scrollY = 5;
      window.location.hash = '#/';
      await settle();
      flushRaf();
      assert.deepStrictEqual(
        scrollCalls[scrollCalls.length - 1],
        { x: 15, y: 250 },
        "'auto' should restore saved scroll for returning to home",
      );

      router.destroy();
    }
    teardownWindowMock();

    // --- missing scrollTo is a no-op ---
    setupWindowMock();
    delete global.window.scrollTo;
    {
      const app = new AvenxApp({ target: 'div' });
      app.registerPage('Home', PageHome);
      const router = app.initRouter({ '#/': 'Home' }, { scrollRestoration: 'top' });
      await settle();
      flushRaf();
      assert.strictEqual(scrollCalls.length, 0, 'missing scrollTo must be guarded');
      router.destroy();
    }
    teardownWindowMock();

    teardownDOMMock();
    console.log('✅ All router scrollRestoration tests passed!');
  } catch (error) {
    console.error('❌ Router scrollRestoration tests failed!');
    console.error(error);
    teardownWindowMock();
    teardownDOMMock();
    process.exit(1);
  }
})();
