import { test, expect, open, isPhone } from '../fixtures.mjs';
import { API, BASE, PEER, PASSWORD } from '../env.mjs';

// The rebuilt shell (desktop rail / phone tab bar), the app store and its review flow, and the
// address rules for chat, rooms and mail detail. Everything runs against the local backend.

const json = (r) => r.json();
async function token(email) {
  return (await json(await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) }))).data.token;
}
const as = (t) => async (method, path, body) => json(await fetch(API + path, { method, headers: { Authorization: t, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));

// One published app per project run, made through the real publish → review flow.
async function publishedApp(api, tag) {
  const files = (await api('GET', '/app-publish/files')).data;
  const { appId } = (await api('POST', '/app-publish', { name: `Pocket Ledger ${tag}`, summary: 'Track spending offline', category: 'tools', sourceUrl: 'https://example.com/ledger' })).data;
  const { versionId } = (await api('POST', `/app-publish/${appId}/versions`, { version: '1.4.0', platform: 'android', fileId: files[0].fileId, notes: 'First release' })).data;
  expect((await api('POST', `/app-publish/${appId}/submit`)).code).toBe(200);
  expect((await api('POST', `/app-review/${appId}`, { action: 'approve' })).code).toBe(200);
  return { appId, versionId };
}

test.describe('redesigned site', () => {
  test.describe.configure({ timeout: 60_000 });

  test('navigation: three sections plus mail and me, with the right one active', async ({ page }, testInfo) => {
    await open(page, '/apps');
    const nav = isPhone(testInfo) ? page.locator('.site-tabbar') : page.locator('.site-rail');
    await expect(nav).toBeVisible();
    await expect(nav.locator('[data-nav="store"]')).toHaveClass(/active/);
    await nav.locator('[data-nav="chat"]').click();
    await expect(page).toHaveURL(/\/mail-chat/);
    if (isPhone(testInfo)) {
      // Mail sits under "Me" on phones, with its own entry at the top.
      await nav.locator('[data-nav="me"]').click();
      await page.locator('[data-me="mail"]').click();
    } else {
      await nav.locator('[data-nav="mail"]').click();
    }
    await expect(page).toHaveURL(/\/inbox/);
    await expect(page.locator('.mail-tabs .mail-tab.active')).toBeVisible();
    // External conversations are a mail tab, not a chat segment.
    await page.locator('.mail-tabs a[href="/external-mail"]').click();
    await expect(page).toHaveURL(/\/external-mail/);
    await expect(page.locator('.conversation-categories')).toHaveCount(0);
  });

  test('store: search, platform filter, detail, download and the shared link card', async ({ page, api }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const tag = `${testInfo.project.name}${testInfo.repeatEachIndex}`;
    const { appId } = await publishedApp(admin, tag);

    await open(page, '/apps');
    await page.locator('.store-search input').fill(`Ledger ${tag}`);
    await expect(page.locator(`[data-app="${appId}"]`)).toBeVisible();
    await page.locator('.platform', { hasText: 'iOS' }).click();
    await expect(page).toHaveURL(/platform=ios/);
    await expect(page.locator('.store-empty')).toBeVisible();
    await page.locator('.platform').first().click();
    await page.locator(`[data-app="${appId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/apps/${appId}$`));
    await expect(page.locator('.hero-copy h1')).toHaveText(`Pocket Ledger ${tag}`);

    // Download goes to the provider page that the server hands out; no new tab is needed to check it.
    await page.evaluate(() => { window.open = () => ({ opener: null, location: {}, close() {} }); });
    const answer = page.waitForResponse((r) => /\/versions\/\d+\/download$/.test(r.url()));
    await page.locator('.get-download').click();
    const body = await (await answer).json();
    expect(body.code).toBe(200);
    expect(body.data.url).toMatch(/^https:\/\//);

    // Back from a detail page opened in the same tab returns to the filtered list.
    await page.locator('.detail-back').click();
    await expect(page).toHaveURL(/\/apps(\?|$)/);

    // A shared link in a group renders the store card, resolved by the server.
    const room = (await admin('POST', '/chat/rooms', { name: `Share ${tag}`, kind: 'group' })).data;
    await admin('POST', `/chat/rooms/${room.id}/messages`, { body: `Look ${BASE}/apps/${appId}`, clientId: `share-${tag}-${Date.now()}` });
    await open(page, `/rooms?kind=group&room=${room.id}`);
    await expect(page.locator(`a[data-app-card="${appId}"]`)).toBeVisible();

    // Taking the app down turns the same card into "unavailable" without its details.
    await admin('POST', `/app-review/${appId}`, { action: 'remove', note: 'Policy' });
    await page.reload();
    await expect(page.locator(`div[data-app-card="${appId}"].app-card-off`)).toBeVisible();
  });

  test('store permissions: others cannot see drafts, publish or review', async ({ browser }) => {
    const admin = as(await token('owner@example.com'));
    const peer = as(await token(PEER));
    const { appId } = (await admin('POST', '/app-publish', { name: `Hidden ${Date.now()}` })).data;
    expect((await peer('GET', `/apps/${appId}`)).code).toBe(404);
    expect((await peer('GET', `/apps/${appId}/card`)).data.available).toBe(false);
    expect((await peer('POST', '/app-publish', { name: 'x' })).code).toBe(403);
    expect((await peer('GET', '/app-review/queue')).code).toBe(403);

    const context = await browser.newContext({ serviceWorkers: 'block' });
    const t = await token(PEER);
    await context.addInitScript((value) => localStorage.setItem('token', value), t);
    const page = await context.newPage();
    await page.goto(BASE + '/me');
    await expect(page.locator('.me-page')).toBeVisible();
    await expect(page.locator('[data-me="publish"]')).toHaveCount(0);
    await expect(page.locator('[data-me="review"]')).toHaveCount(0);
    await context.close();
  });

  test('a mail address opens that message in a fresh tab, and Back falls back to the list', async ({ browser, api }) => {
    const list = await api.get('/email/list?accountId=1&allReceive=0&emailId=0&timeSort=0&size=5&type=0');
    const [first, second] = list.list;
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript((value) => localStorage.setItem('token', value), await token('owner@example.com'));
    const a = await context.newPage(), b = await context.newPage();
    await a.goto(`${BASE}/mail/${first.emailId}`);
    await expect(a.locator('.email-title')).toHaveText(first.subject);
    await b.goto(`${BASE}/mail/${second.emailId}`);
    await expect(b.locator('.email-title')).toHaveText(second.subject);
    // Opening another message in tab B never changes tab A.
    await a.reload();
    await expect(a.locator('.email-title')).toHaveText(first.subject);
    await a.locator('.header-actions .icon').first().click();
    await expect(a).toHaveURL(/\/inbox$/);
    await a.goto(`${BASE}/mail/999999`);
    await expect(a.locator('.mail-unavailable')).toBeVisible();
    await context.close();
  });

  test('a chat link keeps the conversation in the address; refresh and Back follow it', async ({ page, api }, testInfo) => {
    const data = await api.get('/mail-chat/conversations?accountId=1');
    const [one, two] = data.conversations.filter((c) => c.category !== 'external');
    await open(page, '/apps');
    await open(page, `/mail-chat?accountId=1&conversation=${one.key}`);
    await expect(page).toHaveURL(new RegExp(`conversation=${one.key}`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`conversation=${one.key}`));
    await expect(page.locator('button.contact.selected')).toHaveCount(1);
    // On phones the list is hidden while a conversation is open; switching is covered on desktop.
    if (two && !isPhone(testInfo)) {
      await page.locator('button.contact:not(.selected)').first().click();
      await expect(page).not.toHaveURL(new RegExp(`conversation=${one.key}`));
      await expect(page).toHaveURL(/conversation=[a-f0-9]{64}/);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`conversation=${one.key}`));
    }
  });

  test('opening a room adds a history entry', async ({ page }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const room = (await admin('POST', '/chat/rooms', { name: `History ${testInfo.project.name}${Date.now()}`, kind: 'channel' })).data;
    await open(page, '/rooms?kind=channel');
    const before = await page.evaluate(() => history.length);
    await page.locator('.room-entry', { hasText: room.name }).click();
    await expect(page).toHaveURL(new RegExp(`room=${room.id}`));
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    await page.goBack();
    await expect(page).not.toHaveURL(/room=/);
  });
});
