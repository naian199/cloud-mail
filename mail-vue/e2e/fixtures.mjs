import { test as base, expect } from '@playwright/test';
import { API, BASE, ADMIN, PASSWORD } from './env.mjs';

let token;
async function adminToken() {
  if (!token) {
    const response = await fetch(`${API}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ADMIN, password: PASSWORD }) });
    token = (await response.json()).data.token;
  }
  return token;
}

// `page` is signed in as the seeded admin. The install prompt card appears at
// arbitrary times and covers controls, so it is hidden.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((t) => {
      try { localStorage.setItem('token', t); } catch {}
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '.app-install-card{display:none!important}';
        document.head.append(style);
      });
    }, await adminToken());
    await use(page);
  },
  api: async ({}, use) => {
    const t = await adminToken();
    await use({
      get: async (path) => (await (await fetch(`${API}${path}`, { headers: { Authorization: t } })).json()).data,
      put: async (path, body) => (await (await fetch(`${API}${path}`, { method: 'PUT', headers: { Authorization: t, 'content-type': 'application/json' }, body: JSON.stringify(body) })).json())
    });
  }
});

export { expect, BASE };

// Opens a page and waits for the app shell; the chat list keeps polling, so no networkidle.
export async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.locator('.layout').waitFor();
  await page.waitForTimeout(1500);
}

export const isPhone = (testInfo) => testInfo.project.name === 'phone';
