import { parseHTML } from 'linkedom';

export class TranslationError extends Error {
	constructor(key, code = 502) {
		super(key);
		this.key = key;
		this.code = code;
	}
}

// Official Cloud Translation API only. Never put the API key or message in a URL.
export async function googleTranslate(text, target, apiKey, fetcher = fetch) {
	const abort = new AbortController();
	const timeout = setTimeout(() => abort.abort(), 15000);
	try {
		const response = await fetcher('https://translation.googleapis.com/language/translate/v2', {
			method: 'POST',
			signal: abort.signal,
			headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
			body: JSON.stringify({ q: text, target, format: 'text' })
		});
		if (!response.ok) {
			if ([401, 403].includes(response.status))
				throw new TranslationError('translateErrorKey', 503);
			if (response.status === 429) throw new TranslationError('translateErrorQuota', 429);
			throw new TranslationError('translateErrorProvider');
		}
		const data = await response.json();
		const result = data?.data?.translations?.[0];
		if (typeof result?.translatedText !== 'string' || result.translatedText.length > 100000)
			throw new TranslationError('translateErrorProvider');
		const { document } = parseHTML(`<html><body>${result.translatedText}</body></html>`);
		return {
			text: document.body.textContent || '',
			detectedLanguage: result.detectedSourceLanguage || null
		};
	} catch (error) {
		if (error instanceof TranslationError) throw error;
		throw new TranslationError(
			abort.signal.aborted ? 'translateErrorTimeout' : 'translateErrorProvider'
		);
	} finally {
		clearTimeout(timeout);
	}
}

export async function consumeTranslationQuota(storage, params, now = Date.now()) {
	const { userId, characters, userLimit, siteLimit } = params;
	if (
		![userId, characters, userLimit, siteLimit].every(Number.isSafeInteger) ||
		userId < 1 ||
		characters < 1 ||
		characters > 5000 ||
		userLimit < 1 ||
		userLimit > 1000 ||
		siteLimit < 1000 ||
		siteLimit > 1000000
	)
		return false;
	const day = new Date(now).toISOString().slice(0, 10),
		minute = Math.floor(now / 60000);
	return storage.transaction(async (txn) => {
		const userKey = `translation-user:${userId}`;
		const storedUser = await txn.get(userKey),
			storedSite = await txn.get('translation-site');
		const user = storedUser?.day === day ? storedUser : { day, count: 0, minute, minuteCount: 0 };
		const site = storedSite?.day === day ? storedSite : { day, characters: 0 };
		if (user.minute !== minute) {
			user.minute = minute;
			user.minuteCount = 0;
		}
		if (
			user.count >= userLimit ||
			user.minuteCount >= 10 ||
			site.characters + characters > siteLimit
		)
			return false;
		await txn.put({
			[userKey]: { ...user, count: user.count + 1, minuteCount: user.minuteCount + 1 },
			'translation-site': { day, characters: site.characters + characters }
		});
		return true;
	});
}
