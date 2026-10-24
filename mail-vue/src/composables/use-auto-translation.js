import { reactive } from 'vue';
import http from '@/axios';
import { languages, chooseLanguage } from '../../../shared/locale-utils.mjs';
import { localTranslationAvailable } from '@/utils/local-translation.mjs';

const key = 'cloud-mail:auto-translation';
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(key) || '{}') || {};
} catch {
  /* Invalid saved preference. */
}
export const autoTranslation = reactive({
  enabled: saved.enabled !== false,
  cloudConsent: saved.cloudConsent === true || (saved.cloudConsent === undefined && saved.enabled === true),
  followInterface: saved.followInterface !== false,
  target: saved.target || languages.find(language => language.code === chooseLanguage(null, navigator.languages || [navigator.language]))?.google || 'en'
});
export const translationStatus = reactive({ error: '' });
export function syncTranslationLanguage(locale) {
  if (autoTranslation.followInterface) {
    autoTranslation.target = languages.find(language => language.code === locale)?.google || 'en';
  }
}
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
  if (await localTranslationAvailable()) return { enabled: true, local: true };
  return http.get('/mail-chat/translation/config', { noMsg: true });
}
