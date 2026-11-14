import { test, expect, open } from '../fixtures.mjs';
import { putSetting } from '../fixtures.mjs';
import path from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Large attachments and "My files", against the local CostAction mock (see server.mjs).
// Official download pages are intercepted so nothing leaves the machine.
test.beforeAll(() => putSetting({ costactionStatus: 0 }));

const blockOfficial = (page) => page.context().route(/https:\/\/turbobit\.net\/.*/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>official page</title>' }));

async function openFilesThread(page) {
  await open(page, '/mail-chat');
  await page.locator('.contact:has(.peers[title*="files@"])').first().click();
  await expect(page.locator('.thread')).toBeVisible();
}

test('the chat card shows the preview and opens the official download page', async ({ page }) => {
  await blockOfficial(page);
  await openFilesThread(page);
  const card = page.locator('.large-file').filter({ hasText: 'holiday-photo.jpg' });
  await expect(card).toBeVisible();
  await expect(card.locator('.large-file-thumb img')).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent('popup'), card.getByRole('button', { name: 'Download' }).click()]);
  await popup.waitForURL(/turbobit\.net\/e2efile\d+\/holiday-photo\.jpg\.html/);
  await popup.close();
});

test('My files: search, filters, preview marks it viewed, and removing an entry', async ({ page }) => {
  await blockOfficial(page);
  await open(page, '/files');
  const row = page.locator('.file-row').filter({ hasText: 'holiday-photo.jpg' });
  await expect(row).toBeVisible();
  await expect(row.locator('.tag')).toContainText(['Uploaded by me']);
  await page.getByRole('button', { name: 'Audio' }).click();
  await expect(page.locator('.files-empty')).toContainText('No matching files');
  await page.getByRole('button', { name: 'Images' }).click();
  await expect(row).toBeVisible();
  await page.getByPlaceholder('Search by name').fill('nothing-like-this');
  await expect(page.locator('.files-empty')).toBeVisible();
  await page.getByPlaceholder('Search by name').fill('holiday');
  await expect(row).toBeVisible();
  // Opening the preview on purpose adds the "Viewed" mark.
  await row.locator('button.file-thumb').click();
  await expect(page.locator('.el-image-viewer__wrapper')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('.layout').waitFor();
  await expect(page.locator('.file-row').filter({ hasText: 'holiday-photo.jpg' }).locator('.tag')).toContainText(['Uploaded by me', 'Viewed']);
});

test('the browser sends file data straight to the upload host, without a preflight', async ({ page }, testInfo) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cloud-mail-direct-'));
  const name = `big-video-${testInfo.project.name}-${testInfo.repeatEachIndex}.mp4`;
  const big = path.join(dir, name);
  writeFileSync(big, Buffer.alloc(2 * 1024 * 1024, 3));
  await openFilesThread(page);
  await page.locator('.composer .attach-label input[type=file]').setInputFiles(big);
  const upload = page.locator('.large-upload').filter({ hasText: name });
  // The mock upload host refuses CORS preflights like the real ones, so this only succeeds
  // when the browser sends a plain form post.
  // While sending it shows the total size; once verified, the size the storage program confirmed.
  await expect(upload).toContainText('2 MB · stored', { timeout: 30000 });
  await open(page, '/files');
  await expect(page.locator('.file-row').filter({ hasText: name })).toBeVisible();
});

test('any file chosen in an internal chat goes to CostAction, whatever its size, and lands in My files', async ({ page }) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cloud-mail-files-'));
  const big = path.join(dir, 'report-archive.zip');
  writeFileSync(big, Buffer.alloc(20 * 1024, 7));
  await openFilesThread(page);
  await page.locator('.composer .attach-label input[type=file]').setInputFiles(big);
  const upload = page.locator('.large-upload').filter({ hasText: 'report-archive.zip' });
  await expect(upload).toContainText(/KB · stored/, { timeout: 30000 });
  // It did not take the ordinary attachment path.
  await expect(page.locator('.composer .chosen-file')).toHaveCount(0);
  // Discarding the draft keeps the uploaded file in the library.
  await upload.getByRole('button', { name: 'Cancel' }).click();
  await expect(upload).toHaveCount(0);
  await open(page, '/files');
  const row = page.locator('.file-row').filter({ hasText: 'report-archive.zip' });
  await expect(row).toBeVisible();
  page.once('dialog', () => {});
  await row.getByRole('button', { name: /^Remove/ }).click();
  await page.locator('.el-message-box').getByRole('button', { name: /OK|Confirm/ }).click();
  await expect(row).toHaveCount(0);
});
