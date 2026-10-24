// Model downloads are initiated only by an explicit user action.
export async function localTranslationAvailable(scope = globalThis) {
  try {
    return !!scope.Translator && !!scope.LanguageDetector &&
      await scope.LanguageDetector.availability() === 'available';
  } catch { return false; }
}

export async function prepareLocalTranslation(target, scope = globalThis) {
  let detector, translator;
  try {
    if (!scope.LanguageDetector || !scope.Translator) return false;
    if (await scope.LanguageDetector.availability() === 'unavailable') return false;
    detector = await scope.LanguageDetector.create();
    const targetLanguage = target.toLowerCase() === 'zh-cn' ? 'zh' : target.toLowerCase() === 'zh-tw' ? 'zh-Hant' : target;
    {
      const options = { sourceLanguage: targetLanguage === 'en' ? 'zh' : 'en', targetLanguage };
      if (await scope.Translator.availability(options) !== 'unavailable') translator = await scope.Translator.create(options);
    }
    return true;
  } catch { return false; }
  finally { detector?.destroy(); translator?.destroy(); }
}

export async function translateLocally(text, target, signal, scope = globalThis) {
  if (!await localTranslationAvailable(scope)) return null;
  const selected = Array.from(text || '').slice(0, 5000).join('');
  let detector, translator;
  try {
    signal?.throwIfAborted();
    detector = await scope.LanguageDetector.create();
    const [detected] = await detector.detect(selected, { signal });
    if (!detected?.detectedLanguage || detected.confidence < 0.7) return null;
    const source = detected.detectedLanguage;
    const language = value => value.toLowerCase().replace(/^zh-cn$/, 'zh').replace(/^zh-tw$/, 'zh-hant');
    const sourceLanguage = language(source), targetLanguage = language(target);
    if (sourceLanguage === targetLanguage) return { text: selected, detectedLanguage: source, truncated: selected.length < text.length, provider: 'local' };
    const options = { sourceLanguage, targetLanguage };
    if (await scope.Translator.availability(options) !== 'available') return null;
    translator = await scope.Translator.create(options);
    const translated = await translator.translate(selected, { signal });
    signal?.throwIfAborted();
    return { text: translated, detectedLanguage: source, truncated: selected.length < text.length, provider: 'local' };
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  } finally {
    detector?.destroy();
    translator?.destroy();
  }
}
