import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 900, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`static layout remains usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(5, 7, 13)');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await expect(page.locator('.skip-link')).toBeVisible();
    await expect(page.locator('.primary-nav')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore the product universe' })).toBeVisible();

    for (const product of await page.locator('.product-world').all()) {
      const box = await product.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box?.height ?? 0).toBeGreaterThan(0);
    }

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ));
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test('contact actions reflow at zoom-equivalent width', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 500 });
  await page.goto('/#contact');

  await expect(page.locator('.contact-actions')).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy pavel@noctis.biz/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open your mail app' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
