import { test, expect, open, isPhone } from '../fixtures.mjs';

for (const path of ['/mail-chat', '/inbox', '/admin', '/apps/review', '/invite-code', '/settings', '/system-settings', '/all-users', '/role', '/analysis', '/all-mail']) {
  test(`no horizontal page scroll on ${path}`, async ({ page }) => {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
}

// The desktop rail replaces the old drawer and docked menu, at every desktop width.
for (const width of [1920, 962]) {
  test(`the navigation rail is visible and clickable at ${width}px`, async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), 'phones use the tab bar');
    await page.setViewportSize({ width, height: 800 });
    await open(page, '/settings');
    const items = page.locator('.site-rail .rail-item:visible');
    const blocked = await items.evaluateAll(list => list.filter(item => {
      const box = item.getBoundingClientRect();
      return !item.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    }).length);
    expect(blocked).toBe(0);
    await page.locator('.site-rail [data-nav="mail"]').click();
    await expect(page).toHaveURL(/\/inbox$/);
  });
}

test('phones navigate with the tab bar', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'desktop uses the rail');
  await open(page, '/inbox');
  await page.locator('.site-tabbar [data-nav="files"]').click();
  await expect(page).toHaveURL(/\/files$/);
});

test('administrators access management pages from the workspace on desktop and phone', async ({ page }, testInfo) => {
  if (isPhone(testInfo)) {
    await open(page, '/me');
    await page.locator('[data-me="admin"]').click();
  } else {
    await open(page, '/inbox');
    await page.locator('[data-nav="admin"]').click();
  }
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.admin-intro h1')).toBeVisible();
  await page.locator('.admin-module[href="/all-users"]').click();
  await expect(page).toHaveURL(/\/all-users$/);
  if (isPhone(testInfo)) {
    await page.locator('.admin-mobile-menu button').click();
    await page.locator('.el-dropdown-menu__item:visible').filter({ hasText: 'Review apps' }).click();
  } else {
    await page.locator('.admin-page-link[href="/apps/review"]').click();
  }
  await expect(page).toHaveURL(/\/apps\/review$/);
  await expect(page.locator('.review-heading h1')).toBeVisible();
  await page.locator('.admin-home-link').click();
  await expect(page).toHaveURL(/\/admin$/);
});
