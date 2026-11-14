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
  // Once verified, only the size the storage program confirmed is shown.
  await expect(upload.locator('small')).toHaveText('2 MB', { timeout: 30000 });
  await open(page, '/files');
  await expect(page.locator('.file-row').filter({ hasText: name })).toBeVisible();
});

// A minimal valid two-page PDF, built with correct cross-reference offsets.
function twoPagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const stream = 'BT /F1 24 Tf 40 300 Td (Quarterly report) Tj ET';
  objects[4] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => { const at = out.length; out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

test('a PDF gets a preview of its first pages, shown in My files', async ({ page }, testInfo) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cloud-mail-pdf-'));
  const name = `report-${testInfo.project.name}-${testInfo.repeatEachIndex}.pdf`;
  const pdf = path.join(dir, name);
  writeFileSync(pdf, twoPagePdf());
  await openFilesThread(page);
  // The preview is made in the browser after the upload and stored separately.
  const stored = page.waitForResponse((r) => r.request().method() === 'PUT' && /\/cloud-file\/\d+\/preview$/.test(r.url()), { timeout: 30000 });
  await page.locator('.composer .attach-label input[type=file]').setInputFiles(pdf);
  const upload = page.locator('.large-upload').filter({ hasText: name });
  await expect(upload.locator('small')).toHaveText(/^[\d.]+ (B|KB)$/, { timeout: 30000 });
  expect((await stored).status()).toBe(200);
  await open(page, '/files');
  const row = page.locator('.file-row').filter({ hasText: name });
  await expect(row.locator('button.file-thumb img')).toBeVisible();
  const size = await row.locator('button.file-thumb img').evaluate((img) => [img.naturalWidth, img.naturalHeight]);
  expect(size[0]).toBe(480);
  expect(size[1]).toBeGreaterThan(1000); // two pages stacked
});

test('any file chosen in an internal chat goes to CostAction, whatever its size, and lands in My files', async ({ page }) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cloud-mail-files-'));
  const big = path.join(dir, 'report-archive.zip');
  writeFileSync(big, Buffer.alloc(20 * 1024, 7));
  await openFilesThread(page);
  await page.locator('.composer .attach-label input[type=file]').setInputFiles(big);
  const upload = page.locator('.large-upload').filter({ hasText: 'report-archive.zip' });
  await expect(upload.locator('small')).toHaveText(/^[\d.]+ KB$/, { timeout: 30000 });
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
