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
		email: `presentation${randomBytes(6).toString('hex')}@example.com`,
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
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII=';
await test(
	'external mail preserves presentation and deleted internal records are administrator-only',
	{ timeout: 60000 },
	async (t) => {
		const a = await user(),
			b = await user(),
			normal = await user(),
			admin = await user();
		let sent, ak, bk, incoming, quoted;
		await t.test(
			'external HTML keeps the original link, inline layout and image size without duplicate logo bubbles',
			async () => {
				const raw = `From: Jira <jira@outside.example>\r\nTo: ${a.email}\r\nSubject: SCRUM-1\r\nMessage-ID: <${randomUUID()}@outside.example>\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n<table width="600" style="max-width:100%"><tr><td><img width="84" height="30" src="https://example.com/logo.png"><p>Hello <a href="https://example.com/tasks?tracking=long">SCRUM-1</a></p><blockquote>Original mail history remains</blockquote></td></tr></table><script>alert(1)</script>`;
				assert(
					(
						await fetch(
							new URL(`cdn-cgi/handler/email?from=jira@outside.example&to=${a.email}`, root),
							{ method: 'POST', body: raw }
						)
					).ok
				);
				const c = (await conversations(a)).find((c) => c.peers.includes('jira@outside.example'));
				const m = (await messages(a, c.key))[0];
				assert.equal(m.internal, false);
				assert(m.richHtml.includes('<table'));
				assert(m.richHtml.includes('width="84"'));
				assert(m.richHtml.includes('Original mail history remains'));
				assert(m.richHtml.includes('href="https://example.com/tasks?tracking=long"'));
				assert(!m.richHtml.includes('<script'));
				assert.equal(
					m.images.length,
					0,
					'inline logos must not become stretched standalone chat pictures'
				);
			}
		);
		await t.test(
			'deletion hides body, attachments, public object URLs and quoted excerpts from ordinary users',
			async () => {
				const req = await api('chat/friends', a, 'POST', { email: b.email });
				assert.equal(req.code, 200);
				assert.equal(
					(await api(`chat/friends/${req.data.id}`, b, 'PUT', { accept: true })).code,
					200
				);
				const r = await api('mail-chat/instant', a, 'POST', {
					accountId: a.account,
					recipients: [b.email],
					subject: 'Internal',
					text: 'Private deleted body',
					clientId: randomUUID(),
					attachments: [{ filename: 'private.png', contentType: 'image/png', content: png }]
				});
				assert.equal(r.code, 200);
				sent = r.data;
				ak = sent.conversationKey;
				bk = (await conversations(b)).find((c) => c.peers.includes(a.email)).key;
				incoming = (await messages(b, bk))[0];
				const q = await api('mail-chat/instant', b, 'POST', {
					accountId: b.account,
					recipients: [a.email],
					subject: 'Reply',
					text: 'New reply remains',
					clientId: randomUUID(),
					replyId: incoming.emailId,
					quote: true
				});
				assert.equal(q.code, 200);
				quoted = q.data;
				const key = db
					.prepare('SELECT key FROM attachments WHERE email_id=?')
					.get(sent.emailId).key;
				assert.equal((await fetch(new URL(key, root))).status, 200);
				const h = await messages(a, ak);
				assert.equal(
					(
						await api('mail-chat/delete', a, 'POST', {
							accountId: a.account,
							key: ak,
							through: h.at(-1).emailId,
							emailId: sent.emailId
						})
					).code,
					200
				);
				for (const u of [a, b]) {
					assert.equal(
						(await api(`mail-chat/message/${u === a ? sent.emailId : incoming.emailId}`, u)).code,
						404
					);
					assert.equal((await api(`allEmail/removed/${sent.emailId}`, u)).code, 403);
				}
				assert.equal((await api(`mail-chat/attachment/${incoming.images[0].attId}`, b)).code, 404);
				assert.deepEqual((await api(`email/attList?emailId=${incoming.emailId}`, b)).data, []);
				assert.equal((await fetch(new URL(key, root))).status, 404);
				assert.equal((await fetch(new URL('api/oss/' + key, root))).status, 404);
				const remaining = (await messages(b, bk))[0];
				assert.equal(remaining.replyText, 'New reply remains');
				assert.equal(remaining.quote.deleted, true);
				assert(!JSON.stringify(remaining.quote).includes('Private deleted body'));
				const detail = await api(`mail-chat/message/${quoted.emailId}`, b);
				assert(!detail.data.content.includes('Private deleted body'));
				const inbox = await api(
					`email/list?accountId=${b.account}&type=1&full=1&size=50&allReceive=0`,
					b
				);
				assert.equal(inbox.code, 200);
				assert(!JSON.stringify(inbox.data.list).includes('Private deleted body'));
				assert.equal((await api(`allEmail/removed/${sent.emailId}`, normal)).code, 403);
			}
		);
		await t.test(
			'management permission is checked server-side and administrators retain original deleted content and files',
			async () => {
				let role = db
					.prepare('SELECT role_id FROM role WHERE name=?')
					.get('mail-archive-local-test');
				if (!role) {
					const r = db
						.prepare(
							"INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'ban',0,5,0,'','')"
						)
						.run('mail-archive-local-test', 'mail-archive-local-test');
					role = { role_id: Number(r.lastInsertRowid) };
					db.prepare(
						"INSERT INTO role_perm(role_id,perm_id) SELECT ?,perm_id FROM perm WHERE perm_key='all-email:query' AND type=2"
					).run(role.role_id);
				}
				db.prepare('UPDATE user SET type=? WHERE email=?').run(role.role_id, admin.email);
				const listed = await api('allEmail/list?type=delete&full=1&size=50', admin);
				assert.equal(listed.code, 200);
				const record = listed.data.list.find((row) => row.emailId === sent.emailId);
				assert(record);
				assert.equal(record.chatRemoved, 1);
				const detail = await api(`allEmail/removed/${sent.emailId}`, admin);
				assert.equal(detail.code, 200);
				assert.equal(detail.data.text, 'Private deleted body');
				assert(!JSON.stringify(detail.data).includes('attachments/instant-'));
				const att = detail.data.attachments[0];
				const url = new URL(`api/allEmail/removed/${sent.emailId}/attachment/${att.attId}`, root);
				assert.equal(
					(await (await fetch(url, { headers: { Authorization: admin.token } })).arrayBuffer())
						.byteLength,
					Buffer.from(png, 'base64').length
				);
				assert.equal(
					(await api(`allEmail/removed/${sent.emailId}/attachment/${att.attId}`, normal)).code,
					403
				);
			}
		);
		for (const u of [a, b, normal, admin]) await api('logout', u, 'DELETE');
		db.close();
	}
);
