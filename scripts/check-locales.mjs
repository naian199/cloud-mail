import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import en from '../mail-vue/src/i18n/en.js';
import zh from '../mail-vue/src/i18n/zh.js';
import serverEn from '../mail-worker/src/i18n/en.js';
import serverZh from '../mail-worker/src/i18n/zh.js';
import { languages } from '../shared/locale-utils.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extra = JSON.parse(fs.readFileSync(path.join(root, 'shared/additional-interface-en.json')));
const source = {
  ...en,
  ...extra,
  ...Object.fromEntries(
    Object.entries(serverEn)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => ['server_' + k, v.replace(/\{\{(\w+)\}\}/g, '{$1}')])
  )
};
const params = (value) =>
  [...String(value).matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
const keys = Object.keys(source).sort();
let errors = [];
for (const language of languages) {
  let messages;
  if (language.code === 'en') messages = source;
  else if (language.code === 'zh')
    messages = {
      ...zh,
      ...JSON.parse(fs.readFileSync(path.join(root, 'shared/additional-interface-zh.json'))),
      ...Object.fromEntries(
        Object.entries(serverZh)
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => ['server_' + k, v.replace(/\{\{(\w+)\}\}/g, '{$1}')])
      )
    };
  else
    messages = JSON.parse(
      fs.readFileSync(path.join(root, 'mail-vue/src/i18n/locales', language.code + '.json'))
    );
  for (const key of keys) {
    if (typeof messages[key] !== 'string') errors.push(language.code + ': missing ' + key);
    else if (params(messages[key]) !== params(source[key]))
      errors.push(language.code + ': invalid variables ' + key);
  }
  for (const key of Object.keys(messages))
    if (!(key in source)) errors.push(language.code + ': extra ' + key);
  const confirmation = language.code === 'zh' ? zh.delInputPattern : 'DELETE';
  if (
    messages.delInputPattern !== confirmation ||
    !messages.clearAllDelConfirm.includes('>' + confirmation + '</b>')
  )
    errors.push(language.code + ': unsafe confirmation token');
  if (
    language.code !== 'en' &&
    language.code !== 'zh' &&
    Object.keys(messages).filter((key) => messages[key] !== source[key]).length < keys.length / 2
  )
    errors.push(language.code + ': excessive English copies');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `${languages.length} language catalogs verified; ${keys.length} keys each; interpolation and confirmation tokens match.`
);
