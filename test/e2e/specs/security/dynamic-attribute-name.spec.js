import { test, expect } from '../../support/fixtures.js';

/**
 * A dynamic attribute name must not be able to install an inline event handler.
 *
 * Runs in a real browser and without a Content-Security-Policy, because that is
 * the only place the risk is observable: the attribute was written into the
 * markup and parsed as a live handler, so a click ran it. A strict CSP stops
 * the execution but not the attribute, and no unit test sees either.
 */
test.describe('dynamic attribute names', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('security', { hash: '#/dynamic-attr' });
  });

  test('a name resolving to on* does not install a handler', async ({ page, runtimeIssues }) => {
    // Refusing it is reported, and the fixture's guard would otherwise fail
    // the test on its own warning.
    runtimeIssues.allow(/AVX_R35/);

    const target = page.getByTestId('handler-target');
    await expect(target).toBeVisible();

    expect(await target.getAttribute('onclick')).toBeNull();
    // Nor may the renderer claim it applied one.
    expect(await target.getAttribute('data-ax-dyn-attrs')).toBeNull();
  });

  test('and nothing runs when the element is clicked', async ({ page, runtimeIssues }) => {
    runtimeIssues.allow(/AVX_R35/);

    await page.getByTestId('handler-target').click();
    await page.waitForTimeout(100);

    expect(await page.evaluate(() => window.__dynAttrXss)).toBe(false);
  });

  test('an ordinary dynamic attribute still applies', async ({ page, runtimeIssues }) => {
    runtimeIssues.allow(/AVX_R35/);

    // The guard must not be bought at the cost of the feature.
    const safe = page.getByTestId('safe-target');
    await expect(safe).toHaveAttribute('data-tone', 'warm');
  });
});
