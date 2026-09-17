import { test, expect } from '../../support/fixtures.js';

/**
 * `<resource>` and `<action>` bodies are ordinary JavaScript.
 *
 * README.md, core-concepts/resources.md and core-concepts/lifecycle-hooks.md
 * use `fetch`, `setInterval`, `clearInterval` and `window` in them. From
 * 2026-09-10 until this spec was added, every one of those failed the build
 * with AVX_C21, and any other browser global failed at run time with AVX_R15.
 *
 * These run against the production build of the browser-apis fixture app.
 */
test.describe('browser APIs in resource and action bodies', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('browser-apis');
  });

  test('a <resource> loads its data with fetch', async ({ page }) => {
    await expect(page.getByTestId('user')).toHaveText(['ada', 'grace']);
  });

  test('an onMount action starts a timer with setInterval', async ({ page }) => {
    await expect
      .poll(async () => Number(await page.getByTestId('ticks').textContent()), { timeout: 3000 })
      .toBeGreaterThan(2);
  });

  test('an action reads window and attaches a window listener', async ({ page }) => {
    const initial = await page.evaluate(() => window.innerWidth);
    await expect(page.getByTestId('width')).toHaveText(String(initial));

    await page.setViewportSize({ width: 777, height: 600 });
    await expect(page.getByTestId('width')).toHaveText('777');
  });

  test('an action uses requestAnimationFrame', async ({ page }) => {
    await expect(page.getByTestId('framed')).toHaveText('true');
  });

  test('an action constructs with new and builds shorthand objects', async ({ page }) => {
    await expect(page.getByTestId('stamp')).toHaveText('1970-01-01T00:00:00.000Z');
    await expect(page.getByTestId('summary')).toHaveText('{"epoch":0}');
  });

  test('an action stops the timer with clearInterval and writes a window property', async ({ page }) => {
    await page.getByTestId('stop').click();
    await expect.poll(() => page.evaluate(() => window.__tickerStopped)).toBe(true);

    const stopped = Number(await page.getByTestId('ticks').textContent());
    await page.waitForTimeout(200);
    expect(Number(await page.getByTestId('ticks').textContent())).toBe(stopped);
  });
});
