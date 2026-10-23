import { reactive } from 'vue';
import http from '@/axios';

const key = 'cloud-mail:auto-translation';
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(key) || '{}') || {};
} catch {
  /* Invalid saved preference. */
}
export const autoTranslation = reactive({
  enabled: saved.enabled === true,
  target: saved.target || ''
});
export function saveAutoTranslation() {
  try {
    localStorage.setItem(key, JSON.stringify(autoTranslation));
  } catch {
    /* Private browsing storage may be unavailable. */
  }
}
let queue = Promise.resolve();
let nextRequest = 0;
// Share one queue between message bubbles to respect the platform's per-user rate limit.
export function scheduleAutoTranslation(eligible, run) {
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (!eligible()) return;
      const delay = Math.max(0, nextRequest - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (!eligible()) return;
      nextRequest = Date.now() + 6500;
      await run();
    });
  return queue;
}
export async function translationAvailability() {
  return http.get('/mail-chat/translation/config', { noMsg: true });
}
