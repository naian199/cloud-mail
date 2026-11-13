import { test, expect, open } from '../fixtures.mjs';

const row = (page, text) => page.locator('.email-row', { hasText: text }).first();

test('context menu offers the inbox actions', async ({ page }) => {
  await open(page, '/inbox');
  await row(page, 'Newsletter number 2').click({ button: 'right' });
  const menu = page.locator('.el-dropdown-menu:visible').last();
  await expect(menu).toContainText('Mark as Read');
  await expect(menu).toContainText('Reply');
  await expect(menu).toContainText('Star');
  await expect(row(page, 'Newsletter number 2')).toHaveClass(/right-checked/);
  // Clicking a row while the menu is open only closes the menu.
  const box = await row(page, 'Newsletter number 3').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.el-dropdown-menu:visible')).toHaveCount(0);
  await expect(page).toHaveURL(/\/inbox$/);
});

test('star from the context menu', async ({ page }, testInfo) => {
  // Projects share the backend; each stars its own message so neither undoes the other.
  const subject = testInfo.project.name === 'phone' ? 'Newsletter number 3' : 'Newsletter number 1';
  await open(page, '/inbox');
  await row(page, subject).click({ button: 'right' });
  await page.locator('.el-dropdown-menu:visible').last().locator('.el-dropdown-menu__item', { hasText: 'Star' }).click();
  await open(page, '/starred');
  await expect(row(page, subject)).toBeVisible();
});

test('opening a message shows it in the sandboxed frame', async ({ page }) => {
  await open(page, '/inbox');
  await row(page, 'Newsletter number 4').click();
  await expect(page).toHaveURL(/\/mail$/);
  const cell = page.frameLocator('.mail-content iframe').locator('td');
  await expect(cell).toContainText('Wide newsletter 4');
  // Wide newsletters reflow to the frame instead of being zoomed out.
  expect(await cell.evaluate(td => getComputedStyle(td).fontSize)).toBe('14px');
});
