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

test('both sides of a conversation between two mailboxes show as one entry with every message once', () => {
	const db = new DatabaseSync(':memory:');
	db.exec(`
	  CREATE TABLE user (user_id INTEGER PRIMARY KEY, email TEXT);
	  CREATE TABLE account (account_id INTEGER PRIMARY KEY, user_id INTEGER, email TEXT);
	  CREATE TABLE email (
	    email_id INTEGER PRIMARY KEY, user_id INTEGER, account_id INTEGER, send_email TEXT, name TEXT,
	    subject TEXT, text TEXT, type INTEGER, create_time TEXT, message_id TEXT, conversation_key TEXT,
	    conversation_peers TEXT, to_email TEXT, recipient TEXT, cc TEXT, is_del INTEGER, status INTEGER, content TEXT
	  );
	  INSERT INTO user VALUES (1,'owner@example.com'),(2,'palmer@example.com');
	  INSERT INTO account VALUES (1,1,'owner@example.com'),(2,2,'palmer@example.com');
	`);
	const insert = db.prepare('INSERT INTO email VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
	const row = (id, user, from, to, type, peer, message, body) => insert.run(id, user, user, from, '', 'Chat', body, type,
		`2026-11-14 12:00:0${id}`, message, 'k', JSON.stringify([peer]), type === 0 ? to : '', JSON.stringify([{ address: to }]), '[]', 0, 0, '');
	// palmer -> owner: sent copy in palmer's mailbox, received copy in owner's.
	row(1, 2, 'palmer@example.com', 'owner@example.com', 1, 'owner@example.com', '<a>', 'Hi there');
	row(2, 1, 'palmer@example.com', 'owner@example.com', 0, 'palmer@example.com', '<a>', 'Hi there');
	// owner -> palmer.
	row(3, 1, 'owner@example.com', 'palmer@example.com', 1, 'palmer@example.com', '<b>', 'Hello back');
	row(4, 2, 'owner@example.com', 'palmer@example.com', 0, 'owner@example.com', '<b>', 'Hello back');
	const list = db.prepare(adminConversationList).all('', '', 0, 10);
	assert.equal(list.length, 1);
	assert.equal(db.prepare(adminConversationList).all('palmer', '', 0, 10).length, 1);
	const texts = db.prepare(adminConversationMessages).all(list[0].emailId, '', 0, 10).map((m) => m.text);
	assert.deepEqual(texts, ['Hello back', 'Hi there']);
	// Opened from either side's copy, it is the same conversation.
	assert.deepEqual(db.prepare(adminConversationMessages).all(1, '', 0, 10).map((m) => m.text), ['Hello back', 'Hi there']);
});
