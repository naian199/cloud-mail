import { test, expect, open, isPhone } from '../fixtures.mjs';
import { ADMIN, API, PEER, PASSWORD } from '../env.mjs';

test('All Mail opens a read-only conversation with both directions and retains list view', async ({ page }, testInfo) => {
  await open(page, '/all-mail');
  const conversation = page.locator('.review-item').filter({ hasText: PEER })
    .filter({ hasText: ADMIN });
  await expect(conversation).toHaveCount(1);
  await conversation.click();
  await expect(page).toHaveURL(/thread=\d+/);
  await expect(page.locator('.review-bubble').filter({ hasText: 'Hi there, first message' })).toBeVisible();
  const reply = page.locator('.review-bubble').filter({ hasText: 'Hello back' });
  await expect(reply).toBeVisible();
  await reply.locator('.review-original').click();
  await expect(page.locator('.email-title')).toBeVisible();
  await page.goBack();
  await expect(reply).toBeVisible();
  if (isPhone(testInfo)) await expect(page.locator('.review-back')).toBeVisible();
  await page.locator('.all-mail-modes a').last().click();
  await expect(page.locator('.email-container')).toBeVisible();
  await expect(page).toHaveURL(/view=list/);
});

test('ordinary users cannot access administrative mail conversations or originals', async () => {
  const login = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PEER, password: PASSWORD })
  });
  const { data } = await login.json();
  for (const path of ['/allEmail/conversations', '/allEmail/conversations/1/messages', '/allEmail/conversations/original/1']) {
    const response = await fetch(API + path, { headers: { Authorization: data.token } });
    expect((await response.json()).code).toBe(403);
  }
});
