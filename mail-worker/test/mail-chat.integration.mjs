// Real local email pipeline only. No external mail is sent by these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL(process.env.MAIL_CHAT_TEST_URL || 'http://127.0.0.1:8787/');
if (!['localhost', '127.0.0.1', '[::1]'].includes(root.hostname))
	throw Error('Local Worker required');
async function api(path, token, method = 'GET', body) {
	return (
		await fetch(new URL('api/' + path, root), {
			method,
			headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
			body: body === undefined ? undefined : JSON.stringify(body)
		})
	).json();
}
if (!process.env.MAIL_CHAT_TEST_SQLITE)
	throw Error(
		'Set MAIL_CHAT_TEST_SQLITE to the initialized local Wrangler D1 SQLite file; tests use an isolated sending role'
	);
const fixture = new DatabaseSync(process.env.MAIL_CHAT_TEST_SQLITE);
fixture.exec('PRAGMA busy_timeout=5000');
let role = fixture.prepare('SELECT role_id FROM role WHERE name = ?').get('mail-chat-local-test');
if (!role) {
	const result = fixture
		.prepare(
			"INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'internal',0,10,0,'','')"
		)
		.run('mail-chat-local-test', 'mail-chat-local-test');
	role = { role_id: Number(result.lastInsertRowid) };
	fixture
		.prepare(
			'INSERT INTO role_perm(role_id,perm_id) SELECT ?,perm_id FROM perm WHERE type=2 AND perm_key IN (?,?,?)'
		)
		.run(role.role_id, 'email:send', 'account:query', 'account:add');
}
async function user() {
	const creds = {
		email: 'mailtest' + randomBytes(6).toString('hex') + '@example.com',
		password: randomBytes(12).toString('hex')
	};
	assert.equal((await api('register', null, 'POST', creds)).code, 200);
	fixture.prepare('UPDATE user SET type = ? WHERE email = ?').run(role.role_id, creds.email);
	const login = await api('login', null, 'POST', creds);
	assert.equal(login.code, 200);
	const profile = await api('my/loginUserInfo', login.data.token);
	return { email: creds.email, token: login.data.token, account: profile.data.account.accountId };
}
async function list(u) {
	const r = await api(`mail-chat/conversations?accountId=${u.account}`, u.token);
	assert.equal(r.code, 200);
	return r.data.conversations;
}
async function messages(u, key, query = '') {
	const r = await api(`mail-chat/messages?accountId=${u.account}&key=${key}${query}`, u.token);
	assert.equal(r.code, 200);
	return r.data;
}
await test(
	'mail chat integrates with stored mail and the actual local email pipeline',
	{ timeout: 60000 },
	async (t) => {
		const [a, b, c] = [await user(), await user(), await user()];
		let first, conversationKey, incoming;
		const send = async (u, payload) =>
			api('mail-chat/send', u.token, 'POST', {
				accountId: u.account,
				clientId: randomUUID(),
				...payload
			});
		await t.test('authentication and mailbox isolation', async () => {
			assert.equal((await api(`mail-chat/conversations?accountId=${a.account}`)).code, 401);
			assert.equal(
				(await api(`mail-chat/conversations?accountId=${a.account}`, b.token)).code,
				403
			);
		});
		await t.test(
			'send through the existing pipeline, persist both mailboxes, push to recipient and deduplicate retries',
			async () => {
				const wsUrl = new URL('api/chat/socket', root);
				wsUrl.protocol = 'ws:';
				const socket = new WebSocket(wsUrl, ['cloud-mail-chat', `auth.${b.token}`]);
				let events = 0;
				socket.onmessage = (e) => {
					if (e.data !== 'pong') events++;
				};
				const end = Date.now() + 5000;
				while (events < 1 && Date.now() < end) await delay(20);
				assert(events > 0);
				const initial = events;
				const payload = {
					accountId: a.account,
					clientId: randomUUID(),
					recipients: [b.email],
					subject: 'First subject',
					text: 'Hello by email',
					attachments: [
						{
							filename: 'hello.txt',
							content: Buffer.from('attachment contents').toString('base64'),
							contentType: 'text/plain'
						},
						{
							filename: 'photo.png',
							contentType: 'application/octet-stream',
							content:
								'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII='
						}
					]
				};
				try {
					const result = await api('mail-chat/send', a.token, 'POST', payload);
					assert.equal(result.code, 200);
					first = result.data;
					const again = await api('mail-chat/send', a.token, 'POST', payload);
					assert.equal(again.data.emailId, first.emailId);
					assert.equal(
						(await api('mail-chat/send', a.token, 'POST', { ...payload, text: 'different' })).code,
						409
					);
					const end = Date.now() + 5000;
					while (events <= initial && Date.now() < end) await delay(20);
					assert(events > initial, 'Received email must push an update');
				} finally {
					socket.close();
				}
				conversationKey = (await list(b))[0].key;
				const history = await messages(b, conversationKey);
				assert.equal(history.messages.length, 1);
				incoming = history.messages[0];
				assert.equal(incoming.type, 0);
				assert.equal(incoming.text, 'Hello by email');
				assert.equal(incoming.replyText, 'Hello by email');
				assert.equal(incoming.images.length, 1);
				const image = await fetch(
					new URL(`api/mail-chat/attachment/${incoming.images[0].attId}`, root),
					{ headers: { Authorization: b.token } }
				);
				assert.equal(
					Buffer.from(await image.arrayBuffer())
						.subarray(0, 4)
						.toString('hex'),
					'89504e47'
				);
				assert.equal(
					(await api(`mail-chat/attachment/${incoming.images[0].attId}`, c.token)).code,
					404
				);
				assert.match(incoming.messageId, /@example.com>/);
				assert.equal(history.messages[0].attachments.length, 1);
				const att = history.messages[0].attachments[0];
				const data = await fetch(new URL(`api/mail-chat/attachment/${att.attId}`, root), {
					headers: { Authorization: b.token }
				});
				assert.equal(await data.text(), 'attachment contents');
				assert.equal((await api(`mail-chat/attachment/${att.attId}`, c.token)).code, 404);
				assert.equal((await list(b))[0].unread, 1);
				const outgoing = await messages(a, first.conversationKey);
				assert.equal(outgoing.messages[0].status, 2);
			}
		);
		await t.test(
			'replies preserve message IDs and references and merge changing subjects',
			async () => {
				const result = await send(b, {
					replyId: incoming.emailId,
					recipients: [a.email],
					subject: 'Re: First subject',
					text: 'This is an email reply',
					quote: true
				});
				assert.equal(result.code, 200);
				const rows = await list(a);
				assert.equal(rows.length, 1);
				assert.equal(rows[0].key, first.conversationKey);
				const history = await messages(a, rows[0].key);
				assert.equal(history.messages.length, 2);
				assert.equal(history.messages[1].inReplyTo, incoming.messageId);
				assert.equal(history.messages[1].replyText, 'This is an email reply');
				assert.equal(history.messages[1].quote.text, 'Hello by email');
				assert.equal(history.messages[1].quote.messageId, incoming.messageId);
				const quotedRetry = await send(b, {
					recipients: [c.email],
					subject: 'Re: First subject',
					text: '',
					attachments: [
						{
							filename: 'only.png',
							contentType: 'application/octet-stream',
							content:
								'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII='
						}
					]
				});
				assert.equal(quotedRetry.code, 200);
				const onlyImage = (await messages(c, (await list(c))[0].key)).messages.at(-1);
				assert.equal(onlyImage.replyText, '');
				assert.equal(onlyImage.images.length, 1);
				assert(history.messages[1].relation.includes(incoming.messageId));
				assert.equal(
					(
						await send(b, {
							replyId: first.emailId,
							recipients: [a.email],
							subject: 'Forged reply',
							text: 'not allowed'
						})
					).code,
					403
				);
				assert.equal((await api(`mail-chat/message/${first.emailId}`, c.token)).code, 404);
				assert.equal(
					(
						await send(a, {
							recipients: [b.email],
							subject: 'A different subject',
							text: 'Same contact'
						})
					).code,
					200
				);
				assert.equal((await list(a)).length, 1);
				const marked = await api('mail-chat/read', a.token, 'PUT', {
					accountId: a.account,
					key: first.conversationKey,
					through: 99999999
				});
				assert.equal(marked.code, 200);
				assert.equal((await list(a))[0].unread, 0);
			}
		);
		await t.test('group recipients, pinning, search and validation', async () => {
			assert.equal(
				(
					await send(a, {
						recipients: [b.email, c.email],
						subject: 'Group mail',
						text: 'Hello both'
					})
				).code,
				200
			);
			const rows = await list(a);
			assert.equal(rows.length, 2);
			const group = rows.find((r) => r.peers.length === 2);
			assert(group);
			assert.equal(
				(
					await api('mail-chat/pin', a.token, 'PUT', {
						accountId: a.account,
						key: group.key,
						pinned: true
					})
				).code,
				200
			);
			assert.equal((await list(a)).find((r) => r.key === group.key).pinned, 1);
			assert.equal(
				(await api(`mail-chat/conversations?accountId=${a.account}&search=Group`, a.token)).data
					.conversations.length,
				1
			);
			assert.equal(
				(await send(a, { recipients: ['invalid'], subject: 'test', text: 'body' })).code,
				400
			);
			assert.equal(
				(await send(a, { recipients: [b.email], subject: 'bad\r\nHeader: x', text: 'body' })).code,
				400
			);
			assert.equal(
				(await send(a, { recipients: [b.email], subject: 'test', text: 'x'.repeat(20001) })).code,
				400
			);
		});
		await t.test(
			'actual RFC822 ingress, Reply-To, HTML safety and duplicate delivery',
			async () => {
				const mid = `<${randomUUID()}@outside.example>`;
				const png =
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/1cAAAAASUVORK5CYII=';
				const raw = `From: External <sender@outside.example>\r\nTo: ${b.email}\r\nReply-To: reply@outside.example\r\nMessage-ID: ${mid}\r\nSubject: HTML inbound\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=mailpicture\r\n\r\n--mailpicture\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n<p onclick="alert(1)">HTML incoming</p><img src="cid:sample"><blockquote>Old reply<img src="https://tracker.invalid/old.png"></blockquote><script>alert(1)</script><img width="1" src="https://tracker.invalid/pixel">\r\n--mailpicture\r\nContent-Type: image/png\r\nContent-ID: <sample>\r\nContent-Disposition: inline; filename="embedded.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n${png}\r\n--mailpicture--`;

				const url = new URL('cdn-cgi/handler/email', root);
				url.searchParams.set('from', 'sender@outside.example');
				url.searchParams.set('to', b.email);
				for (let i = 0; i < 2; i++) {
					const r = await fetch(url, { method: 'POST', body: raw });
					assert(r.ok, await r.text());
				}
				const conv = (await list(b)).find((r) => r.peers.includes('sender@outside.example'));
				assert(conv);
				const data = await messages(b, conv.key);
				assert.equal(data.messages.length, 1);
				assert(data.messages[0].richHtml.includes('HTML incoming'));
				assert(data.messages[0].richHtml.includes('Old reply'));
				assert.equal(data.messages[0].richImages.length, 1);
				const pictureId = data.messages[0].richImages[0].attId;
				const picture = await fetch(new URL(`api/mail-chat/attachment/${pictureId}`, root), {
					headers: { Authorization: b.token }
				});
				assert.equal(Buffer.from(await picture.arrayBuffer()).toString('base64'), png);
				assert.equal((await api(`mail-chat/attachment/${pictureId}`, c.token)).code, 404);

				assert(data.messages[0].replyTo.includes('reply@outside.example'));
				const detail = await api(`mail-chat/message/${data.messages[0].emailId}`, b.token);
				assert.equal(detail.code, 200);
				assert(!/script|onclick|tracker.invalid/i.test(detail.data.content));
				assert(detail.data.text.includes('HTML incoming'));
			}
		);
		await t.test('message paging, bounded legacy indexing and safe pending retries', async () => {
			for (let i = 0; i < 24; i++)
				assert.equal(
					(await send(a, { recipients: [b.email], subject: 'Pagination', text: `Page ${i}` })).code,
					200
				);
			const recent = await messages(a, first.conversationKey);
			assert.equal(recent.messages.length, 20);
			assert(recent.hasMore);
			const past = await messages(
				a,
				first.conversationKey,
				`&before=${recent.messages[0].emailId}`
			);
			assert.equal(past.messages.length, 7);
			assert(!past.hasMore);
			const after = await messages(
				a,
				first.conversationKey,
				`&after=${past.messages.at(-1).emailId}`
			);
			assert.equal(after.messages[0].emailId, recent.messages[0].emailId);
			const uid = fixture.prepare('SELECT user_id FROM user WHERE email = ?').get(a.email).user_id;
			const insert = fixture.prepare(
				'INSERT INTO email(user_id,account_id,send_email,recipient,subject,text,type,status,is_del) VALUES(?,?,?,?,?,?,0,0,0)'
			);
			fixture.exec('BEGIN');
			try {
				for (let i = 0; i < 125; i++)
					insert.run(
						uid,
						a.account,
						'legacy@outside.example',
						JSON.stringify([{ address: a.email }]),
						'Historical',
						'old ' + i
					);
				fixture.exec('COMMIT');
			} catch (e) {
				fixture.exec('ROLLBACK');
				throw e;
			}
			const one = await api(`mail-chat/conversations?accountId=${a.account}`, a.token);
			assert(one.data.indexing);
			const two = await api(`mail-chat/conversations?accountId=${a.account}`, a.token);
			assert(!two.data.indexing);
			assert(two.data.conversations.some((c) => c.peers.includes('legacy@outside.example')));
			const clientId = randomUUID(),
				payload = {
					accountId: a.account,
					clientId,
					recipients: [b.email],
					subject: 'Pending delivery',
					text: 'Do not send twice'
				};
			const hash = (s) => createHash('sha256').update(s).digest('hex');
			const requestKey = hash(`${uid}:${clientId}`),
				fingerprint = hash(
					JSON.stringify({
						account: a.account,
						body: payload.text,
						subject: payload.subject,
						recipients: payload.recipients,
						replyId: null,
						attachments: []
					})
				);
			fixture
				.prepare(
					'INSERT INTO mail_send_attempt(request_key,user_id,account_id,fingerprint) VALUES(?,?,?,?)'
				)
				.run(requestKey, uid, a.account, fingerprint);
			assert.equal((await api('mail-chat/send', a.token, 'POST', payload)).code, 409);
			assert.equal(
				fixture.prepare('SELECT COUNT(*) AS count FROM email WHERE send_key = ?').get(requestKey)
					.count,
				0
			);
		});
		for (const u of [a, b, c]) await api('logout', u.token, 'DELETE');
		fixture.close();
	}
);
