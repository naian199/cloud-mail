import { test, expect, open } from '../fixtures.mjs';

// A list that fails to load must never look empty, and a failed refresh keeps the last list.
const conversations = /\/api\/mail-chat\/conversations/;
const rooms = /\/api\/chat\/rooms(\?|$)/;

test.describe('list failure states', () => {
  test.describe.configure({ timeout: 60_000 });

  test('a conversation list that never loaded shows retry, not the empty state', async ({ page }) => {
    await page.route(conversations, (route) => route.abort());
    await open(page, '/mail-chat');
    const list = page.locator('.contact-entries');
    await expect(list.locator('.list-state-failed')).toBeVisible();
    await expect(list.locator('.el-empty')).toHaveCount(0);
    await page.unroute(conversations);
    await list.locator('.list-state-failed button').click();
    await expect(list.locator('button.contact').first()).toBeVisible();
    await expect(list.locator('.list-state')).toHaveCount(0);
  });

  test('a failed refresh keeps the loaded conversations and marks them as not updated', async ({ page }) => {
    await open(page, '/mail-chat');
    const list = page.locator('.contact-entries');
    const rows = list.locator('button.contact');
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    await page.route(conversations, (route) => route.abort());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(list.locator('.list-state-stale')).toBeVisible();
    await expect(rows).toHaveCount(before);
    await expect(list.locator('.el-empty')).toHaveCount(0);
    await page.unroute(conversations);
    await list.locator('.list-state-stale button').click();
    await expect(list.locator('.list-state')).toHaveCount(0);
    await expect(rows).toHaveCount(before);
  });

  test('a room list that never loaded shows retry, not the empty state', async ({ page }) => {
    await page.route(rooms, (route) => (route.request().method() === 'GET' ? route.abort() : route.continue()));
    await open(page, '/rooms');
    const list = page.locator('.room-entries');
    await expect(list.locator('.list-state-failed')).toBeVisible();
    await expect(list.locator('.el-empty')).toHaveCount(0);
    await page.unroute(rooms);
    await list.locator('.list-state-failed button').click();
    await expect(list.locator('.list-state')).toHaveCount(0);
  });
});
