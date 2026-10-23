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

await test('self deletion preserves peer history and administrator records, including imported chat', async () => {
	const a = await user(),
		b = await user(),
		admin = await user();
	const f = await api('chat/friends', a, 'POST', { email: b.email });
	assert.equal((await api('chat/friends/' + f.data.id, b, 'PUT', { accept: true })).code, 200);
	assert.equal(
		(
			await api('chat/friends/' + f.data.id + '/messages', a, 'POST', {
				body: 'Legacy self-delete record',
				clientId: randomUUID()
			})
		).code,
		200
	);
	const key = (await conversations(a))[0].key;
	await conversations(b);
	const message = (await messages(a, key)).find((m) => m.replyText === 'Legacy self-delete record');
	assert(message);
	assert.equal(
		(
			await api('mail-chat/delete-self', b, 'POST', {
				accountId: a.account,
				key,
				emailId: message.emailId
			})
		).code,
		403
	);
	assert.equal(
		(
			await api('mail-chat/delete-self', a, 'POST', {
				accountId: a.account,
				key,
				emailId: message.emailId
			})
		).code,
		200
	);
	assert(!(await messages(a, key)).some((m) => m.emailId === message.emailId));
	const peerKey = (await conversations(b))[0].key;
	assert((await messages(b, peerKey)).some((m) => m.replyText === 'Legacy self-delete record'));
	const legacyOwn = await api('chat/friends/' + f.data.id + '/messages', a);
	assert(!legacyOwn.data.messages.some((m) => m.body === 'Legacy self-delete record'));
	const legacyPeer = await api('chat/friends/' + f.data.id + '/messages', b);
	assert(legacyPeer.data.messages.some((m) => m.body === 'Legacy self-delete record'));
	const ownList = await api('chat/friends', a);
	assert(!ownList.data.some((row) => row.lastMessage === 'Legacy self-delete record'));
	assert.equal((await api('mail-chat/message/' + message.emailId, a)).code, 404);
	assert.equal((await api('allEmail/removed/' + message.emailId, a)).code, 403);
	const role = db
		.prepare(
			"INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'ban',0,5,0,'','')"
		)
		.run('delete-admin-' + randomUUID(), 'delete-admin-' + randomUUID());
	db.prepare(
		"INSERT INTO role_perm(role_id,perm_id) SELECT ?,perm_id FROM perm WHERE perm_key='all-email:query' AND type=2"
	).run(Number(role.lastInsertRowid));
	db.prepare('UPDATE user SET type=? WHERE email=?').run(Number(role.lastInsertRowid), admin.email);
	admin.token = (
		await api('login', null, 'POST', { email: admin.email, password: admin.password })
	).data.token;
	const archive = await api('allEmail/removed/' + message.emailId, admin);
	assert.equal(archive.code, 200);
	assert(archive.data.text.includes('Legacy self-delete record'));
});
db.close();
