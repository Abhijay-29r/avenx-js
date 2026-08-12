import { test, expect } from '@playwright/test';

test.describe('Avenx <@defer> Tag E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/defer.html');
  });

  test('should load deferred content on user interaction click', async ({ page }) => {
    const triggerBtn = page.locator('#btn-trigger-interaction');
    const deferredContent = page.locator('#interaction-content');

    await expect(triggerBtn).toBeVisible();
    await expect(deferredContent).not.toBeAttached();

    await triggerBtn.click();

    await expect(deferredContent).toBeVisible();
    await expect(deferredContent).toHaveText('Interactive Content Loaded Successfully');
    await expect(triggerBtn).not.toBeAttached();
  });

  test('should load deferred content automatically on timer trigger', async ({ page }) => {
    const timerContent = page.locator('#timer-content');

    await expect(timerContent).toBeVisible();
    await expect(timerContent).toHaveText('Timer Content Loaded');
  });
});
