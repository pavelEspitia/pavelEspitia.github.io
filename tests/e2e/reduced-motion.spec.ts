import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('reduced motion selects semantic Tier C without continuous renderers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-capability-tier', 'tier-c');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('[data-constellation-canvas], [data-constellation-webgl]')).toHaveCount(0);
  const animationName = await page.locator('.aurora').evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toBe('none');
});
