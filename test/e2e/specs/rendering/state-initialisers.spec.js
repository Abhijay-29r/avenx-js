import { test, expect } from '../../support/fixtures.js';

/**
 * `<state>` initialisers written as JavaScript object and array literals.
 *
 * A value such as `products="[{ id: 1, name: 'Keyboard' }]"` is not JSON, and
 * the compiler used to keep it as a string: the loop rendered nothing and
 * `products.length` counted characters. Constant literals are now evaluated at
 * build time. Quoted strings and plain text keep their existing meaning.
 */
test.describe('state initialisers', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('rendering', { hash: '#/literal-state' });
  });

  test('an array literal with unquoted keys is an array', async ({ page }) => {
    await expect(page.getByTestId('product-count')).toHaveText('2');
    await expect(page.getByTestId('product')).toHaveText(['Keyboard (1)', 'Monitor (0)']);
  });

  test('an object literal with unquoted keys is an object', async ({ page }) => {
    await expect(page.getByTestId('theme')).toHaveText('dark');
    await expect(page.getByTestId('notifications')).toHaveText('on');
  });

  test('quoted strings and plain text are unchanged', async ({ page }) => {
    await expect(page.getByTestId('greeting')).toHaveText('Hello');
    await expect(page.getByTestId('label')).toHaveText('Plain text');
  });
});
