import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const root = new URL(process.env.MAIL_CHAT_TEST_URL || 'http://127.0.0.1:8787/');
if (
	!['127.0.0.1', 'localhost', '[::1]'].includes(root.hostname) ||
	!process.env.MAIL_CHAT_TEST_SQLITE
)
	throw Error('Initialized local Worker and SQLite required');
const db = new DatabaseSync(process.env.MAIL_CHAT_TEST_SQLITE);
db.exec('PRAGMA busy_timeout=5000');
async function api(path, u, method = 'GET', body) {
	return (
		await fetch(new URL('api/' + path, root), {
			method,
			headers: { 'Content-Type': 'application/json', ...(u ? { Authorization: u.token } : {}) },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	).json();
}
async function user() {
	const credentials = {
		email: `profile${randomBytes(6).toString('hex')}@example.com`,
		password: randomBytes(12).toString('hex')
	};
	assert.equal((await api('register', null, 'POST', credentials)).code, 200);
	const l = await api('login', null, 'POST', credentials);
	const p = await api('my/loginUserInfo', { token: l.data.token });
	return {
		...credentials,
		token: l.data.token,
		account: p.data.account.accountId,
		userId: p.data.userId
	};
}
async function conversations(u) {
	const r = await api(`mail-chat/conversations?accountId=${u.account}`, u);
	assert.equal(r.code, 200);
	return r.data.conversations;
}
async function messages(u, key) {
	const r = await api(`mail-chat/messages?accountId=${u.account}&key=${key}`, u);
	assert.equal(r.code, 200);
	return r.data.messages;
}
await test('language preferences and translation configuration enforce account permissions', async (t) => {
	const a = await user(),
		b = await user(),
		admin = await user();
	assert.equal((await api('my/locale', null)).code, 401);
	assert.equal((await api('my/locale', a, 'PUT', { locale: 'ar' })).code, 200);
	assert.equal((await api('my/loginUserInfo', a)).data.locale, 'ar');
	assert.equal((await api('my/locale', b)).data.locale, null);
	assert.equal((await api('my/locale', a, 'PUT', { locale: 'not-supported' })).code, 400);
	assert.equal((await api('setting/translation', a)).code, 403);
	assert.equal((await api('setting/translation', a, 'PUT', { enabled: true })).code, 403);
	const role = db
		.prepare(
			"INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'ban',0,5,0,'','')"
		)
		.run('translation-' + randomUUID(), 'translation-' + randomUUID());
	db.prepare(
		"INSERT INTO role_perm(role_id,perm_id) SELECT ?,perm_id FROM perm WHERE perm_key IN ('setting:set','setting:query') AND type=2"
	).run(Number(role.lastInsertRowid));
	db.prepare('UPDATE user SET type=? WHERE email=?').run(Number(role.lastInsertRowid), admin.email);
	const old = await api('setting/translation', admin);
	assert.equal(old.code, 200);
	if (old.data.configured) {
		t.skip('Existing local translation credentials must be preserved');
		return;
	}
	try {
		const key = 'AIzaLocalOnlyTranslationFixture00000000';
		const config = { enabled: false, apiKey: key, userLimit: 20, siteLimit: 50000 };
		assert.equal((await api('setting/translation', admin, 'PUT', config)).code, 200);
		for (const who of [admin, a]) {
			const response = await api(
				who === admin ? 'setting/translation' : 'mail-chat/translation/config',
				who
			);
			assert(!JSON.stringify(response).includes(key));
			assert.equal(response.data.configured, true);
			assert.equal(response.data.enabled, false);
		}
		assert.equal(
			(await api('setting/translation', admin, 'PUT', { ...config, userLimit: 0 })).code,
			400
		);
		assert.equal(
			(
				await api('setting/translation', admin, 'PUT', {
					...config,
					apiKey: '',
					clearKey: true,
					enabled: true
				})
			).code,
			400
		);
		const friend = await api('chat/friends', a, 'POST', { email: b.email });
		assert.equal(
			(await api('chat/friends/' + friend.data.id, b, 'PUT', { accept: true })).code,
			200
		);
		const sent = await api('mail-chat/instant', a, 'POST', {
			accountId: a.account,
			recipients: [b.email],
			text: 'Private text only',
			subject: 'Translation test',
			clientId: randomUUID()
		});
		assert.equal(sent.code, 200);
		const c = (await conversations(b)).find((c) => c.peers.includes(a.email));
		const m = (await messages(b, c.key))[0];
		assert.equal(
			(await api('mail-chat/translate', b, 'POST', { emailId: m.emailId, target: 'invalid' })).code,
			400
		);
		assert.equal(
			(await api('mail-chat/translate', a, 'POST', { emailId: m.emailId, target: 'fr' })).code,
			404
		);
		const disabled = await api('mail-chat/translate', b, 'POST', {
			emailId: m.emailId,
			target: 'fr'
		});
		assert.equal(disabled.code, 503);
		assert.equal(disabled.errorKey, 'translateErrorDisabled');
		assert.equal(
			(await api('setting/translation', admin, 'PUT', { ...config, enabled: true })).code,
			200
		);
		const admitted = await api('mail-chat/translate', b, 'POST', {
			emailId: m.emailId,
			target: 'fr'
		});
		assert(
			['translateErrorKey', 'translateErrorProvider', 'translateErrorTimeout'].includes(
				admitted.errorKey
			),
			'Real quota storage must admit the request before an invalid fixture key fails'
		);
		assert.equal(
			(
				await api('mail-chat/delete', b, 'POST', {
					accountId: b.account,
					key: c.key,
					through: m.emailId,
					emailId: m.emailId
				})
			).code,
			200
		);
		assert.equal(
			(await api('mail-chat/translate', b, 'POST', { emailId: m.emailId, target: 'fr' })).code,
			404
		);
	} finally {
		assert.equal(
			(
				await api('setting/translation', admin, 'PUT', {
					enabled: false,
					apiKey: '',
					clearKey: true,
					userLimit: 20,
					siteLimit: 50000
				})
			).code,
			200
		);
	}
});
