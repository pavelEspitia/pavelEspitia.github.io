import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/');
});

test('tier B preserves semantic controls while adding a decorative canvas', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-capability-tier', 'tier-b');
  await expect(page.locator('[data-constellation-canvas]')).toHaveAttribute('aria-hidden', 'true');
  const controls = page.locator('[data-constellation] a');
  await expect(controls).toHaveCount(4);
  await controls.first().focus();
  await expect(controls.first()).toBeFocused();
  await expect(controls.first().locator('.constellation-node__domain')).toBeVisible();
});

test('the arrival view presents visible continuous motion when motion is enabled', async ({ page }) => {
  await page.setViewportSize({ width: 661, height: 675 });
  await page.goto('/');

  const reactor = page.locator('[data-hero-reactor]');
  await expect(reactor).toBeInViewport();
  await expect(reactor).toBeVisible();
  const ringAnimation = await reactor.locator('.hero-reactor__ring').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(ringAnimation.name).not.toBe('none');
  expect(ringAnimation.duration).not.toBe('0s');
});

test('resize keeps every product control inside the constellation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const shell = page.locator('.constellation-shell');
  for (const control of await page.locator('[data-constellation] a').all()) {
    const box = await control.boundingBox();
    const bounds = await shell.boundingBox();
    expect(box).not.toBeNull();
    expect(bounds).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
});
