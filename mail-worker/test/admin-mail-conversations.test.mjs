import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { adminConversationList, adminConversationMessages } from '../src/lib/admin-mail-conversations.mjs';

test('administrative conversations join legacy replies, respect mailbox boundaries and paginate', () => {
	const db = new DatabaseSync(':memory:');
	db.exec(`
	  CREATE TABLE user (user_id INTEGER PRIMARY KEY, email TEXT);
	  CREATE TABLE account (account_id INTEGER PRIMARY KEY, user_id INTEGER, email TEXT);
	  CREATE TABLE email (
	    email_id INTEGER PRIMARY KEY, user_id INTEGER, account_id INTEGER, send_email TEXT, name TEXT,
	    subject TEXT, text TEXT, type INTEGER, create_time TEXT, message_id TEXT, conversation_key TEXT,
	    conversation_peers TEXT, to_email TEXT, recipient TEXT, cc TEXT, is_del INTEGER, status INTEGER, content TEXT
	  );
	  INSERT INTO user VALUES (1,'one@example.com'),(2,'two@example.com');
	  INSERT INTO account VALUES (1,1,'one@example.com'),(2,2,'two@example.com'),(3,1,'other@example.com');
	`);
	const insert = db.prepare('INSERT INTO email VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
	function mail(id, { user = 1, account = 1, from = 'peer@example.org', to = 'one@example.com', indexed = false,
		peer = 'peer@example.org', body = '', type = 0, deleted = 0, status = 0, message = '', day = id } = {}) {
		insert.run(id, user, account, from, '', 'Subject', body, type, `2026-11-${String(day).padStart(2, '0')} 12:00:00`,
			message, indexed ? 'hash' : '', indexed ? JSON.stringify([peer]) : '[]', type === 0 ? to : '',
			JSON.stringify([{ address: to }]), '[]', deleted, status, '<p>HTML fallback</p>');
	}
	mail(1, { body: 'first searchable message', message: '<first>' });
	mail(2, { indexed: true, type: 1, from: 'one@example.com', to: 'PEER@example.org', body: 'reply' });
	mail(3, { indexed: true, message: '<first>', day: 1, body: 'another copy' });
	mail(4, { indexed: true, deleted: 1, body: 'deleted' });
	mail(5, { indexed: true, user: 2, account: 2, to: 'two@example.com', body: 'separate owner' });
	mail(6, { indexed: true, account: 3, to: 'other@example.com', body: 'separate mailbox' });
	mail(7, { status: 7, body: 'undeliverable' });
	mail(8, { from: 'peer@example.org', to: 'one@example.com' });

	const list = db.prepare(adminConversationList);
	const messages = db.prepare(adminConversationMessages);
	assert.deepEqual(list.all('', '', 0, 10).map((r) => r.emailId), [8, 6, 5]);
	assert.deepEqual(list.all('separate', '', 0, 10).map((r) => r.emailId), [6, 5]);
	assert.deepEqual(list.all('first searchable', '', 0, 10).map((r) => r.emailId), [8]);
	assert.deepEqual(list.all('deleted', '', 0, 10), []);
	assert.deepEqual(list.all('', '2026-11-08 12:00:00', 8, 1).map((r) => r.emailId), [6]);
	assert.deepEqual(messages.all(8, '', 0, 10).map((r) => r.emailId), [8, 2, 3]);
	assert.equal(messages.all(8, '', 0, 10)[0].html, '<p>HTML fallback</p>');
	assert.deepEqual(messages.all(8, '2026-11-02 12:00:00', 2, 10).map((r) => r.emailId), [3]);
	assert.deepEqual(messages.all(4, '', 0, 10), []);
});
