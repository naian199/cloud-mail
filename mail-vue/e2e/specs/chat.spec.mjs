import { test, expect, open, isPhone } from '../fixtures.mjs';
import path from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const dir = mkdtempSync(path.join(tmpdir(), 'cloud-mail-e2e-'));
const file = (name) => { const p = path.join(dir, name); writeFileSync(p, `content of ${name}`); return p; };

async function openThread(page) {
  await open(page, '/mail-chat');
  await page.locator('.contact:has(.peers[title*="palmer"])').first().click();
  await expect(page.locator('.thread')).toBeVisible();
  await expect(page.locator('.bubble').first()).toBeVisible();
}

test('message menu opens by right click or long press', async ({ page }, testInfo) => {
  await openThread(page);
  const bubble = page.locator('.bubble').first();
  if (isPhone(testInfo)) {
    await bubble.evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.left + 20, y = r.top + r.height / 2;
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t], changedTouches: [t] }));
    });
  } else {
    await bubble.click({ button: 'right' });
  }
  await expect(page.locator('.mail-message-menu:visible')).toContainText('Copy text');
});

test('attachments: choose, remove, paste, drop and the file limit', async ({ page }) => {
  await openThread(page);
  const chosen = page.locator('.composer .chosen-file');
  await page.locator('.composer .attach-label:not(.large-attach-label) input[type=file]').setInputFiles([file('a.txt'), file('b.txt')]);
  await expect(chosen).toHaveCount(2);
  await chosen.first().locator('button').evaluate(b => b.click());
  await expect(chosen).toHaveCount(1);
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'pasted.txt', { type: 'text/plain' }));
    document.querySelector('.mail-chat').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(chosen).toHaveCount(2);
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File(['y'], 'dropped.txt', { type: 'text/plain' })); window.__dt = dt;
    document.querySelector('.mail-chat').dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.file-drop-overlay')).toBeVisible();
  await page.evaluate(() => document.querySelector('.mail-chat').dispatchEvent(new DragEvent('drop', { dataTransfer: window.__dt, bubbles: true, cancelable: true })));
  await expect(page.locator('.file-drop-overlay')).toBeHidden();
  await expect(chosen).toHaveCount(3);
  await page.locator('.composer .attach-label:not(.large-attach-label) input[type=file]').setInputFiles(Array.from({ length: 9 }, (_, i) => file(`n${i}.txt`)));
  await expect(page.locator('.el-message').last()).toContainText('Up to 10 files');
  await expect(chosen).toHaveCount(3);
});

test('sending posts the draft and files; a failed send keeps them', async ({ page }) => {
  await openThread(page);
  let payload = null;
  // Never deliver from tests: answer the request with an error instead.
  await page.route(/\/mail-chat\/(send|instant)/, async r => { payload = r.request().postDataJSON(); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 500, message: 'blocked in test' }) }); });
  await page.locator('.composer .attach-label:not(.large-attach-label) input[type=file]').setInputFiles([file('report.txt')]);
  await expect(page.locator('.composer .chosen-file')).toHaveCount(1);
  await page.locator('.composer textarea').fill('E2E message');
  await page.locator('.composer button[type=submit]').click();
  await expect.poll(() => payload).not.toBeNull();
  expect(payload).toMatchObject({ recipients: ['palmer@example.com'], text: 'E2E message' });
  expect(payload.attachments.map(a => a.filename)).toEqual(['report.txt']);
  await expect(page.locator('.composer textarea')).toHaveValue('E2E message');
  await expect(page.locator('.composer .chosen-file')).toHaveCount(1);
});

test('contacts drawer opens from ?contacts=1', async ({ page }) => {
  await open(page, '/mail-chat?contacts=1');
  await expect(page.locator('.el-drawer:visible .friend-request input')).toBeVisible();
});
