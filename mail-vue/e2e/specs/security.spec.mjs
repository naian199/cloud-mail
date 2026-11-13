import { test, expect, open } from '../fixtures.mjs';

test('mail HTML cannot run script in the app', async ({ page }) => {
  await open(page, '/inbox');
  await page.locator('.email-row', { hasText: 'XSS probe' }).click();
  await expect(page).toHaveURL(/\/mail$/);
  await page.waitForTimeout(1500);
  // The probe's onerror handler sets this if mail HTML ever runs in the app's window.
  expect(await page.evaluate(() => window.__XSS_FIRED ?? null)).toBeNull();
  await expect(page.locator('.mail-content iframe')).toBeVisible();
  const frame = page.frameLocator('.mail-content iframe');
  await expect(frame.locator('body')).toContainText('Hello');
});

test('remote images stay blocked until the reader allows them', async ({ page }) => {
  const reached = [];
  page.on('requestfinished', r => { if (r.url().includes('tracker.test')) reached.push(r.url()); });
  page.on('requestfailed', r => { if (r.url().includes('tracker.test') && r.failure()?.errorText !== 'csp') reached.push(r.url()); });
  await open(page, '/inbox');
  await page.locator('.email-row', { hasText: 'Remote image probe' }).click();
  const notice = page.locator('.remote-images');
  await expect(notice).toBeVisible();
  await page.waitForTimeout(800);
  expect(reached).toEqual([]);
  await notice.getByRole('button').click();
  await expect(notice).toBeHidden();
  const link = page.frameLocator('.mail-content iframe').locator('a');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
