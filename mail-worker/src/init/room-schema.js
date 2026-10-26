export const roomSchema = [
  `CREATE TABLE IF NOT EXISTS mail_room (
    id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('group','channel')),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
    owner_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_room_owner ON mail_room(owner_id)`,
  `CREATE TABLE IF NOT EXISTS mail_room_member (
    room_id TEXT NOT NULL REFERENCES mail_room(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
    status TEXT NOT NULL CHECK(status IN ('invited','joined')),
    read_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(room_id,user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_room_member_user ON mail_room_member(user_id,status)`,
  `CREATE TABLE IF NOT EXISTS mail_room_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL REFERENCES mail_room(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    client_id TEXT NOT NULL, body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(sender_id,client_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mail_room_voice (
    message_id INTEGER PRIMARY KEY REFERENCES mail_room_message(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL REFERENCES mail_room(id) ON DELETE CASCADE,
    key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL,
    hash TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_room_voice_room ON mail_room_voice(room_id)`,
  `CREATE TABLE IF NOT EXISTS mail_voice_usage (
    day TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
    used INTEGER NOT NULL,PRIMARY KEY(day,user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_room_message_history ON mail_room_message(room_id,id)`
];
