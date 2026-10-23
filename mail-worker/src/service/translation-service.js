import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import mail from './mail-chat-service';
import live from './mail-live-service';
import { addresses, conversation } from '../lib/mail-conversations';
import { googleTranslate } from '../lib/google-translation';
import languages from '../../../shared/languages.json';

const CONFIG_KEY = 'cloud-mail:google-translation';
const defaults = { enabled: false, apiKey: '', userLimit: 20, siteLimit: 50000 };
const fail = (key, code = 400) => {
	throw new BizError(key, code);
};

export default {
	async config(c) {
		return { ...defaults, ...(await c.env.kv.get(CONFIG_KEY, { type: 'json' })) };
	},
	publicConfig(config) {
		return {
			enabled: !!config.enabled && !!config.apiKey,
			configured: !!config.apiKey,
			userLimit: config.userLimit,
			siteLimit: config.siteLimit
		};
	},
	async save(c, params) {
		const old = await this.config(c);
		const { enabled, userLimit, siteLimit, apiKey, clearKey } = params || {};
		if (
			typeof enabled !== 'boolean' ||
			!Number.isSafeInteger(userLimit) ||
			userLimit < 1 ||
			userLimit > 1000 ||
			!Number.isSafeInteger(siteLimit) ||
			siteLimit < 1000 ||
			siteLimit > 1000000 ||
			(apiKey !== undefined && typeof apiKey !== 'string') ||
			(clearKey !== undefined && typeof clearKey !== 'boolean')
		)
			fail('translateErrorConfig');
		const key = clearKey ? '' : apiKey?.trim() || old.apiKey;
		if ((key && !/^[A-Za-z0-9_-]{20,200}$/.test(key)) || (enabled && !key))
			fail('translateErrorConfig');
		const config = { enabled, apiKey: key, userLimit, siteLimit };
		await c.env.kv.put(CONFIG_KEY, JSON.stringify(config));
		return this.publicConfig(config);
	},
	async translate(c, params) {
		const { emailId, target } = params || {};
		if (
			!Number.isSafeInteger(emailId) ||
			emailId < 1 ||
			!languages.some((lang) => lang.google === target)
		)
			fail('translateErrorInvalid');
		let message;
		try {
			message = await mail.detail(c, emailId);
		} catch (error) {
			if (error.code === 404 || error.code === 403) fail('translateErrorUnavailable', 404);
			throw error;
		}
		const account = await mail.account(c, message.accountId);
    const thread = message.conversationKey
      ? { key: message.conversationKey, peers: addresses(message.conversationPeers) }
      : await conversation(message, { email: account.email });
		const peer = await live.resolve(c, account, thread.key);
		const own =
			thread.peers.length === 1
				? await c.env.db
						.prepare(
							'SELECT 1 FROM account WHERE user_id=? AND email=? COLLATE NOCASE AND is_del=0 AND status=0 LIMIT 1'
						)
						.bind(account.user_id, thread.peers[0])
						.first()
				: null;
		const text = String(peer || own ? message.replyText : message.text).trim();
		if (!text) fail('translateErrorEmpty');
		const config = await this.config(c);
		if (!config.enabled || !config.apiKey) fail('translateErrorDisabled', 503);
		if (!c.env.CHAT_NOTIFICATIONS) fail('translateErrorBinding', 503);
    // 10,000 UTF-16 units contain at least the first 5,000 Unicode characters.
    const selected = Array.from(text.slice(0, 10000)).slice(0, 5000).join('');
		const stub = c.env.CHAT_NOTIFICATIONS.get(
			c.env.CHAT_NOTIFICATIONS.idFromName('translation-site-quota')
		);
		const permit = await stub.fetch('https://chat.internal/translation/permit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: userContext.getUserId(c),
				characters: Array.from(selected).length,
				userLimit: config.userLimit,
				siteLimit: config.siteLimit
			})
		});
		if (!permit.ok)
			fail(
				permit.status === 429 ? 'translateErrorQuota' : 'translateErrorBinding',
				permit.status === 429 ? 429 : 503
			);
		try {
			const result = await googleTranslate(selected, target, config.apiKey);
			return { ...result, target, truncated: selected.length < text.length };
		} catch (error) {
			fail(error.key || 'translateErrorProvider', error.code || 502);
		}
	}
};
