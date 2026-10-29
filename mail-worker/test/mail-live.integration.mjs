// Local-only fixtures exercise live features without contacting external mail providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL(process.env.MAIL_CHAT_TEST_URL || 'http://127.0.0.1:8787/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(root.hostname)) throw Error('Local Worker only');
if (!process.env.MAIL_CHAT_TEST_SQLITE) throw Error('Local SQLite fixture required');
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
	const body = {
		email: `live${randomBytes(7).toString('hex')}@example.com`,
		password: randomBytes(12).toString('hex')
	};
	assert.equal((await api('register', null, 'POST', body)).code, 200);
	const login = await api('login', null, 'POST', body);
	assert.equal(login.code, 200);
	const p = await api('my/loginUserInfo', { token: login.data.token });
	return { email: body.email, token: login.data.token, account: p.data.account.accountId };
}
async function open(u, peer) {
	const r = await api('mail-chat/open', u, 'POST', { accountId: u.account, email: peer.email });
	assert.equal(r.code, 200);
	return r.data.key;
}
async function history(u, key) {
	const r = await api(`mail-chat/messages?accountId=${u.account}&key=${key}`, u);
	assert.equal(r.code, 200);
	return r.data;
}
async function pulse(u, key, sessionId, active = true, typing = false) {
	return api('mail-chat/presence', u, 'PUT', {
		accountId: u.account,
		key,
		sessionId,
		active,
		typing
	});
}
async function state(u, key) {
	const r = await api(`mail-chat/live?accountId=${u.account}&key=${key}`, u);
	assert.equal(r.code, 200);
	return r.data;
}
async function instant(u, peer, text, extra = {}) {
	return api('mail-chat/instant', u, 'POST', {
		accountId: u.account,
		recipients: [peer.email],
		subject: 'Instant',
		text,
		clientId: randomUUID(),
		...extra
	});
}
async function remove(u, key, through, emailId) {
	return api('mail-chat/delete', u, 'POST', {
		accountId: u.account,
		key,
		through,
		...(emailId ? { emailId } : {})
	});
}

await test(
	'unified internal mail chat: presence, typing, reads, two-sided deletion and old chat import',
	{ timeout: 60000 },
	async (t) => {
		const a = await user(),
			b = await user(),
			c = await user();
		const ak = await open(a, b),
			bk = await open(b, a);
		const sa = randomUUID(),
			sb = randomUUID(),
			sb2 = randomUUID();
		let friendship, first;
		await t.test(
			'registered site users send directly while external mail permissions stay enforced',
			async () => {
				assert.equal((await instant(a, c, 'Before acceptance')).code, 200);
				const req = await api('chat/friends', a, 'POST', { email: b.email });
				assert.equal(req.code, 200);
				friendship = req.data.id;
				assert.equal(
					(await api(`chat/friends/${friendship}`, b, 'PUT', { accept: true })).code,
					200
				);
				assert.equal(
					(
						await api('mail-chat/send', a, 'POST', {
							accountId: a.account,
							recipients: ['outside@example.net'],
							subject: 'Not permitted',
							text: 'mail',
							clientId: randomUUID()
						})
					).code,
					403
				);
				const payload = {
					clientId: randomUUID(),
					attachments: [
						{
							filename: 'image.png',
							contentType: 'application/octet-stream',
							content:
								'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII='
						}
					]
				};
				const sent = await instant(a, b, 'Instant hello', payload);
				assert.equal(sent.code, 200);
				first = sent.data;
				assert.equal((await instant(a, b, 'Instant hello', payload)).data.emailId, first.emailId);
				const incoming = (await history(b, bk)).messages;
				assert.equal(incoming.length, 1);
				assert.equal(incoming[0].replyText, 'Instant hello');
				assert.equal(incoming[0].images.length, 1);
				assert.equal((await instant(a, c, 'Not a friend')).code, 200);
				assert.equal(
					(
						await api('mail-chat/instant', c, 'POST', {
							accountId: a.account,
							recipients: [b.email],
							subject: 'Forged',
							text: 'forged',
							clientId: randomUUID()
						})
					).code,
					403
				);
			}
		);
		await t.test(
			'online, typing, multiple sessions, explicit offline and expiry are scoped to participants',
			async () => {
				assert.equal((await state(a, ak)).lastSeen, null);
				assert.equal((await pulse(a, ak, sa)).code, 200);
				assert.equal((await pulse(b, bk, sb, true, true)).code, 200);
				const online = await state(a, ak);
				assert.ok(online.lastSeen > Date.now() - 5000);
				const { lastSeen, ...presence } = online;
				assert.deepEqual(presence, {
					internal: true,
					friend: true,
					online: true,
					typing: true
				});
				await pulse(b, bk, sb2);
				await pulse(b, bk, sb, false);
				assert.equal((await state(a, ak)).online, true);
				assert.equal((await state(a, ak)).typing, false);
				await pulse(b, bk, sb2, false);
				assert.ok((await state(a, ak)).lastSeen >= lastSeen);
				assert.equal((await state(a, ak)).online, false);
				await pulse(b, bk, sb, true, true);
				db.prepare('UPDATE mail_live_session SET expires_at=? WHERE session_id=?').run(
					Date.now() - 1000,
					sb
				);
				assert.equal((await state(a, ak)).online, false);
				assert.equal((await state(a, ak)).typing, false);
				db.prepare('DELETE FROM mail_live_session WHERE session_id=?').run(sb);
				assert.ok((await state(a, ak)).lastSeen >= lastSeen);
				assert.equal((await api(`mail-chat/live?accountId=${a.account}&key=${ak}`, c)).code, 403);
				assert.equal((await state(c, ak)).internal, false);
				assert.equal(
					(
						await api('mail-chat/presence', c, 'PUT', {
							accountId: b.account,
							key: bk,
							sessionId: randomUUID(),
							active: true,
							typing: true
						})
					).code,
					403
				);
			}
		);
		await t.test(
			'read receipts follow actual recipient read and trigger sender reconciliation',
			async () => {
				assert.equal((await history(a, ak)).messages[0].read, false);
				const ws = new URL('api/chat/socket', root);
				ws.protocol = 'ws:';
				const socket = new WebSocket(ws, ['cloud-mail-chat', `auth.${a.token}`]);
				let events = 0;
				socket.onmessage = (e) => {
					if (e.data !== 'pong') events++;
				};
				const end = Date.now() + 3000;
				while (!events && Date.now() < end) await delay(10);
				const before = events;
				const incoming = (await history(b, bk)).messages[0];
				assert.equal(
					(
						await api('mail-chat/read', c, 'PUT', {
							accountId: b.account,
							key: bk,
							through: incoming.emailId
						})
					).code,
					403
				);
				assert.equal((await history(a, ak)).messages[0].read, false);
				assert.equal(
					(
						await api('mail-chat/read', b, 'PUT', {
							accountId: b.account,
							key: bk,
							through: incoming.emailId
						})
					).code,
					200
				);
				const until = Date.now() + 3000;
				while (events <= before && Date.now() < until) await delay(10);
				assert(events > before);
				assert.equal((await history(a, ak)).messages[0].read, true);
				socket.close();
			}
		);
		await t.test(
			'delete for both hides corresponding mail and attachment, revisions survive reconnect and other users cannot delete',
			async () => {
				db.prepare(
					`INSERT INTO email(user_id,account_id,send_email,recipient,text,subject,type,status,message_id,conversation_key,conversation_peers) SELECT user_id,account_id,send_email,recipient,text,subject,type,status,message_id,conversation_key,conversation_peers FROM email WHERE email_id=?`
				).run(first.emailId);
				const beforeA = await history(a, ak),
					beforeB = await history(b, bk),
					att = beforeB.messages[0].images[0].attId;
				assert.equal((await remove(c, ak, first.emailId, first.emailId)).code, 403);
				assert.equal((await remove(a, ak, first.emailId, first.emailId)).code, 200);
				assert.equal((await history(a, ak)).messages.length, 0);
				assert.equal((await history(b, bk)).messages.length, 0);
				assert((await history(a, ak)).revision > beforeA.revision);
				assert((await history(b, bk)).revision > beforeB.revision);
				assert.equal((await api(`mail-chat/attachment/${att}`, b)).code, 404);
				assert.equal((await api(`mail-chat/message/${first.emailId}`, a)).code, 404);
				db.prepare('UPDATE email SET is_del=0 WHERE email_id=?').run(first.emailId);
				assert.equal((await api(`mail-chat/message/${first.emailId}`, a)).code, 404);
				const two = await instant(a, b, 'Clear through this snapshot');
				const three = await instant(a, b, 'Newer message survives');
				assert.equal(two.code, 200);
				assert.equal(three.code, 200);
				assert.equal((await remove(a, ak, two.data.emailId)).code, 200);
				assert.deepEqual(
					(await history(b, bk)).messages.map((m) => m.replyText),
					['Newer message survives']
				);
			}
		);
		await t.test(
			'legacy friend messages enter one timeline once and cannot reappear after bilateral deletion',
			async () => {
				const old = await api(`chat/friends/${friendship}/messages`, a, 'POST', {
					body: 'Legacy private message',
					clientId: randomUUID()
				});
				assert.equal(old.code, 200);
				db.prepare('UPDATE chat_message SET created_at=? WHERE id=?').run(
					'2000-01-01 00:00:00',
					old.data.id
				);
				assert.equal((await api(`mail-chat/conversations?accountId=${a.account}`, a)).code, 200);
				const preview = await api(`mail-chat/conversations?accountId=${a.account}`, a);
				assert.equal(
					preview.data.conversations.find((row) => row.key === ak).preview,
					'Newer message survives'
				);
				let h = await history(a, ak);
				const legacy = h.messages.find((m) => m.replyText === 'Legacy private message');
				assert(legacy);
				assert.equal(
					(await remove(a, ak, Math.max(...h.messages.map((m) => m.emailId)), legacy.emailId)).code,
					200
				);
				assert.equal((await api(`mail-chat/conversations?accountId=${b.account}`, b)).code, 200);
				assert(
					!(await history(b, bk)).messages.some((m) => m.replyText === 'Legacy private message')
				);
				assert.equal((await api(`mail-chat/conversations?accountId=${a.account}`, a)).code, 200);
				assert(
					!(await history(a, ak)).messages.some((m) => m.replyText === 'Legacy private message')
				);
			}
		);

		await t.test(
			'forged RFC identity cannot remove an unrelated legacy friendship message',
			async () => {
				const req = await api('chat/friends', b, 'POST', { email: c.email });
				assert.equal(req.code, 200);
				assert.equal(
					(await api(`chat/friends/${req.data.id}`, c, 'PUT', { accept: true })).code,
					200
				);
				const other = await api(`chat/friends/${req.data.id}/messages`, c, 'POST', {
					body: 'Unrelated pair remains private',
					clientId: randomUUID()
				});
				assert.equal(other.code, 200);
				const local = (await history(a, ak)).messages.at(-1);
				db.prepare('UPDATE email SET message_id=? WHERE email_id=?').run(
					`<legacy-chat-${other.data.id}@cloud-mail.internal>`,
					local.emailId
				);
				assert.equal((await remove(a, ak, local.emailId, local.emailId)).code, 200);
				assert(db.prepare('SELECT id FROM chat_message WHERE id=?').get(other.data.id));
				db.prepare('UPDATE email SET message_id=? WHERE email_id=?').run(
					local.messageId,
					local.emailId
				);
			}
		);
		await t.test('clear removes legacy history beyond the first import page', async () => {
			const uid = db.prepare('SELECT user_id FROM user WHERE email=?').get(a.email).user_id;
			const insert = db.prepare(
				"INSERT INTO chat_message(friendship_id,sender_id,client_id,body,created_at) VALUES(?,?,?,?,'2001-01-01 00:00:00')"
			);
			db.exec('BEGIN');
			try {
				for (let i = 0; i < 151; i++) insert.run(friendship, uid, randomUUID(), `Old batch ${i}`);
				db.exec('COMMIT');
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
			assert.equal((await instant(a, b, 'Latest modern message')).code, 200);
			assert.equal((await api(`mail-chat/conversations?accountId=${a.account}`, a)).code, 200);
			const h = await history(a, ak);
			assert.equal(h.messages.at(-1).replyText, 'Latest modern message');
			assert(h.messages.some((m) => m.emailId > h.messages.at(-1).emailId));
			assert.equal((await remove(a, ak, h.messages.at(-1).emailId)).code, 200);
			assert.equal((await api(`mail-chat/conversations?accountId=${b.account}`, b)).code, 200);
			assert.equal((await history(b, bk)).messages.length, 0);
			assert.equal((await api(`mail-chat/conversations?accountId=${a.account}`, a)).code, 200);
			assert.equal((await history(a, ak)).messages.length, 0);
			assert.equal(
				db
					.prepare('SELECT count(*) AS count FROM chat_message WHERE friendship_id=?')
					.get(friendship).count,
				0
			);
		});

        await t.test('cleared history keeps both contacts, repairs old missing entries and allows a fresh message without restoring history',async()=>{
            for(const [u,k,peer] of [[a,ak,b],[b,bk,a]]){
                const listed=(await api(`mail-chat/conversations?accountId=${u.account}&category=internal`,u)).data;
                const contact=listed.contacts.find(row=>row.key===k);assert(contact);assert.equal(contact.latestId,0);assert.equal(contact.unread,0);assert.deepEqual(contact.peers,[peer.email]);
                assert.equal((await history(u,k)).messages.length,0);
                db.prepare('DELETE FROM mail_conversation_contact WHERE account_id=? AND conversation_key=?').run(u.account,k);
                const repaired=(await api(`mail-chat/conversations?accountId=${u.account}&category=internal&search=${encodeURIComponent(peer.email)}`,u)).data;
                assert(repaired.contacts.some(row=>row.key===k));assert.equal((await history(u,k)).messages.length,0);
                assert.equal((await api(`mail-chat/conversations?accountId=${u.account}&category=external`,u)).data.contacts.some(row=>row.key===k),false);
            }
            const outsider=await api(`mail-chat/conversations?accountId=${a.account}`,c);assert.notEqual(outsider.code,200);
            assert.equal((await instant(b,a,'Fresh conversation after clearing')).code,200);
            for(const [u,k] of [[a,ak],[b,bk]])assert.deepEqual((await history(u,k)).messages.map(m=>m.replyText),['Fresh conversation after clearing']);
        });

		for (const u of [a, b, c]) await api('logout', u, 'DELETE');
		db.close();
	}
);
