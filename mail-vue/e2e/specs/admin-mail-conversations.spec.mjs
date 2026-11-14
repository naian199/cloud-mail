import { test, expect, open, isPhone } from '../fixtures.mjs';
import { ADMIN, API, PEER, PASSWORD } from '../env.mjs';

test('All Mail shows conversations even when opened from an old list-view URL', async ({ page }, testInfo) => {
  await open(page, '/all-mail?view=list');
  const conversation = page.locator('.review-item').filter({ hasText: PEER })
    .filter({ hasText: ADMIN });
  await expect(conversation).toHaveCount(1);
  await conversation.click();
  await expect(page).toHaveURL(/thread=\d+/);
  await expect(page.locator('.review-bubble').filter({ hasText: 'Hi there, first message' })).toBeVisible();
  const reply = page.locator('.review-bubble').filter({ hasText: 'Hello back' });
  await expect(reply).toBeVisible();
  await expect(page.locator('.review-bubble button, .review-bubble a')).toHaveCount(0);
  await expect(page.locator('.email-container, .all-mail-modes')).toHaveCount(0);
  if (isPhone(testInfo)) await expect(page.locator('.review-back')).toBeVisible();
});

test('ordinary users cannot access administrative mail conversations', async () => {
  const login = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PEER, password: PASSWORD })
  });
  const { data } = await login.json();
  for (const path of ['/allEmail/conversations', '/allEmail/conversations/1/messages']) {
    const response = await fetch(API + path, { headers: { Authorization: data.token } });
    expect((await response.json()).code).toBe(403);
  }
});
