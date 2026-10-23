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
const png =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII=';
await test('profiles, avatars and incremental notifications respect user boundaries', async () => {
	const a = await user(),
		b = await user(),
		outsider = await user();
	assert.equal((await api('my/profile', null)).code, 401);
	assert.equal(
		(
			await api('my/profile', a, 'PUT', {
				displayName: 'Alice',
				bio: 'Hello',
				avatar: png,
				userId: b.userId
			})
		).code,
		200
	);
	assert.equal((await api('my/profile', b)).data.displayName, '');
	assert.equal((await api('my/profile', a)).data.avatar, png);
	assert.equal((await api('my/loginUserInfo', a)).data.profile.displayName, 'Alice');
	for (const invalid of [
		{ displayName: '', bio: '', avatar: '' },
		{ displayName: 'a'.repeat(41), bio: '', avatar: '' },
		{ displayName: 'Alice', bio: 'b'.repeat(201), avatar: '' },
		{ displayName: 'Alice', bio: '', avatar: 'data:image/svg+xml;base64,PHN2Zz4=' },
		{ displayName: 'Alice', bio: '', avatar: 'data:image/png;base64,PHNjcmlwdD4=' }
	])
		assert.equal((await api('my/profile', a, 'PUT', invalid)).code, 400);
	const base = await api('my/notifications', b);
	assert.equal(base.data.messages.length, 0);
	const baseline = base.data.cursor;
	const req = await api('chat/friends', a, 'POST', { email: b.email });
	assert.equal((await api('chat/friends/' + req.data.id, b, 'PUT', { accept: true })).code, 200);
	const sent = await api('mail-chat/instant', a, 'POST', {
		accountId: a.account,
		recipients: [b.email],
		text: 'Live hello',
		subject: 'Chat',
		clientId: randomUUID()
	});
	assert.equal(sent.code, 200);
	const c = (await conversations(b)).find((c) => c.peers.includes(a.email));
	assert.equal(c.profile.displayName, 'Alice');
	assert.equal(c.profile.bio, 'Hello');
	const incoming = (await messages(b, c.key))[0];
	assert.equal(incoming.profile.avatar, png);
	const alerts = await api('my/notifications?after=' + baseline, b);
	assert.equal(alerts.data.messages.length, 1);
	assert.equal(alerts.data.messages[0].displayName, 'Alice');
	assert.equal(alerts.data.messages[0].accountId, b.account);
	assert.equal(
		(await api('my/notifications?after=' + alerts.data.cursor, b)).data.messages.length,
		0
	);
	assert.equal(
		(await api('my/notifications?after=0', a)).data.messages.length,
		0,
		'sent messages do not alert sender'
	);
	assert.equal((await api('my/notifications?after=0', outsider)).data.messages.length, 0);
	assert.equal((await api('my/notifications?after=NaN', b)).code, 400);
	assert.equal(
		(
			await api('mail-chat/read', b, 'PUT', {
				accountId: b.account,
				key: c.key,
				through: incoming.emailId
			})
		).code,
		200
	);
	assert.equal(
		(await api('my/notifications?after=0', b)).data.messages.length,
		0,
		'read messages do not generate stale alerts'
	);
	assert.equal(
		(await api('my/profile', a, 'PUT', { displayName: 'Alice updated', bio: '', avatar: '' })).code,
		200
	);
	assert.equal(
		(await conversations(b)).find((c) => c.key === incoming.conversationKey).profile.displayName,
		'Alice updated'
	);
});
