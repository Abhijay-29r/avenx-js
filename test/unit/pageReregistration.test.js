/**
 * @file pageReregistration.test.js
 * @description AVX_W07 fires on a real overwrite, not on registering the same page twice.
 *
 * The compiler auto-registers every page under `src/pages`, and an application
 * may also register a page by hand. The routing tutorial tells the reader to do
 * exactly that -- import each page and call `app.registerPage(...)` -- so
 * following it produced four console warnings on every page load, each claiming
 * `Page "X" is already registered and will be overwritten`.
 *
 * Nothing was overwritten. `pages.set(name, sameClass)` leaves the registry
 * exactly as it was. A warning that fires on the documented path and describes
 * something that did not happen teaches a developer to ignore the console,
 * which is where every runtime diagnostic has to land.
 *
 * A genuinely different class under the same name is still a real collision and
 * must still be reported.
 */

import assert from 'assert';
import { AvenxApp } from '../../lib/core/runtime/AvenxApp.js';
import { AvenxPage } from '../../lib/core/runtime/AvenxPage.js';
import { setupDOMMock, teardownDOMMock } from '../helpers/dom-mock.js';

class HomePage extends AvenxPage {
  render() {
    return '<div>Home</div>';
  }
}

class OtherPage extends AvenxPage {
  render() {
    return '<div>Other</div>';
  }
}

console.log('Testing page re-registration...');

setupDOMMock();

/**
 * Captures warnings raised while `run` executes.
 * @param {Function} run - The code under test.
 * @returns {string[]} The warning messages.
 */
function warningsFrom(run) {
  const messages = [];
  const original = console.warn;
  console.warn = (...args) => messages.push(args.map(String).join(' '));
  try {
    run();
  } finally {
    console.warn = original;
  }
  return messages.filter((message) => message.includes('AVX_W07'));
}

try {
  // --- the same class twice is not an overwrite --------------------------
  {
    const app = new AvenxApp({ target: '#app' });
    const warnings = warningsFrom(() => {
      app.registerPage('Home', HomePage);
      app.registerPage('Home', HomePage);
    });
    assert.deepStrictEqual(
      warnings,
      [],
      `registering the identical class twice overwrites nothing:\n${warnings.join('\n')}`,
    );
    assert.strictEqual(app.pages.get('Home'), HomePage, 'and the registry is unchanged');
    console.log('  ✅ registering the same page class twice is silent');
  }

  // --- a different class under the same name still warns -----------------
  {
    const app = new AvenxApp({ target: '#app' });
    const warnings = warningsFrom(() => {
      app.registerPage('Home', HomePage);
      app.registerPage('Home', OtherPage);
    });
    assert.strictEqual(warnings.length, 1, 'a real collision must still be reported');
    assert.ok(/Home/.test(warnings[0]), 'and must name the page');
    assert.strictEqual(app.pages.get('Home'), OtherPage, 'the last registration wins, as before');
    console.log('  ✅ a different class under the same name still warns');
  }

  // --- many repeats of the same class stay silent ------------------------
  {
    const app = new AvenxApp({ target: '#app' });
    const warnings = warningsFrom(() => {
      for (let i = 0; i < 5; i += 1) app.registerPage('Home', HomePage);
    });
    assert.deepStrictEqual(warnings, [], 'repeated identical registration stays silent');
    console.log('  ✅ repeated identical registration stays silent');
  }

  // --- unrelated names are unaffected ------------------------------------
  {
    const app = new AvenxApp({ target: '#app' });
    const warnings = warningsFrom(() => {
      app.registerPage('Home', HomePage);
      app.registerPage('Other', OtherPage);
    });
    assert.deepStrictEqual(warnings, [], 'two different pages are not a collision');
    assert.strictEqual(app.pages.size, 2, 'both are registered');
    console.log('  ✅ two distinct pages register cleanly');
  }

  console.log('✅ Page re-registration tests passed!');
} finally {
  teardownDOMMock();
}
