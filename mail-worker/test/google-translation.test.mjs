import test from 'node:test';
import assert from 'node:assert/strict';
import { googleTranslate, consumeTranslationQuota } from '../src/lib/google-translation.js';
import { errorMetadata } from '../src/lib/error-keys.js';
import { chooseLanguage, matchLanguage, languages } from '../../shared/locale-utils.mjs';

test('language matching preserves explicit preferences, scripts and browser priorities', () => {
	assert.equal(languages.length, 20);
	for (const [value, expected] of [
		['zh-HK', 'zh-TW'],
		['zh-Hant', 'zh-TW'],
		['zh-Hans-HK', 'zh'],
		['zh-SG', 'zh'],
		['pt-PT', 'pt-BR'],
		['en-US', 'en'],
		['ar-EG', 'ar'],
		['fr_CA', 'fr']
	])
		assert.equal(matchLanguage(value), expected);
	assert.equal(chooseLanguage('ja', ['en', 'zh-TW']), 'ja');
	assert.equal(chooseLanguage(null, ['unsupported', 'uk-UA', 'en']), 'uk');
	assert.equal(chooseLanguage(null, ['unsupported']), 'en');
});
test('official translation sends only selected plain text and keeps credentials out of URLs', async () => {
	const translated = await googleTranslate(
		'Hello <b>world</b>',
		'fr',
		'test-secret',
		async (url, options) => {
			assert.equal(url, 'https://translation.googleapis.com/language/translate/v2');
			assert.equal(options.headers['X-Goog-Api-Key'], 'test-secret');
			assert.deepEqual(JSON.parse(options.body), {
				q: 'Hello <b>world</b>',
				target: 'fr',
				format: 'text'
			});
			return Response.json({
				data: {
					translations: [
						{
							translatedText: 'Bonjour &amp; &lt;b&gt;monde&lt;/b&gt;',
							detectedSourceLanguage: 'en'
						}
					]
				}
			});
		}
	);
	assert.deepEqual(translated, { text: 'Bonjour & <b>monde</b>', detectedLanguage: 'en' });
	for (const [status, expected] of [
		[403, 'translateErrorKey'],
		[429, 'translateErrorQuota'],
		[500, 'translateErrorProvider']
	]) {
		await assert.rejects(
			googleTranslate(
				'Hello',
				'fr',
				'secret',
				async () => new Response('private provider detail', { status })
			),
			(e) => e.key === expected && !e.message.includes('private')
		);
	}
	await assert.rejects(
		googleTranslate('Hello', 'fr', 'secret', async () => {
			throw Error('secret transport failure');
		}),
		(e) => e.key === 'translateErrorNetwork'
	);
});
test('Google diagnostics classify invalid keys, disabled services, billing, restrictions and quotas without exposing provider details', async () => {
	for (const [status, reason, expected] of [
		[400, 'API_KEY_INVALID', 'translateErrorKey'],
		[403, 'SERVICE_DISABLED', 'translateErrorApiDisabled'],
		[403, 'BILLING_DISABLED', 'translateErrorBilling'],
		[403, 'API_KEY_HTTP_REFERRER_BLOCKED', 'translateErrorRestriction'],
		[403, 'API_KEY_SERVICE_BLOCKED', 'translateErrorRestriction'],
		[403, 'userRateLimitExceeded', 'translateErrorQuota'],
		[500, 'INTERNAL', 'translateErrorProvider']
	]) {
		await assert.rejects(googleTranslate('Hello', 'fr', 'private-key', async () => Response.json({
			error: { message: 'private provider detail', details: [{ reason }], errors: [{ reason }] }
		}, { status })), error => error.key === expected && !error.message.includes('private'));
	}
	await assert.rejects(googleTranslate('Hello', 'fr', 'private-key', async () => Response.json({
		error: { message: 'API key not valid. Please pass a valid API key.' }
	}, { status: 400 })), error => error.key === 'translateErrorKey');
	await assert.rejects(googleTranslate('Hello', 'fr', 'private-key', async () => Response.json({ error: { details: 'bad schema', errors: null } }, { status: 500 })), error => error.key === 'translateErrorProvider');
});
function storage() {
	const values = new Map();
	let chain = Promise.resolve();
	return {
		transaction(action) {
			const result = chain.then(() =>
				action({
					get: async (key) => structuredClone(values.get(key)),
					put: async (entries) => {
						for (const [key, value] of Object.entries(entries))
							values.set(key, structuredClone(value));
					}
				})
			);
			chain = result.catch(() => {});
			return result;
		}
	};
}
test('atomic translation quotas enforce daily, minute and site limits and reset at UTC midnight', async () => {
	const state = storage(),
		now = Date.parse('2026-10-23T12:00:00Z');
	const params = { userId: 1, characters: 100, userLimit: 3, siteLimit: 1000 };
	const results = await Promise.all(
		Array.from({ length: 12 }, () => consumeTranslationQuota(state, params, now))
	);
	assert.equal(results.filter(Boolean).length, 3);
	assert.equal(await consumeTranslationQuota(state, params, now + 86400000), true);
	const burst = storage();
	assert.equal(
		(
			await Promise.all(
				Array.from({ length: 12 }, () =>
					consumeTranslationQuota(burst, { ...params, userLimit: 100, siteLimit: 100000 }, now)
				)
			)
		).filter(Boolean).length,
		10
	);
	const site = storage();
	assert.equal(await consumeTranslationQuota(site, { ...params, characters: 600 }, now), true);
	assert.equal(
		await consumeTranslationQuota(site, { ...params, userId: 2, characters: 600 }, now),
		false
	);
	assert.equal(await consumeTranslationQuota(site, { ...params, characters: 5001 }, now), false);
});
test('server errors have stable localization keys without altering unknown diagnostic messages', () => {
	assert.equal(errorMetadata('Incorrect password').errorKey, 'server_IncorrectPwd');
	assert.equal(errorMetadata('密码输入错误').errorKey, 'server_IncorrectPwd');
	assert.equal(errorMetadata('translateErrorQuota').errorKey, 'translateErrorQuota');
	assert.deepEqual(errorMetadata('Some unknown error'), {});
});
