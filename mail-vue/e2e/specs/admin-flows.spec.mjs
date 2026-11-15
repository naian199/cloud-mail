import { test, expect, open, isPhone } from '../fixtures.mjs';
import { API, BASE, PEER, PASSWORD } from '../env.mjs';

// Everyday admin tasks: open a user's details and come back, review an app and come back, switch
// settings categories and return to the admin home. Plus who may open what. Local test data only.

const json = (r) => r.json();
async function token(email) {
  return (await json(await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) }))).data.token;
}
const as = (t) => async (method, path, body) => json(await fetch(API + path, { method, headers: { Authorization: t, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));

test.describe('admin flows', () => {
  test.describe.configure({ timeout: 60_000 });

  test('find a user, open details, Back closes them and keeps the search', async ({ page }) => {
    await open(page, '/all-users');
    await page.locator('.search-form input').fill('palmer');
    await page.locator('.search-form input').press('Enter');
    await expect(page).toHaveURL(/[?&]q=palmer/);
    await page.locator('.email-link', { hasText: 'palmer' }).first().click();
    await expect(page).toHaveURL(/[?&]user=\d+/);
    await expect(page.locator('.el-dialog', { hasText: 'palmer@example.com' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/all-users\?q=palmer$/);
    await expect(page.locator('.el-dialog:visible')).toHaveCount(0);
    await expect(page.locator('.search-form input')).toHaveValue('palmer');
    // A refresh, or the address shared as a link, reopens the same search and details.
    const withUser = page.url();
    await page.locator('.email-link', { hasText: 'palmer' }).first().click();
    const detailsUrl = page.url();
    await page.goto(detailsUrl);
    await expect(page.locator('.el-dialog', { hasText: 'palmer@example.com' })).toBeVisible();
    await expect(page.locator('.search-form input')).toHaveValue('palmer');
    // Closing with the dialog's own button also drops the user from the address.
    await page.locator('.el-dialog__headerbtn').click();
    await expect(page).not.toHaveURL(/user=/);
    expect(withUser).toMatch(/q=palmer/);
  });

  test('open a pending app and its versions, go to the app, come back to the same place', async ({ page }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const files = (await admin('GET', '/app-publish/files')).data;
    const name = `Queue ${testInfo.project.name} ${Date.now()}`;
    const { appId } = (await admin('POST', '/app-publish', { name })).data;
    await admin('POST', `/app-publish/${appId}/versions`, { version: '1.0', platform: 'android', fileId: files[0].fileId });
    await admin('POST', `/app-publish/${appId}/submit`);

    await open(page, '/apps/review');
    await page.locator('.review-filters input').first().fill(name);
    await expect(page).toHaveURL(/[?&]q=/);
    const item = page.locator(`[data-review="${appId}"]`);
    await item.locator('button', { hasText: /版本|Versions/ }).click();
    await expect(item.locator('.versions li')).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`[?&]open=${appId}`));
    await item.locator('a').first().click();
    await expect(page).toHaveURL(new RegExp(`/apps/${appId}$`));
    await page.goBack();
    await expect(page.locator('.review-filters input').first()).toHaveValue(name);
    await expect(page.locator(`[data-review="${appId}"] .versions li`)).toHaveCount(1);
  });

  test('switch settings category, go to the admin home, come back to the same category', async ({ page }) => {
    await open(page, '/system-settings');
    const categories = page.locator('.settings-navigation button');
    await categories.nth(2).click();
    const chosen = (await page.locator('.settings-results-heading h2').innerText()).trim();
    await expect(page).toHaveURL(/[?&]category=/);
    await page.locator('.admin-home-link').click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goBack();
    await expect(page.locator('.settings-results-heading h2')).toHaveText(chosen);
    await page.reload();
    await expect(page.locator('.settings-results-heading h2')).toHaveText(chosen);
  });

  test('admin pages stay within the phone width and show the current module', async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo), 'phone layout');
    for (const path of ['/admin', '/all-users', '/all-mail', '/apps/review', '/role', '/invite-code', '/system-settings', '/analysis']) {
      await open(page, path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      await expect(page.locator('.admin-navigation')).toBeVisible();
    }
  });
});

test.describe('admin access scope', () => {
  test.describe.configure({ timeout: 60_000 });

  test('ordinary users get no admin pages or admin data', async ({ browser }) => {
    const peer = as(await token(PEER));
    for (const path of ['/user/list?num=1&size=10', '/setting/query', '/allEmail/conversations', '/role/list', '/regKey/list', '/app-review/queue']) {
      expect((await peer('GET', path)).code).toBe(403);
    }
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript((value) => localStorage.setItem('token', value), await token(PEER));
    const page = await context.newPage();
    await page.goto(BASE + '/admin');
    await page.waitForTimeout(2500);
    await expect(page.locator('.admin-navigation')).toHaveCount(0);
    await context.close();
  });

  test('a restricted admin sees only the modules their role grants', async ({ browser }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const email = `scoped${testInfo.project.name === 'phone' ? 'p' : 'd'}${String(Date.now()).slice(-6)}@example.com`;
    const registered = await (await fetch(`${API}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })).json();
    expect(registered.code).toBe(200);
    const roleName = `Users only ${testInfo.project.name} ${Date.now()}`;
    expect((await admin('POST', '/role/add', { name: roleName, permIds: [6, 7], banEmail: [], availDomain: [] })).code).toBe(200);
    const roleId = (await admin('GET', '/role/list')).data.find((r) => r.name === roleName).roleId;
    const users = (await admin('GET', `/user/list?num=1&size=50&email=${encodeURIComponent(email)}`)).data.list;
    expect((await admin('PUT', '/user/setType', { userId: users[0].userId, type: roleId })).code).toBe(200);

    const scoped = as(await token(email));
    expect((await scoped('GET', '/user/list?num=1&size=10')).code).toBe(200);
    for (const path of ['/setting/query', '/allEmail/conversations', '/role/list', '/app-review/queue']) {
      expect((await scoped('GET', path)).code).toBe(403);
    }
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem('token', value), await token(email));
    const page = await context.newPage();
    await page.goto(BASE + '/admin');
    await expect(page.locator('.admin-navigation')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.admin-navigation .admin-page-link')).toHaveCount(1);
    await page.goto(BASE + '/system-settings');
    await page.waitForTimeout(2500);
    await expect(page.locator('.settings-navigation')).toHaveCount(0);
    await context.close();
  });
});
