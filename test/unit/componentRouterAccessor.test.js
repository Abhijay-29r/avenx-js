/**
 * @file componentRouterAccessor.test.js
 * @description `this.$router` — the documented way to navigate from a component.
 *
 * The routing guide documents `this.$router.navigate(hash)` and, in a section
 * of its own, `this.$router.back()`, `.forward()` and `.go(delta)`: "These are
 * available on the router instance and, inside components, via `this.$router`."
 * The routing tutorial documents the same accessor for programmatic navigation.
 *
 * Nothing in the runtime ever defined `$router`. Six documented examples across
 * two guides threw `Cannot read properties of undefined (reading 'navigate')`,
 * and the router was only reachable as `this.$app.router`, which no document
 * mentions. Following the tutorial produced a login button that logged an
 * AVX_R09 and went nowhere.
 */

import assert from 'assert';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { AvenxComponent } from '../../lib/core/runtime/AvenxComponent.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

class HomePage extends AvenxPage {
  render() {
    return '<div>Home</div>';
  }
}

console.log('Testing this.$router...');

setupDOMMock();

try {
  // --- a component reaches its application's router ----------------------
  {
    const app = new AvenxApp({ target: '#app' });
    app.registerPage('Home', HomePage);
    const router = app.initRouter({ '/': 'Home' });

    const component = new AvenxComponent({}, {}, {}, '<div></div>', {}, new Map(), {}, {}, {});
    component.$app = app;

    assert.strictEqual(component.$router, router, 'a component must reach the app router');
    assert.strictEqual(
      typeof component.$router.navigate,
      'function',
      'navigate() is what the tutorial calls',
    );
    for (const method of ['back', 'forward', 'go']) {
      assert.strictEqual(
        typeof component.$router[method],
        'function',
        `the routing guide documents $router.${method}()`,
      );
    }
    router.destroy();
    console.log('  ✅ a component reaches its application router through $router');
  }

  // --- an application with no router reports null ------------------------
  {
    const app = new AvenxApp({ target: '#app' });
    const component = new AvenxComponent({}, {}, {}, '<div></div>', {}, new Map(), {}, {}, {});
    component.$app = app;

    assert.strictEqual(
      component.$router,
      null,
      'an application that never called initRouter has no router, and null says so ' +
        'rather than throwing on property access',
    );
    console.log('  ✅ an application with no router reports null');
  }

  // --- navigating through the accessor actually routes -------------------
  {
    const app = new AvenxApp({ target: '#app' });
    app.registerPage('Home', HomePage);
    const router = app.initRouter({ '/': 'Home', '/other': 'Home' });

    const component = new AvenxComponent({}, {}, {}, '<div></div>', {}, new Map(), {}, {}, {});
    component.$app = app;

    component.$router.navigate('#/other');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(
      String(global.window.location.hash).includes('/other'),
      `navigate() through $router must change the route, got ${global.window.location.hash}`,
    );
    router.destroy();
    console.log('  ✅ navigating through $router changes the route');
  }

  // --- a component with no $app falls back to the active router ----------
  {
    const app = new AvenxApp({ target: '#app' });
    app.registerPage('Home', HomePage);
    const router = app.initRouter({ '/': 'Home' });

    const orphan = new AvenxComponent({}, {}, {}, '<div></div>', {}, new Map(), {}, {}, {});
    assert.strictEqual(
      orphan.$router,
      router,
      'a component mounted without $app still has a router to talk to',
    );
    router.destroy();
    console.log('  ✅ a component without $app falls back to the active router');
  }

  console.log('✅ $router accessor tests passed!');
} finally {
  teardownDOMMock();
}
