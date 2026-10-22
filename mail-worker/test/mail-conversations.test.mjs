import test from 'node:test';
import assert from 'node:assert/strict';
import {
	conversation,
	safeMailHtml,
	plainMail,
	threadReferences
} from '../src/lib/mail-conversations.js';
import { migrateMailChat, ensureMailChat } from '../src/init/mail-chat-schema.js';
import { DatabaseSync } from 'node:sqlite';

test('mail conversations preserve identity across directions, subjects and participant order', async () => {
	const mailbox = { email: 'me@example.com' };
	const received = {
		sendEmail: 'Friend@Example.COM',
		toEmail: 'me+tag@example.com',
		recipient: JSON.stringify([{ address: 'me+tag@example.com' }]),
		subject: 'One'
	};
	const sent = {
		sendEmail: 'me@example.com',
		recipient: '["friend@example.com"]',
		subject: 'Another'
	};
	assert.equal(
		(await conversation(received, mailbox)).key,
		(await conversation(sent, mailbox)).key
	);
	const group = { ...received, cc: '[{"address":"third@example.com"}]' };
	assert.notEqual(
		(await conversation(group, mailbox)).key,
		(await conversation(received, mailbox)).key
	);
	assert.deepEqual(
		(await conversation({ ...sent, bcc: '["hidden@example.com"]' }, mailbox)).peers,
		['friend@example.com']
	);
});

test('rich mail preview removes active content and external resource requests', () => {
	const input =
		'<p onclick="alert(1)">Hello<br>World</p><script>alert(1)</script><img src="https://tracker.invalid/pixel"><iframe src="https://tracker.invalid"></iframe><a href="javascript:alert(1)">link</a><meta http-equiv="refresh" content="0;url=https://tracker.invalid"><svg><script>alert(1)</script></svg>';
	const safe = safeMailHtml(input);
	assert(!/script|onclick|https:|javascript:|iframe|http-equiv|svg/i.test(safe));
	assert.match(safe, /Hello/);
	assert.match(plainMail(input), /Hello\nWorld/);
	assert(!plainMail(input).includes('alert(1)'));
	assert.equal(
		threadReferences({ relation: '<a@host> <b@host>', messageId: '<b@host>' }),
		'<a@host> <b@host>'
	);
	const link = safeMailHtml('<a href="https://example.com/verify" onclick="alert(1)">Verify</a>');
	assert.match(link, /href="https:\/\/example.com\/verify"/);
	assert.match(link, /noopener noreferrer/);
	assert.match(
		plainMail('<a href="https://example.com/verify">Verify</a>'),
		/https:\/\/example.com\/verify/
	);
});

test('schema gate handles concurrent first requests, preserves mail, and caches readiness', async () => {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec(
		"PRAGMA foreign_keys=ON;CREATE TABLE user(user_id INTEGER PRIMARY KEY);CREATE TABLE account(account_id INTEGER PRIMARY KEY);CREATE TABLE email(email_id INTEGER PRIMARY KEY,user_id INTEGER,account_id INTEGER,subject TEXT,type INTEGER,message_id TEXT);INSERT INTO email VALUES(1,1,1,'original',0,'<old@test>');"
	);
	let queries = 0;
	const db = {
		prepare(sql) {
			queries++;
			let args = [];
			return {
				bind(...values) {
					args = values;
					return this;
				},
				async first() {
					return sqlite.prepare(sql).get(...args) || null;
				},
				async all() {
					return { results: sqlite.prepare(sql).all(...args) };
				},
				async run() {
					sqlite.prepare(sql).run(...args);
				}
			};
		},
		async batch(statements) {
			for (const s of statements) await s.run();
		}
	};
	try {
		await Promise.all([ensureMailChat({ db }), ensureMailChat({ db })]);
		const readyQueries = queries;
		await ensureMailChat({ db });
		assert.equal(queries, readyQueries);
		await migrateMailChat(db);
		assert.equal(sqlite.prepare('SELECT subject FROM email').get().subject, 'original');
		assert.equal(sqlite.prepare('SELECT conversation_key FROM email').get().conversation_key, '');
	} finally {
		sqlite.close();
	}
});
