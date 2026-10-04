import { expect, test } from '@playwright/test';

test('Tier B never requests the Three.js constellation chunk', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  const webglRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('constellation-webgl')) webglRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-capability-tier', 'tier-b');
  expect(webglRequests).toHaveLength(0);
});

test('a failed Tier A module request downgrades once and preserves content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/constellation-webgl(?:-[^/]+)?\.(?:js|ts)$/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-capability-tier', 'tier-b');
  await expect(page.locator('[data-constellation] a')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Argus', exact: true })).toBeVisible();
});

test('a missing decorative product image keeps its label and action', async ({ page }) => {
  await page.route('**/assets/argus.png', (route) => route.abort());
  await page.goto('/');
  const argus = page.getByRole('link', { name: 'Explore Argus', exact: true });
  await expect(argus).toBeVisible();
  await argus.click();
  await expect(page.locator('#product-argus')).toHaveAttribute('data-active', '');
});
