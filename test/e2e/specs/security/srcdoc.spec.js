import { test, expect } from '../../support/fixtures.js';

/**
 * A bound `srcdoc` is HTML, escaped unless the value is `SafeHtml`.
 *
 * Runs in a real browser, because the risk is a same-origin iframe executing
 * the markup — which happy-dom does not do and a unit test cannot observe.
 */
test.describe('srcdoc binding', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('security');
  });

  test('an untrusted string in srcdoc does not execute', async ({ page }) => {
    // Give the iframe time to load and run anything it was going to run.
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__srcdocXss)).toBe(false);

    const frame = page.frameLocator('[data-testid="untrusted-frame"]');
    // The markup is escaped, so the img element never exists inside the iframe;
    // its escaped text is what shows.
    await expect(frame.locator('img')).toHaveCount(0);
  });

  test('a SafeHtml value renders as markup in srcdoc', async ({ page }) => {
    const frame = page.frameLocator('[data-testid="trusted-frame"]');
    await expect(frame.getByTestId('trusted-body')).toHaveText('trusted');
  });
});
