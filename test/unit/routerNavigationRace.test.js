import assert from 'assert';
import { AvenxRouter } from '../../lib/core/runtime/AvenxRouter.js';

/**
 * Regression coverage for the router committing every navigation whose guards
 * resolved, with no check that it was still the current one. Route guards may
 * be asynchronous, so navigating A -> B -> C while B's guard was in flight left
 * two pending promises and whichever resolved last won — a guard belonging to
 * an abandoned route could mount its page over the route the user asked for,
 * leaving currentRoute disagreeing with the address bar.
 */

/**
 * Creates a minimal app stub that records the pages it is asked to mount.
 * @returns {{mountPage: Function, mounted: string[]}}
 */
function createAppStub() {
  const mounted = [];
  return {
    mounted,
    /**
     * @param {string} pageName - Name of the page being mounted.
     */
    mountPage(pageName) {
      mounted.push(pageName);
    },
  };
}

/**
 * Builds a guard that resolves after a given delay.
 * @param {number} delay - Milliseconds to wait before allowing the route.
 * @returns {Function} A guard function.
 */
function slowGuard(delay) {
  return () =>
    new Promise((resolve) => {
      setTimeout(() => resolve(true), delay);
    });
}

/**
 * Waits for a number of milliseconds.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A slow guard for an abandoned route must not mount its page.
 */
async function testStaleNavigationDoesNotCommit() {
  console.log('🧪 Testing a superseded navigation does not commit...');

  const app = createAppStub();
  const router = new AvenxRouter(
    app,
    {
      '#/slow': { page: 'SlowPage', guards: [slowGuard(60)] },
      '#/fast': { page: 'FastPage', guards: [slowGuard(5)] },
    },
    { mode: 'memory' },
  );

  try {
    router.navigate('#/slow');
    await wait(10);
    router.navigate('#/fast');

    await wait(150);

    assert.deepStrictEqual(app.mounted, ['FastPage'], `unexpected mounts: ${app.mounted.join(', ')}`);
    assert.strictEqual(router.currentRoute.page, 'FastPage', 'currentRoute should reflect the last navigation');
    assert.strictEqual(router.currentRoute.hash, '#/fast', 'currentRoute hash should match the last navigation');
  } finally {
    router.delegate.destroy();
  }

  console.log('  ✅ Superseded navigation discarded.');
}

/**
 * The out-of-order case: the abandoned route's guard resolves last.
 */
async function testOutOfOrderResolutionKeepsLatestRoute() {
  console.log('🧪 Testing out-of-order guard resolution keeps the latest route...');

  const app = createAppStub();
  const router = new AvenxRouter(
    app,
    {
      '#/a': { page: 'PageA', guards: [slowGuard(80)] },
      '#/b': { page: 'PageB', guards: [slowGuard(60)] },
      '#/c': { page: 'PageC', guards: [slowGuard(5)] },
    },
    { mode: 'memory' },
  );

  try {
    router.navigate('#/a');
    await wait(5);
    router.navigate('#/b');
    await wait(5);
    router.navigate('#/c');

    await wait(200);

    assert.deepStrictEqual(app.mounted, ['PageC'], `only the final route should mount, got: ${app.mounted.join(', ')}`);
    assert.strictEqual(router.currentRoute.page, 'PageC');
  } finally {
    router.delegate.destroy();
  }

  console.log('  ✅ Latest route wins regardless of resolution order.');
}

/**
 * A rejected guard from an abandoned route must not roll back the current one.
 */
async function testStaleGuardRejectionIsIgnored() {
  console.log('🧪 Testing a stale guard rejection does not disturb the current route...');

  const app = createAppStub();
  const router = new AvenxRouter(
    app,
    {
      '#/boom': {
        page: 'BoomPage',
        guards: [
          () =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('guard failed')), 60);
            }),
        ],
      },
      '#/safe': { page: 'SafePage', guards: [] },
    },
    { mode: 'memory' },
  );

  try {
    router.navigate('#/boom');
    await wait(10);
    router.navigate('#/safe');

    await wait(150);

    assert.deepStrictEqual(app.mounted, ['SafePage'], `unexpected mounts: ${app.mounted.join(', ')}`);
    assert.strictEqual(router.currentRoute.page, 'SafePage', 'the stale rejection must not revert the route');
    assert.strictEqual(router.delegate.getHash(), '#/safe', 'the stale rejection must not rewrite the hash');
  } finally {
    router.delegate.destroy();
  }

  console.log('  ✅ Stale guard rejection ignored.');
}

/**
 * Ordinary sequential navigation must be unaffected.
 */
async function testSequentialNavigationStillWorks() {
  console.log('🧪 Testing sequential navigation is unaffected...');

  const app = createAppStub();
  const router = new AvenxRouter(
    app,
    {
      '#/one': { page: 'PageOne', guards: [slowGuard(5)] },
      '#/two': { page: 'PageTwo', guards: [slowGuard(5)] },
    },
    { mode: 'memory' },
  );

  try {
    router.navigate('#/one');
    await wait(60);
    router.navigate('#/two');
    await wait(60);

    assert.deepStrictEqual(app.mounted, ['PageOne', 'PageTwo'], 'both routes should mount when navigated in sequence');
    assert.strictEqual(router.currentRoute.page, 'PageTwo');
  } finally {
    router.delegate.destroy();
  }

  console.log('  ✅ Sequential navigation still mounts every route.');
}

(async () => {
  try {
    await testStaleNavigationDoesNotCommit();
    await testOutOfOrderResolutionKeepsLatestRoute();
    await testStaleGuardRejectionIsIgnored();
    await testSequentialNavigationStillWorks();
    console.log('🎉 All router navigation race tests passed successfully!');
  } catch (err) {
    console.error('❌ Router navigation race test failed:', err);
    process.exit(1);
  }
})();
