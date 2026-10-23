export const MAIL_CHAT_SCHEMA_MARKER = 'mail_chat_schema_v4';

export async function migrateMailChat(db) {
	const { results } = await db.prepare('PRAGMA table_info(email)').all();
	const names = new Set(results.map((row) => row.name));
	const { results: attachmentTables } = await db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'")
		.all();
	for (const [name, type] of [
		['conversation_key', "TEXT NOT NULL DEFAULT ''"],
		['conversation_peers', "TEXT NOT NULL DEFAULT '[]'"],
		['reply_to', "TEXT NOT NULL DEFAULT '[]'"],
		['ingest_key', 'TEXT'],
		['send_key', 'TEXT']
	]) {
		if (!names.has(name)) {
			try {
				await db.prepare(`ALTER TABLE email ADD COLUMN ${name} ${type}`).run();
			} catch (error) {
				// Another isolate may have applied the same additive migration.
				// Ignore the error only after verifying the column now exists.
				const current = await db.prepare('PRAGMA table_info(email)').all();
				if (!current.results.some((column) => column.name === name)) throw error;
			}
		}
	}
	await db.batch([
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_user_locale (
      user_id INTEGER PRIMARY KEY REFERENCES user(user_id) ON DELETE CASCADE,
      locale TEXT NOT NULL
    )`),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_user_profile (
      user_id INTEGER PRIMARY KEY REFERENCES user(user_id) ON DELETE CASCADE,
      display_name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT ''
    )`),
		...(attachmentTables.length
			? [db.prepare('CREATE INDEX IF NOT EXISTS idx_mail_attachment_key ON attachments(key)')]
			: []),
		db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_mail_conversation ON email(user_id, account_id, conversation_key, email_id)'
		),
		...(names.has('create_time')
			? [
					db.prepare(
						'CREATE INDEX IF NOT EXISTS idx_mail_conversation_time ON email(user_id,account_id,conversation_key,create_time,email_id)'
					)
				]
			: []),
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
			)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_live_session (
      user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
      session_id TEXT NOT NULL, account_id INTEGER NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
      peer_account_id INTEGER, expires_at INTEGER NOT NULL, typing_until INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id, session_id)
    )`),
		db.prepare(
			'CREATE INDEX IF NOT EXISTS idx_mail_live_expiry ON mail_live_session(user_id, expires_at)'
		),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_conversation_revision (
      user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
      conversation_key TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id, account_id, conversation_key)
    )`),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_conversation_contact (
      user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
      conversation_key TEXT NOT NULL, peer_email TEXT NOT NULL,
      PRIMARY KEY(user_id, account_id, conversation_key)
    )`),
		db.prepare(`CREATE TABLE IF NOT EXISTS mail_removed_message (
      email_id INTEGER PRIMARY KEY REFERENCES email(email_id) ON DELETE CASCADE
    )`),
		db.prepare(`CREATE TRIGGER IF NOT EXISTS mail_keep_bilateral_deleted AFTER UPDATE OF is_del ON email
      WHEN NEW.is_del=0 AND EXISTS(SELECT 1 FROM mail_removed_message WHERE email_id=NEW.email_id)
      BEGIN UPDATE email SET is_del=1 WHERE email_id=NEW.email_id; END`),
		db.prepare(`CREATE TABLE IF NOT EXISTS ${MAIL_CHAT_SCHEMA_MARKER} (id INTEGER PRIMARY KEY)`)
	]);
}

const readyBindings = new WeakSet();

export async function ensureMailChat(env) {
	const db = env.db;
	if (!db || readyBindings.has(db)) return;
	const marker = await db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.bind(MAIL_CHAT_SCHEMA_MARKER)
		.first();
	if (!marker) {
		const columns = await db.prepare('PRAGMA table_info(email)').all();
		// Allow the existing authenticated initializer to bootstrap a fresh DB.
		if (!columns.results.length) return;
		await migrateMailChat(db);
	}
	readyBindings.add(db);
}
