import { test, expect, open } from '../fixtures.mjs';

const dialog = (page) => page.locator('.el-overlay-dialog .el-dialog:visible').last();

test('website title saves and the dialog closes', async ({ page, api }) => {
  await open(page, '/system-settings');
  await page.locator('.settings-card .opt-button[aria-label="Title"]').click();
  await dialog(page).locator('input').fill('Cloud Mail E2E');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.el-overlay-dialog .el-dialog:visible')).toHaveCount(0);
  await expect(page.locator('.email-title span').first()).toHaveText('Cloud Mail E2E');
  expect((await api.get('/setting/query')).title).toBe('Cloud Mail E2E');
  await api.put('/setting/set', { title: 'Cloud Mail' });
});

test('webhook refuses IP addresses and keeps the dialog open', async ({ page }) => {
  await open(page, '/system-settings');
  await page.locator('.settings-card .opt-button[aria-label="Webhook"]').click();
  await dialog(page).locator('input').first().fill('http://10.0.0.1/hook');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.el-message').first()).toBeVisible();
  await expect(dialog(page)).toBeVisible();
});

test('a failed save keeps the dialog open', async ({ page }) => {
  await open(page, '/system-settings');
  await page.route('**/api/setting/set', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'boom' }) }));
  await page.locator('.settings-card .opt-button[aria-label="Title"]').click();
  await dialog(page).locator('input').fill('Should not save');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await expect(dialog(page)).toBeVisible();
});

test('icon buttons have accessible names', async ({ page }) => {
  await open(page, '/system-settings');
  const unnamed = await page.locator('button:visible').evaluateAll(list =>
    list.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length);
  expect(unnamed).toBe(0);
});
