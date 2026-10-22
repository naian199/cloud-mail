export async function migrateMailChat(db) {
	const { results } = await db.prepare('PRAGMA table_info(email)').all();
	const names = new Set(results.map((row) => row.name));
	for (const [name, type] of [
		['conversation_key', "TEXT NOT NULL DEFAULT ''"],
		['conversation_peers', "TEXT NOT NULL DEFAULT '[]'"],
		['reply_to', "TEXT NOT NULL DEFAULT '[]'"],
		['ingest_key', 'TEXT'],
		['send_key', 'TEXT']
	]) {
		if (!names.has(name)) await db.prepare(`ALTER TABLE email ADD COLUMN ${name} ${type}`).run();
	}
	await db.batch([
		db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_mail_conversation ON email(user_id, account_id, conversation_key, email_id)'
		),
		db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_mail_message_identity ON email(account_id, type, message_id, email_id)'
		),
		db.prepare(
			"CREATE INDEX IF NOT EXISTS idx_mail_unindexed ON email(account_id, email_id) WHERE conversation_key = ''"
		),
		db.prepare(
			'CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_ingest ON email(ingest_key) WHERE ingest_key IS NOT NULL'
		),
		db.prepare(
			'CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_send ON email(send_key) WHERE send_key IS NOT NULL'
		),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_send_attempt (
      request_key TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
      fingerprint TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', email_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_conversation_pin (
      user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
      conversation_key TEXT NOT NULL, PRIMARY KEY(user_id, account_id, conversation_key)
    )`)
	]);
}
