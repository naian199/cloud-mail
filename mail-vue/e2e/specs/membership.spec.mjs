import { test, expect, open, isPhone } from '../fixtures.mjs';
import { API, BASE, PASSWORD } from '../env.mjs';

// Membership phase 1 on the isolated local backend, where e2e/server.mjs turns on purchases and
// the test payment provider. Each test uses its own fresh user so orders never mix.

const json = (r) => r.json();
async function token(email) {
  return (await json(await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) }))).data.token;
}
const as = (t) => async (method, path, body) => json(await fetch(API + path, { method, headers: { Authorization: t, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
let serial = 0;
async function freshUser(testInfo) {
  const email = `mem${testInfo.project.name === 'phone' ? 'p' : 'd'}${String(Date.now()).slice(-6)}${serial++}@example.com`;
  const res = await json(await fetch(`${API}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) }));
  expect(res.code).toBe(200);
  return { email, token: await token(email) };
}
const DAY = 86400;

test.describe('membership', () => {
  test.describe.configure({ timeout: 60_000 });

  test('choose a plan, the order waits, the server confirms payment, the member page updates', async ({ browser }, testInfo) => {
    const user = await freshUser(testInfo);
    const context = await browser.newContext({ serviceWorkers: 'block', ...(isPhone(testInfo) ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }) });
    await context.addInitScript((value) => localStorage.setItem('token', value), user.token);
    const page = await context.newPage();
    await page.goto(BASE + '/me');
    await page.locator('[data-me="membership"]').click();
    await expect(page).toHaveURL(/\/membership$/);
    await expect(page.locator('[data-member-status]')).toBeVisible();
    await expect(page.locator('[data-plan="demo-month"] .demo-badge')).toBeVisible();
    await page.locator('[data-plan="demo-month"] button').click();
    const order = page.locator('[data-order]').first();
    await expect(order.locator('.order-status')).toHaveAttribute('data-status', 'pending');
    await order.locator('[data-action="test-paid"]').click();
    await expect(order.locator('.order-status')).toHaveAttribute('data-status', 'paid');
    await expect(page.locator('[data-member-status]')).toHaveClass(/active/);
    await expect(page.locator('[data-member-expiry]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await context.close();
  });

  test('server fixes the price; duplicate and late notices never grant twice', async ({}, testInfo) => {
    const user = as((await freshUser(testInfo)).token);
    const order = (await user('POST', '/member/orders', { planId: 'demo-month', amount: 1, currency: 'USD', days: 999 })).data;
    expect([order.amount, order.currency, order.days, order.status]).toEqual([100, 'CNY', 30, 'pending']);
    const evt = `evt-${testInfo.project.name}-${Date.now()}`;
    expect((await user('POST', '/member/test-payments', { orderId: order.orderId, type: 'paid', eventId: evt })).data.outcome).toBe('applied');
    const first = (await user('GET', '/member/me')).data;
    expect(first.membership.active).toBe(true);
    // The same event again, and a second "paid" event for the same order: no change.
    expect((await user('POST', '/member/test-payments', { orderId: order.orderId, type: 'paid', eventId: evt })).data.outcome).toBe('duplicate');
    expect((await user('POST', '/member/test-payments', { orderId: order.orderId, type: 'paid', eventId: `${evt}-again` })).data.outcome).toBe('ignored');
    expect((await user('GET', '/member/me')).data.membership.expiresAt).toBe(first.membership.expiresAt);
    expect(first.membership.expiresAt - first.now).toBeGreaterThanOrEqual(30 * DAY - 5);
    expect(first.membership.expiresAt - first.now).toBeLessThanOrEqual(30 * DAY + 5);
  });

  test('failure, retry, cancel, refund and renewal follow the allowed transitions', async ({}, testInfo) => {
    const user = as((await freshUser(testInfo)).token);
    const pay = (orderId, type) => user('POST', '/member/test-payments', { orderId, type });
    // Failed, then a retried payment succeeds.
    const a = (await user('POST', '/member/orders', { planId: 'demo-month' })).data;
    expect((await pay(a.orderId, 'failed')).data.order.status).toBe('failed');
    expect((await pay(a.orderId, 'paid')).data.order.status).toBe('paid');
    const afterA = (await user('GET', '/member/me')).data.membership.expiresAt;
    // Renewing while active adds to the current end.
    const b = (await user('POST', '/member/orders', { planId: 'demo-month' })).data;
    await pay(b.orderId, 'paid');
    const afterB = (await user('GET', '/member/me')).data.membership.expiresAt;
    expect(afterB - afterA).toBe(30 * DAY);
    // A refund removes exactly that order's days and revokes its fulfilment.
    const refund = await pay(b.orderId, 'refunded');
    expect([refund.data.order.status, refund.data.order.fulfilment]).toEqual(['refunded', 'revoked']);
    expect((await user('GET', '/member/me')).data.membership.expiresAt).toBe(afterA);
    // Refunding the first order too ends the membership now; renewing then starts from now.
    await pay(a.orderId, 'refunded');
    const ended = (await user('GET', '/member/me')).data;
    expect(ended.membership.expiresAt).toBeLessThanOrEqual(ended.now);
    const c = (await user('POST', '/member/orders', { planId: 'demo-month' })).data;
    await pay(c.orderId, 'paid');
    const restarted = (await user('GET', '/member/me')).data;
    expect(Math.abs(restarted.membership.expiresAt - (restarted.now + 30 * DAY))).toBeLessThanOrEqual(5);
    // Cancelled orders cannot be paid; paid orders cannot be cancelled; refunded ones stay refunded.
    const d = (await user('POST', '/member/orders', { planId: 'demo-year' })).data;
    expect((await user('POST', `/member/orders/${d.orderId}/cancel`)).data.status).toBe('cancelled');
    expect((await pay(d.orderId, 'paid')).data.outcome).toBe('ignored');
    expect((await user('POST', `/member/orders/${c.orderId}/cancel`)).code).toBe(409);
    expect((await pay(b.orderId, 'paid')).data.outcome).toBe('ignored');
  });

  test('orders belong to their owner; the admin query needs member:query', async ({ browser }, testInfo) => {
    const owner = await freshUser(testInfo), other = await freshUser(testInfo);
    const order = (await as(owner.token)('POST', '/member/orders', { planId: 'demo-month' })).data;
    const intruder = as(other.token);
    expect((await intruder('POST', '/member/test-payments', { orderId: order.orderId, type: 'paid' })).code).toBe(404);
    expect((await intruder('POST', `/member/orders/${order.orderId}/cancel`)).code).toBe(409);
    expect((await intruder('GET', '/member-admin/orders')).code).toBe(403);
    // The site admin finds the order by email in the admin workspace.
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.addInitScript((value) => localStorage.setItem('token', value), await token('owner@example.com'));
    const page = await context.newPage();
    await page.goto(`${BASE}/member-orders?q=${encodeURIComponent(owner.email)}`);
    await expect(page.locator(`[data-order="${order.orderId}"]`)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.admin-navigation [aria-current="page"]')).toBeVisible();
    await context.close();
  });

  test('the admin order list shows retry when its request fails', async ({ page }) => {
    await page.route(/\/api\/member-admin\/orders/, (route) => route.abort());
    await open(page, '/member-orders');
    await expect(page.locator('.list-state-failed')).toBeVisible();
    await expect(page.locator('.member-admin .muted')).toHaveCount(0);
  });
});
