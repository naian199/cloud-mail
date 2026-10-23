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

await test('all active site users send directly without friendship, mail permission or daily quota', async () => {
	const a = await user(),
		b = await user(),
		outsider = await user();
	const role = db
		.prepare(
			"INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'ban',1,1,0,'','')"
		)
		.run('direct-' + randomUUID(), 'direct-' + randomUUID());
	db.prepare('UPDATE user SET type=?,send_count=9999 WHERE email=?').run(
		Number(role.lastInsertRowid),
		a.email
	);
	a.token = (await api('login', null, 'POST', { email: a.email, password: a.password })).data.token;
	const send = (u, recipients, text, clientId = randomUUID(), accountId = u.account) =>
		api('mail-chat/send', u, 'POST', {
			accountId,
			recipients,
			subject: 'Direct message',
			text,
			clientId
		});
	const first = await send(a, [b.email], 'No friendship required');
	assert.equal(first.code, 200);
	const key = first.data.conversationKey;
	assert.equal((await api('chat/friends', a)).data.length, 0);
	const client = randomUUID();
	const one = await send(a, [b.email], 'Idempotent direct message', client);
	assert.equal(one.code, 200);
	assert.equal(
		(await send(a, [b.email], 'Idempotent direct message', client)).data.emailId,
		one.data.emailId
	);
	for (let i = 0; i < 25; i++)
		assert.equal((await send(a, [b.email], 'Unrestricted direct ' + i)).code, 200);
	assert.equal(
		Number(db.prepare('SELECT send_count AS n FROM user WHERE email=?').get(a.email).n),
		9999
	);
	const peerKey = (await conversations(b))[0].key;
	assert((await messages(b, peerKey)).some((m) => m.replyText === 'Unrestricted direct 24'));
	assert.equal(
		(await send(outsider, [b.email], 'Forged mailbox', randomUUID(), a.account)).code,
		403
	);
	assert.equal((await send(a, ['outside@example.net'], 'External remains denied')).code, 403);
	const all = await messages(a, key);
	const last = all[all.length - 1];
	assert.equal(
		(
			await api('mail-chat/delete', a, 'POST', {
				accountId: a.account,
				key,
				emailId: last.emailId,
				through: last.emailId
			})
		).code,
		200
	);
	assert(!(await messages(b, peerKey)).some((m) => m.messageId === last.messageId));
	db.prepare('UPDATE user SET status=1 WHERE email=?').run(b.email);
	assert.equal(
		(
			await api('mail-chat/instant', a, 'POST', {
				accountId: a.account,
				recipients: [b.email],
				subject: 'Disabled',
				text: 'Cannot deliver',
				clientId: randomUUID()
			})
		).code,
		403
	);
	db.prepare('UPDATE user SET status=1 WHERE email=?').run(a.email);
	assert.notEqual((await send(a, [outsider.email], 'Disabled sender')).code, 200);
});
db.close();
