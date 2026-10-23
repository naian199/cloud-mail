import { createI18n } from 'vue-i18n';
import { shallowRef } from 'vue';
import en from './en.js';
import zh from './zh.js';
import enExtra from '../../../shared/additional-interface-en.json';
import zhExtra from '../../../shared/additional-interface-zh.json';
import enErrors from '../../../mail-worker/src/i18n/en.js';
import zhErrors from '../../../mail-worker/src/i18n/zh.js';
import enUi from 'element-plus/es/locale/lang/en.mjs';
import { languages, chooseLanguage } from '../../../shared/locale-utils.mjs';
export { languages, chooseLanguage };
const errors = (source) =>
  Object.fromEntries(
    Object.entries(source)
      .filter(([, v]) => typeof v === 'string')
      .map(([key, value]) => [`server_${key}`, value.replace(/\{\{(\w+)\}\}/g, '{$1}')])
  );
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: { ...en, ...enExtra, ...errors(enErrors) },
    zh: { ...zh, ...zhExtra, ...errors(zhErrors) }
  }
});
export const elementLocale = shallowRef(enUi);
const packs = import.meta.glob('./locales/*.json', { import: 'default' });
const uiPacks = {
  zh: () => import('element-plus/es/locale/lang/zh-cn.mjs'),
  'zh-TW': () => import('element-plus/es/locale/lang/zh-tw.mjs'),
  en: () => import('element-plus/es/locale/lang/en.mjs'),
  ja: () => import('element-plus/es/locale/lang/ja.mjs'),
  ko: () => import('element-plus/es/locale/lang/ko.mjs'),
  fr: () => import('element-plus/es/locale/lang/fr.mjs'),
  de: () => import('element-plus/es/locale/lang/de.mjs'),
  es: () => import('element-plus/es/locale/lang/es.mjs'),
  'pt-BR': () => import('element-plus/es/locale/lang/pt-br.mjs'),
  ru: () => import('element-plus/es/locale/lang/ru.mjs'),
  ar: () => import('element-plus/es/locale/lang/ar.mjs'),
  hi: () => import('element-plus/es/locale/lang/hi.mjs'),
  id: () => import('element-plus/es/locale/lang/id.mjs'),
  vi: () => import('element-plus/es/locale/lang/vi.mjs'),
  th: () => import('element-plus/es/locale/lang/th.mjs'),
  tr: () => import('element-plus/es/locale/lang/tr.mjs'),
  it: () => import('element-plus/es/locale/lang/it.mjs'),
  nl: () => import('element-plus/es/locale/lang/nl.mjs'),
  uk: () => import('element-plus/es/locale/lang/uk.mjs'),
  ms: () => import('element-plus/es/locale/lang/ms.mjs')
};
let revision = 0;
export async function activateLanguage(value) {
  const code = chooseLanguage(value),
    mine = ++revision;
  if (!i18n.global.availableLocales.includes(code)) {
    const loader = packs[`./locales/${code}.json`];
    if (!loader) throw Error('Language pack missing');
    i18n.global.setLocaleMessage(code, await loader());
  }
  const ui = await uiPacks[code]();
  if (mine !== revision) return false;
  i18n.global.locale.value = code;
  elementLocale.value = ui.default;
  const language = languages.find((item) => item.code === code);
  document.documentElement.lang = language.html;
  document.documentElement.dir = language.dir || 'ltr';
  return true;
}
export default i18n;
