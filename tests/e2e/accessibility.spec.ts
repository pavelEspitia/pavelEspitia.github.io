import { expect, test } from '@playwright/test';

test('landmarks, headings, and controls have an understandable structure', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Building something difficult? Good.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
});

test('keyboard-only journey reaches contact and announces copy status', async ({ page }) => {
  await page.goto('/');
  const contact = page.getByRole('link', { name: 'Contact', exact: true });
  if (!await contact.isVisible()) await page.getByRole('button', { name: 'Open navigation' }).click();
  await contact.focus();
  await page.keyboard.press('Enter');
  const copy = page.getByRole('button', { name: /Copy pavel@noctis.biz/ });
  await copy.focus();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }));
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-live-status]')).toContainText('copied to clipboard');
});

test('200 percent equivalent reflow has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('essential controls remain visible in forced colors', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colors emulation is Chromium-specific.');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Explore the product universe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
});
