/**
 * @file routerReinitCleanup.test.js
 * @description Re-initialising the router replaces it rather than stacking one.
 *
 * `initRouter` constructed a new AvenxRouter and assigned it over the old one
 * without destroying it. AvenxRouter.destroy() existed and was correct; nothing
 * called it. The previous router therefore stayed subscribed to navigation
 * events and registered with the delegate, so:
 *
 *  - one navigation listener leaked per call, and
 *  - every abandoned router went on handling hash changes and mounting pages
 *    into the same target, so one navigation ran the route N times.
 *
 * Re-initialising is ordinary: a hot reload does it, a test that builds an app
 * per case does it, and so does an application that installs different routes
 * once a session is known.
 */

import assert from 'assert';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

class PageHome extends AvenxPage {
  render() {
    return '<div>Home</div>';
  }
}

console.log('Testing router re-initialisation cleanup...');

setupDOMMock();

/** Navigation listeners currently attached to the window. @type {number} */
let navListeners = 0;
const NAV_EVENTS = new Set(['hashchange', 'popstate']);

const realAdd = global.window.addEventListener;
const realRemove = global.window.removeEventListener;
global.window.addEventListener = function (type, ...rest) {
  if (NAV_EVENTS.has(type)) navListeners += 1;
  return realAdd ? realAdd.call(this, type, ...rest) : undefined;
};
global.window.removeEventListener = function (type, ...rest) {
  if (NAV_EVENTS.has(type)) navListeners -= 1;
  return realRemove ? realRemove.call(this, type, ...rest) : undefined;
};

try {
  const app = new AvenxApp({ target: '#app' });
  app.registerPage('Home', PageHome);

  // --- listeners do not accumulate ---------------------------------------
  {
    const first = app.initRouter({ '/': 'Home' });
    const afterOne = navListeners;
    assert.ok(afterOne >= 1, 'the first router should attach a navigation listener');

    app.initRouter({ '/': 'Home' });
    assert.strictEqual(
      navListeners,
      afterOne,
      'a second initRouter must not add a listener on top of the first router\'s',
    );

    for (let i = 0; i < 10; i += 1) {
      app.initRouter({ '/': 'Home' });
    }
    assert.strictEqual(
      navListeners,
      afterOne,
      `twelve initRouter calls must hold one router's listeners, not twelve. ` +
        `Held ${navListeners}, expected ${afterOne}.`,
    );

    void first;
    console.log('  ✅ navigation listeners do not accumulate across initRouter calls');
  }

  // --- the replaced router is the one that was destroyed ------------------
  {
    const app2 = new AvenxApp({ target: '#app' });
    app2.registerPage('Home', PageHome);

    const old = app2.initRouter({ '/': 'Home' });
    const replacement = app2.initRouter({ '/': 'Home' });

    assert.notStrictEqual(old, replacement, 'initRouter returns a new router');
    assert.strictEqual(app2.router, replacement, 'the app holds the new router');
    assert.strictEqual(
      old.unsubscribeHashChange,
      null,
      'the replaced router must have been unsubscribed',
    );
    assert.strictEqual(old.unsubscribeLinkClick, null, 'and unsubscribed from link clicks');
    console.log('  ✅ the replaced router is unsubscribed');
  }

  // --- destroy is idempotent ---------------------------------------------
  {
    const app3 = new AvenxApp({ target: '#app' });
    app3.registerPage('Home', PageHome);
    const router = app3.initRouter({ '/': 'Home' });
    const before = navListeners;

    router.destroy();
    const afterFirstDestroy = navListeners;
    router.destroy();

    assert.strictEqual(
      navListeners,
      afterFirstDestroy,
      'a second destroy() must not unsubscribe again and corrupt the count',
    );
    assert.ok(afterFirstDestroy <= before, 'destroy() releases the listener');
    console.log('  ✅ destroy() is idempotent');
  }

  // --- the surviving router still routes ---------------------------------
  {
    const app4 = new AvenxApp({ target: '#app' });
    app4.registerPage('Home', PageHome);
    app4.initRouter({ '/': 'Home' });
    const router = app4.initRouter({ '/': 'Home' });

    // Route resolution settles through a promise chain (guards may be async),
    // so the router has not recorded the route by the time initRouter returns.
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(router.currentRoute, 'the replacement router resolved the current route');
    assert.strictEqual(
      router.currentRoute.hash,
      '#/',
      'and it resolved the root -- the cleanup must not have broken routing',
    );
    assert.strictEqual(router.currentRoute.page, 'Home', 'and it reached the right page');
    console.log('  ✅ the surviving router still routes');
  }

  console.log('✅ Router re-initialisation cleanup tests passed!');
} finally {
  global.window.addEventListener = realAdd;
  global.window.removeEventListener = realRemove;
  teardownDOMMock();
}
