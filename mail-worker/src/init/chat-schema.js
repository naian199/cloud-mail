// Applied by the existing authenticated /api/init/:secret migration endpoint.
export const chatSchema = [
  `CREATE TABLE IF NOT EXISTS chat_friendship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    low_user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    high_user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted')),
    low_read_id INTEGER NOT NULL DEFAULT 0,
    high_read_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(low_user_id, high_user_id), CHECK(low_user_id < high_user_id),
    CHECK(requester_id = low_user_id OR requester_id = high_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_friend_high ON chat_friendship(high_user_id, status)`,
  `CREATE TABLE IF NOT EXISTS chat_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    friendship_id INTEGER NOT NULL REFERENCES chat_friendship(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, client_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_message_history ON chat_message(friendship_id, id)`,
  // Keep existing account hard-deletion workflows working, including installations
  // that first created these tables without cascading user foreign keys.
  `CREATE TRIGGER IF NOT EXISTS chat_cleanup_user BEFORE DELETE ON user BEGIN
    DELETE FROM chat_friendship WHERE low_user_id = OLD.user_id OR high_user_id = OLD.user_id;
    DELETE FROM chat_message WHERE sender_id = OLD.user_id;
  END`
];
