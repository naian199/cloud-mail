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
  const updateTime = (await api('GET', `/apps/${appId}`)).data.app.updateTime;
  expect((await api('POST', `/app-review/${appId}`, { action: 'approve', updateTime, versionIds: [versionId] })).code).toBe(200);
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
    await expect(page).toHaveURL(/\/chat$/);
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

  test('review is race-safe: stale snapshots fail, only chosen versions publish, withdrawn ones never do', async () => {
    const admin = as(await token('owner@example.com'));
    const files = (await admin('GET', '/app-publish/files')).data;
    const { appId } = (await admin('POST', '/app-publish', { name: `Race ${Date.now()}` })).data;
    const v1 = (await admin('POST', `/app-publish/${appId}/versions`, { version: '1.0', platform: 'linux', fileId: files[0].fileId })).data.versionId;
    await admin('POST', `/app-publish/${appId}/submit`);
    const snapshot = (await admin('GET', `/apps/${appId}`)).data.app.updateTime;
    // The publisher adds a version after the reviewer looked: the old snapshot is refused.
    const v2 = (await admin('POST', `/app-publish/${appId}/versions`, { version: '1.1', platform: 'linux', fileId: files[0].fileId })).data.versionId;
    const stale = await admin('POST', `/app-review/${appId}`, { action: 'approve', updateTime: snapshot, versionIds: [v1, v2] });
    expect(stale.code).toBe(409);
    // A fresh snapshot approving only v1 publishes v1; v2 keeps waiting.
    const fresh = (await admin('GET', `/apps/${appId}`)).data.app.updateTime;
    expect((await admin('POST', `/app-review/${appId}`, { action: 'approve', updateTime: fresh, versionIds: [v1] })).code).toBe(200);
    const after = (await admin('GET', `/apps/${appId}`)).data.versions;
    expect(after.find((v) => v.versionId === v1).status).toBe('published');
    expect(after.find((v) => v.versionId === v2).status).toBe('review');
    // Withdrawn meanwhile: a late approval of that version is refused and it stays withdrawn.
    await admin('POST', `/app-publish/${appId}/versions/${v2}/withdraw`);
    expect((await admin('POST', `/app-review/${appId}/versions/${v2}`, { action: 'approve' })).code).toBe(409);
    expect((await admin('GET', `/apps/${appId}`)).data.versions.find((v) => v.versionId === v2).status).toBe('withdrawn');
    // A version blocked before approval is never published: an approval listing it is refused.
    const v3 = (await admin('POST', `/app-publish/${appId}/versions`, { version: '1.2', platform: 'linux', fileId: files[0].fileId })).data.versionId;
    await admin('POST', `/app-review/${appId}/versions/${v3}`, { action: 'block', note: 'Bad build' });
    await admin('POST', `/app-review/${appId}`, { action: 'remove', note: 'Recheck' });
    await admin('POST', `/app-review/${appId}`, { action: 'restore' });
    // Unlist and resubmit: the approval is one atomic batch, retried with a fresh snapshot.
    await admin('POST', `/app-publish/${appId}/hide`);
    await admin('POST', `/app-publish/${appId}/submit`);
    const again = (await admin('GET', `/apps/${appId}`)).data.app.updateTime;
    expect((await admin('POST', `/app-review/${appId}`, { action: 'approve', updateTime: again - 1, versionIds: [v3] })).code).toBe(409);
    expect((await admin('POST', `/app-review/${appId}`, { action: 'approve', updateTime: again, versionIds: [v3] })).code).toBe(409);
    expect((await admin('GET', `/apps/${appId}`)).data.versions.find((v) => v.versionId === v3).status).toBe('blocked');
    // The refused batch left the listing untouched, so the same snapshot can be retried as is.
    expect((await admin('POST', `/app-review/${appId}`, { action: 'approve', updateTime: again, versionIds: [] })).code).toBe(200);
    // Blocking a published version stops its downloads at once.
    await admin('POST', `/app-review/${appId}/versions/${v1}`, { action: 'block', note: 'Malware report' });
    expect((await admin('POST', `/apps/${appId}/versions/${v1}/download`)).code).toBe(404);
  });

  test('share to chat: a group gets the link after a preview; a direct chat gets it as a draft', async ({ page, api }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const tag = `${testInfo.project.name}${Date.now()}`;
    const { appId } = await publishedApp(admin, `S${tag}`);
    const room = (await admin('POST', '/chat/rooms', { name: `Sharing ${tag}`, kind: 'group' })).data;
    await open(page, `/apps/${appId}`);
    await page.locator('[data-share]').click();
    await page.locator(`[data-share-target="${room.id}"]`).click();
    await expect(page.locator('.share-preview a[data-app-card]')).toBeVisible();
    await page.locator('[data-share-confirm]').click();
    await expect.poll(async () => (await admin('GET', `/chat/rooms/${room.id}/messages`)).data.messages.some((m) => m.body.includes(`/apps/${appId}`))).toBe(true);

    const chats = (await api.get('/mail-chat/conversations?accountId=1&category=internal')).conversations.filter((c) => c.category !== 'external');
    await page.locator('[data-share]').click();
    await page.locator(`[data-share-target="${chats[0].key}"]`).click();
    await page.locator('[data-share-confirm]').click();
    await expect(page).toHaveURL(new RegExp(`/mail-chat\\?accountId=1&conversation=${chats[0].key}$`));
    await expect(page.locator('.composer textarea').first()).toHaveValue(new RegExp(`/apps/${appId}`));
  });

  test('a chat draft survives a visit to the store and Back', async ({ page, api }, testInfo) => {
    test.skip(isPhone(testInfo), 'the rail is a desktop control; phones hide the tab bar inside a chat');
    const chats = (await api.get('/mail-chat/conversations?accountId=1&category=internal')).conversations.filter((c) => c.category !== 'external');
    await open(page, `/mail-chat?accountId=1&conversation=${chats[0].key}`);
    const box = page.locator('.composer textarea').first();
    await box.fill('draft kept across pages');
    await page.locator('.site-rail [data-nav="store"]').click();
    await expect(page).toHaveURL(/\/apps/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`conversation=${chats[0].key}`));
    await expect(box).toHaveValue('draft kept across pages');
  });

  test('mail detail checks ownership; plain /mail is only the admin viewer', async ({ browser, api }) => {
    const list = await api.get('/email/list?accountId=1&allReceive=0&emailId=0&timeSort=0&size=1&type=0');
    const ownerMail = list.list[0];
    const detail = await api.get(`/email/detail?emailId=${ownerMail.emailId}`);
    expect(detail.isStar === 0 || detail.isStar === 1).toBe(true);
    const peer = as(await token(PEER));
    expect((await peer('GET', `/email/detail?emailId=${ownerMail.emailId}`)).code).toBe(404);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript((value) => localStorage.setItem('token', value), await token(PEER));
    const page = await context.newPage();
    await page.goto(`${BASE}/mail/${ownerMail.emailId}`);
    await expect(page.locator('.mail-unavailable')).toBeVisible();
    await page.goto(`${BASE}/mail`);
    await expect(page).toHaveURL(/\/inbox$/);
    await context.close();
  });

  test('a cached message is never shown before the server confirms access (same tab, other account)', async ({ browser, api }) => {
    const list = await api.get('/email/list?accountId=1&allReceive=0&emailId=0&timeSort=0&size=1&type=0');
    const mail = list.list[0];
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(BASE + '/login');
    await page.evaluate((t) => localStorage.setItem('token', t), await token('owner@example.com'));
    await page.goto(`${BASE}/mail/${mail.emailId}`);
    await expect(page.locator('.email-title')).toHaveText(mail.subject);
    // Same tab, now signed in as someone else; this tab's sessionStorage still holds the message.
    await page.evaluate((t) => localStorage.setItem('token', t), await token(PEER));
    let release;
    await page.route(/\/api\/email\/detail/, async (route) => { await new Promise((r) => { release = r; }); await route.continue(); });
    await page.reload();
    await expect(page.locator('.box [aria-busy="true"]')).toBeVisible();
    await expect(page.locator('.email-title')).toHaveCount(0);
    await expect(page.locator('.header-actions .icon')).toHaveCount(1);
    await expect.poll(() => typeof release).toBe('function');
    release();
    await expect(page.locator('.mail-unavailable')).toBeVisible();
    await expect(page.locator('.email-title')).toHaveCount(0);
    await context.close();
  });

  test('All lists direct chats and rooms together and opens each in its own view', async ({ page, api }, testInfo) => {
    const admin = as(await token('owner@example.com'));
    const room = (await admin('POST', '/chat/rooms', { name: `All ${testInfo.project.name}${Date.now()}`, kind: 'group' })).data;
    await admin('POST', `/chat/rooms/${room.id}/messages`, { body: 'newest message', clientId: `all-${testInfo.project.name}-${Date.now()}` });
    const chats = (await api.get('/mail-chat/conversations?accountId=1&category=internal')).conversations.filter((c) => c.category !== 'external');
    await open(page, '/chat');
    await expect(page.locator('.conversation-categories .category-active')).toBeVisible();
    const entries = page.locator('.all-entry');
    // The room just got a message, so it is the newest entry; direct chats follow.
    await expect(entries.first()).toHaveAttribute('data-all', room.id);
    await expect(page.locator(`.all-entry[data-all="${chats[0].key}"]`)).toBeVisible();
    await entries.first().click();
    await expect(page).toHaveURL(new RegExp(`/rooms\\?kind=group&room=${room.id}`));
    await page.goBack();
    await expect(page).toHaveURL(/\/chat$/);
    await page.locator(`.all-entry[data-all="${chats[0].key}"]`).click();
    await expect(page).toHaveURL(new RegExp(`conversation=${chats[0].key}`));
  });

  test('All shows retry, not an empty list, when a source fails', async ({ page }) => {
    await page.route(/\/api\/chat\/rooms(\?|$)/, (route) => (route.request().method() === 'GET' ? route.abort() : route.continue()));
    await open(page, '/chat');
    await expect(page.locator('.all-entries .list-state-failed')).toBeVisible();
    await expect(page.locator('.all-entries .el-empty')).toHaveCount(0);
  });
});
