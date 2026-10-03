import { expect, test } from '@playwright/test';

test('every constellation destination opens its matching product world', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('[data-constellation] a');
  const count = await links.count();
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute('href');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(href!)).toHaveAttribute('data-active', '');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await page.locator(`${href} [data-product-close]`).click();
    await expect(link).toBeFocused();
  }
});

test('story and evidence modes preserve the active product context', async ({ page }) => {
  await page.goto('/#product-argus');
  const product = page.locator('#product-argus');
  await page.getByRole('button', { name: 'Evidence' }).click();
  await expect(product.locator('[data-mode-content="story"]')).toBeHidden();
  await expect(product.locator('[data-mode-content="evidence"]')).toBeVisible();
  await expect(page).toHaveURL(/#product-argus$/);
});

test('browser history and product state stay synchronized', async ({ page }) => {
  await page.goto('/#products');
  await page.locator('[data-constellation] a[href="#product-argus"]').click();
  await expect(page.locator('#product-argus')).toHaveAttribute('data-active', '');
  await page.goBack();
  await expect(page.locator('#product-argus')).not.toHaveAttribute('data-active', '');
  await expect(page.locator('html')).not.toHaveAttribute('data-active-product', /.+/);
  await page.goForward();
  await expect(page.locator('#product-argus')).toHaveAttribute('data-active', '');
  await page.evaluate(() => { location.hash = '#product-not-real'; });
  await expect(page.locator('#product-argus')).not.toHaveAttribute('data-active', '');
});

test('product stories remain readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.product-world__story').first()).toBeVisible();
  await expect(page.locator('.product-world').first()).toContainText('The problem');
  await context.close();
});
