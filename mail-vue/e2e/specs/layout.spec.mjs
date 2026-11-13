import { test, expect, open, isPhone } from '../fixtures.mjs';

for (const path of ['/mail-chat', '/inbox', '/settings', '/system-settings', '/all-users', '/role', '/analysis', '/all-mail']) {
  test(`no horizontal page scroll on ${path}`, async ({ page }) => {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
}

test('docked navigation is clickable on wide screens', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), 'phones use the drawer');
  await page.setViewportSize({ width: 1920, height: 1000 });
  await open(page, '/settings');
  const items = page.locator('.persistent-aside .el-menu-item:visible');
  const blocked = await items.evaluateAll(list => list.filter(item => {
    const box = item.getBoundingClientRect();
    return !item.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  }).length);
  expect(blocked).toBe(0);
  await page.locator('.persistent-aside .el-menu-item', { hasText: 'Inbox' }).click();
  await expect(page).toHaveURL(/\/inbox$/);
});

test('narrow screens open navigation from the drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await open(page, '/inbox');
  await page.locator('.global-navigation-toggle').click();
  await expect(page.locator('.navigation-drawer')).toBeVisible();
});
