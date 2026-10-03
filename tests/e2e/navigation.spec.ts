import { expect, test } from '@playwright/test';

test('keyboard navigation and command palette remain accessible', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  const command = page.getByRole('button', { name: 'Open command palette' });
  await command.focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Navigate the portfolio' })).toBeVisible();
  await expect(page.getByPlaceholder('Search products and sections')).toBeFocused();
  await page.keyboard.type('Argus');
  await expect(page.getByRole('option', { name: /^Argus Product$/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(command).toBeFocused();
});

test('motion preference persists and contact keeps a mail fallback', async ({ page }) => {
  await page.goto('/');
  const motion = page.getByRole('button', { name: /motion/i });
  await motion.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true }));
  await page.getByRole('button', { name: /Copy pavel@noctis.biz/ }).click();
  await expect(page.locator('[data-live-status]')).toContainText('Open your mail app');
  await expect(page.getByRole('link', { name: 'Open your mail app' })).toHaveAttribute('href', 'mailto:pavel@noctis.biz');
});

test('mobile menu supports keyboard navigation and fragment links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Products', exact: true }).click();
  await expect(page).toHaveURL(/#products$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});
