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

await test('conversation search and media keep ownership, pagination, dates and deleted records private', async () => {
	const a = await user(),
		b = await user(),
		outsider = await user();
	const friend = await api('chat/friends', a, 'POST', { email: b.email });
	assert.equal((await api('chat/friends/' + friend.data.id, b, 'PUT', { accept: true })).code, 200);
	const send = async (text, extra = {}) => {
		const result = await api('mail-chat/instant', a, 'POST', {
			accountId: a.account,
			recipients: [b.email],
			subject: 'Search fixture',
			text,
			clientId: randomUUID(),
			...extra
		});
		assert.equal(result.code, 200);
		return result.data;
	};
	await send('old unique archive needle https://example.org/archive', {
		attachments: [
			{
				filename: 'photo.png',
				contentType: 'image/png',
				content:
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII='
			},
			{
				filename: 'report.txt',
				contentType: 'text/plain',
				content: Buffer.from('private file').toString('base64')
			}
		]
	});
	const key = (await conversations(a))[0].key;
	const oldest = (await messages(a, key))[0];
	db.prepare("UPDATE email SET create_time='2025-02-01 12:00:00' WHERE message_id=?").run(
		oldest.messageId
	);
	for (let i = 0; i < 64; i++) await send('recent filler ' + i);
	await send('x'.repeat(11000) + ' fullbodyneedle');
	const explore = (u, params = {}) =>
		api('mail-chat/explore?' + new URLSearchParams({ accountId: a.account, key, ...params }), u);
	assert.equal((await explore(null)).code, 401);
	assert.equal((await explore(outsider)).code, 403);
	assert.equal((await explore(a, { start: 'invalid' })).code, 400);
	assert.equal((await explore(a, { start: '2026-02-01', end: '2025-01-01' })).code, 400);
	const first = await explore(a, { search: 'archive needle' });
	assert.equal(first.code, 200);
	assert.equal(first.data.items.length, 0);
	assert(first.data.hasMore);
	const next = await explore(a, { search: 'archive needle', before: first.data.before });
	assert.equal(next.code, 200);
	assert.equal(next.data.items.length, 1);
	const media = next.data.items[0];
	assert.equal(media.emailId, oldest.emailId);
	assert(media.images.length);
	assert.equal(media.attachments[0].filename, 'report.txt');
	assert.deepEqual(media.links, ['https://example.org/archive']);
	assert(!JSON.stringify(media).includes('"key":'));
	const full = await explore(a, { search: 'fullbodyneedle' });
	assert.equal(full.data.items.length, 1);
	const dated = await explore(a, { start: '2025-02-01T00:00:00Z', end: '2025-02-02T00:00:00Z' });
	assert.equal(dated.data.items.length, 1);
	assert.equal(dated.data.items[0].emailId, oldest.emailId);
	const around = await api(
		'mail-chat/messages?' +
			new URLSearchParams({ accountId: a.account, key, around: oldest.emailId }),
		a
	);
	assert.equal(around.code, 200);
	assert(around.data.messages.some((m) => m.emailId === oldest.emailId));
	assert.equal(
		(
			await api(
				'mail-chat/messages?' +
					new URLSearchParams({ accountId: outsider.account, key, around: oldest.emailId }),
				outsider
			)
		).code,
		400
	);
	assert.equal(
		(
			await api('mail-chat/delete', a, 'POST', {
				accountId: a.account,
				key,
				emailId: oldest.emailId,
				through: oldest.emailId
			})
		).code,
		200
	);
	const removed = await explore(a, { start: '2025-02-01T00:00:00Z', end: '2025-02-02T00:00:00Z' });
	assert.equal(removed.data.items.length, 0);
	assert(removed.data.revision > dated.data.revision);
	const recipientKey = (await conversations(b))[0].key;
	const recipient = await api(
		'mail-chat/explore?' +
			new URLSearchParams({
				accountId: b.account,
				key: recipientKey,
				start: '2025-02-01T00:00:00Z',
				end: '2025-02-02T00:00:00Z'
			}),
		b
	);
	assert.equal(recipient.data.items.length, 0);
	assert.equal((await api('mail-chat/attachment/' + media.images[0].attId, a)).code, 404);
});
db.close();
