import languages from './languages.json' with { type: 'json' };
export { languages };
export function matchLanguage(value) {
  if (typeof value !== 'string') return null;
  const code = value.replace(/_/g, '-').toLowerCase();
  if (/^zh(?:-|$)/.test(code)) {
    if (code.includes('hans')) return 'zh';
    return /(?:hant|tw|hk|mo)/.test(code) ? 'zh-TW' : 'zh';
  }
  if (/^pt(?:-|$)/.test(code)) return 'pt-BR';
  return (
    languages.find(
      (language) =>
        language.code.toLowerCase() === code || language.code.toLowerCase() === code.split('-')[0]
    )?.code || null
  );
}
export function chooseLanguage(preference, browserLanguages = []) {
  return matchLanguage(preference) || browserLanguages.map(matchLanguage).find(Boolean) || 'en';
}
