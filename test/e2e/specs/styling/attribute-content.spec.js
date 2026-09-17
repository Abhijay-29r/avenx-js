import { test, expect } from '../../support/fixtures.js';

/**
 * Attribute values are content, never markup.
 *
 * The template front-end used to apply `@css`, `data-ax-bind` and comment
 * stripping with regular expressions that ended a tag at the first `>` and
 * treated any `<!--` as a comment. Every case below built successfully and then
 * rendered wrong in the browser: the scoped class vanished, the handler became
 * `count class=`, the binding was never expanded, or an attribute was emptied.
 * In the production bundle the component rendered as an empty element.
 *
 * These run against the production build of the styling app, which is what a
 * deployment ships.
 */

/**
 * Reads one resolved style property from the element matching a test id.
 * @param {import('@playwright/test').Page} page - The page under test.
 * @param {string} testId - The data-testid to resolve.
 * @param {string} property - A CSS property name.
 * @returns {Promise<string>} The computed value.
 */
function computed(page, testId, property) {
  return page.evaluate(
    ([id, prop]) => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)).getPropertyValue(prop),
    [testId, property],
  );
}

test.describe('attribute content on tags with front-end directives', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('styling');
  });

  test('applies @css whether it comes before or after a handler containing ">"', async ({ page }) => {
    expect(await computed(page, 'css-after', 'letter-spacing')).toBe('5px');
    expect(await computed(page, 'css-before', 'letter-spacing')).toBe('5px');
  });

  test('runs a handler containing ">" on a tag that also carries @css', async ({ page }) => {
    const count = page.getByTestId('count');
    await expect(count).toHaveText('0');

    await page.getByTestId('css-after').click();
    await expect(count).toHaveText('1');
    await page.getByTestId('css-before').click();
    await expect(count).toHaveText('2');
    await page.getByTestId('css-after').click();
    await expect(count).toHaveText('10');
  });

  test('leaves no compiler directive or stray attribute on the rendered element', async ({ page }) => {
    for (const id of ['css-after', 'css-before']) {
      const names = await page
        .getByTestId(id)
        .evaluate((element) => Array.from(element.attributes, (attribute) => attribute.name).sort());
      expect(names.every((name) => ['class', 'data-testid'].includes(name))).toBe(true);
    }
  });

  test('expands data-ax-bind on a tag whose other attribute contains ">"', async ({ page }) => {
    const input = page.getByTestId('bound');
    await expect(input).toHaveAttribute('title', 'a > b');
    await input.fill('typed');
    await expect(page.getByTestId('draft')).toHaveText('typed');
  });

  test('keeps double quotes inside a single-quoted handler', async ({ page }) => {
    await page.getByTestId('quoted').click();
    await expect(page.getByTestId('label')).toHaveText('clicked');
  });

  test('keeps comment-like text inside an attribute value', async ({ page }) => {
    await expect(page.getByTestId('label')).toHaveAttribute('title', '<!-- not a comment -->');
  });
});
