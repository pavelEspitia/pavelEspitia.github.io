import { expect, test } from '@playwright/test';

test('desktop story and evidence states remain visually coherent', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop visual baseline uses one deterministic project.');
  await page.addInitScript(() => localStorage.setItem('portfolio:motion', 'reduced'));
  await page.goto('/');
  await expect(page).toHaveScreenshot('desktop-story.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.015 });
  await page.getByRole('button', { name: 'Evidence' }).click();
  await expect(page).toHaveScreenshot('desktop-evidence.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.015 });
});

test('mobile story remains visually coherent', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile visual baseline uses one deterministic project.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('portfolio:motion', 'reduced'));
  await page.goto('/');
  await expect(page).toHaveScreenshot('mobile-story.png', { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.015 });
});
