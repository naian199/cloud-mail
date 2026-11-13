import { test, expect, open } from '../fixtures.mjs';

const dialog = (page) => page.locator('.el-overlay-dialog .el-dialog:visible').last();
const toast = (page) => page.locator('.el-message').last();

test('add user validates and then creates the user', async ({ page }, testInfo) => {
  const name = `e2e${testInfo.project.name}`;
  await open(page, '/all-users');
  await page.locator('.header-actions .icon').first().click();
  await dialog(page).getByRole('button', { name: 'Add' }).click();
  await expect(toast(page)).toHaveText('Email cannot be empty');
  await dialog(page).locator('input').first().fill(name);
  await dialog(page).locator('input[type=password]').fill('Passw0rd!123');
  await dialog(page).getByRole('button', { name: 'Add' }).click();
  await expect(toast(page)).toHaveText('Role cannot be empty');
  await dialog(page).locator('.el-select').last().click();
  await page.locator('.el-select-dropdown__item:visible').first().click();
  await dialog(page).getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.el-overlay-dialog .el-dialog:visible')).toHaveCount(0);
  await expect(page.locator('.el-table__body tr', { hasText: name })).toBeVisible();
});

test('password change rejects short passwords', async ({ page }) => {
  await open(page, '/all-users');
  await page.locator('.el-table__body tr', { hasText: 'palmer@example.com' }).locator('td').nth(2).click({ button: 'right' });
  await page.locator('.el-dropdown-menu__item:visible', { hasText: 'Change Password' }).click();
  await dialog(page).locator('input').fill('123');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toHaveText('Password must be at least 6 characters');
  await expect(dialog(page)).toBeVisible();
});
