import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { chatSchema } from '../src/init/chat-schema.js';

test('chat schema is repeatable and preserves existing account hard deletion', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON; CREATE TABLE user (user_id INTEGER PRIMARY KEY); INSERT INTO user VALUES (1), (2), (3);');
    for (let run = 0; run < 2; run++) for (const sql of chatSchema) db.exec(sql);
    db.exec(`INSERT INTO chat_friendship (low_user_id, high_user_id, requester_id, status) VALUES (1, 2, 1, 'accepted'), (2, 3, 3, 'accepted');
      INSERT INTO chat_message (friendship_id, sender_id, client_id, body) VALUES (1, 1, 'first-message-id', 'one'), (1, 2, 'reply-message-id', 'two'), (2, 3, 'other-message-id', 'three');`);
    db.exec('DELETE FROM user WHERE user_id = 1');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM chat_friendship').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM chat_message').get().count, 1);
    assert.equal(db.prepare('SELECT body FROM chat_message').get().body, 'three');
    db.exec('DELETE FROM user WHERE user_id = 2');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM chat_friendship').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM chat_message').get().count, 0);
  } finally { db.close(); }
});
