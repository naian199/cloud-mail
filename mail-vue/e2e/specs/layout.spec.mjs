import { test, expect, open, isPhone } from '../fixtures.mjs';

for (const path of ['/mail-chat', '/inbox', '/settings', '/system-settings', '/all-users', '/role', '/analysis', '/all-mail']) {
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

