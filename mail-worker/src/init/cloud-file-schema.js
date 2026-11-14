// CostAction file service and personal document library.
//
// Three records with separate lifecycles:
//   cloud_file   one remote original (CostAction/Turbobit) and its short-lived preview.
//   user_file    a user's library entry for a file: uploaded / viewed / downloaded marks.
//   attachments  a message's link to a file (attachments.file_id), as before.
// Deleting chats deletes attachments rows only. Nothing here references email, so no chat
// deletion can cascade into cloud_file or user_file.

const MARKER = 'cloud_file_schema_v1';

const TABLES = [
	`CREATE TABLE IF NOT EXISTS cloud_file (
    file_id INTEGER PRIMARY KEY AUTOINCREMENT,
    uploader_id INTEGER NOT NULL,
    client_key TEXT NOT NULL DEFAULT '',
    apptype TEXT NOT NULL DEFAULT 'fd1',
    remote_id TEXT NOT NULL DEFAULT '',
    folder_id INTEGER NOT NULL DEFAULT 0,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    category TEXT NOT NULL DEFAULT 'other',
    status TEXT NOT NULL DEFAULT 'uploading',
    preview_key TEXT NOT NULL DEFAULT '',
    preview_type TEXT NOT NULL DEFAULT '',
    preview_status TEXT NOT NULL DEFAULT 'none',
    ready_at INTEGER NOT NULL DEFAULT 0,
    preview_until INTEGER NOT NULL DEFAULT 0,
    create_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_file_remote ON cloud_file(remote_id) WHERE remote_id != ''`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_file_client ON cloud_file(uploader_id, client_key) WHERE client_key != ''`,
	`CREATE INDEX IF NOT EXISTS idx_cloud_file_preview ON cloud_file(preview_until) WHERE preview_key != ''`,
	`CREATE TABLE IF NOT EXISTS user_file (
    user_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL REFERENCES cloud_file(file_id),
    uploaded INTEGER NOT NULL DEFAULT 0,
    viewed INTEGER NOT NULL DEFAULT 0,
    downloaded INTEGER NOT NULL DEFAULT 0,
    last_access INTEGER NOT NULL DEFAULT (unixepoch()),
    create_time INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, file_id)
  )`,
	`CREATE INDEX IF NOT EXISTS idx_user_file_recent ON user_file(user_id, last_access DESC)`,
	// Remote folder IDs for Cloud-Mail/<category>/<year>/<month>, per program.
	`CREATE TABLE IF NOT EXISTS cloud_folder (
    apptype TEXT NOT NULL,
    path TEXT NOT NULL,
    folder_id INTEGER NOT NULL,
    PRIMARY KEY (apptype, path)
  )`
];

async function tryRun(db, sql) {
	try {
		await db.prepare(sql).run();
	} catch (e) {
		if (!/duplicate column|already exists/i.test(e.message)) throw e;
	}
}

export async function migrateCloudFiles(db) {
	await db.batch(TABLES.map((sql) => db.prepare(sql)));
	await tryRun(db, "ALTER TABLE setting ADD COLUMN costaction_apptype TEXT NOT NULL DEFAULT 'fd1'");
	await tryRun(db, 'ALTER TABLE attachments ADD COLUMN file_id INTEGER NOT NULL DEFAULT 0');
	await tryRun(db, 'CREATE INDEX IF NOT EXISTS idx_attachments_file ON attachments(file_id) WHERE file_id != 0');
	// The data backfill runs once: /init runs on every deployment, and must not bring back
	// library entries users removed since.
	const migrated = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(MARKER).first();
	const columns = (await db.prepare('PRAGMA table_info(attachments)').all()).results.map((c) => c.name);
	if (!migrated && columns.includes('storage') && columns.includes('client_key')) {
		// Large attachments made before this schema: one file per upload record; then one per remote
		// ID that only survives as a message copy (its uploader's row was deleted), with no uploader;
		// then link every copy, and put each known upload in its uploader's library.
		await db.batch([
			db.prepare(`INSERT OR IGNORE INTO cloud_file(uploader_id, client_key, remote_id, filename, size, status, ready_at, create_time)
        SELECT user_id, client_key, remote_id, filename, size,
          CASE WHEN remote_status IN ('ready','failed','deleted','expired','uploading') THEN remote_status ELSE 'failed' END,
          CASE WHEN remote_status = 'ready' THEN unixepoch() ELSE 0 END, unixepoch()
        FROM attachments WHERE storage = 'costaction' AND client_key != ''`),
			db.prepare(`INSERT OR IGNORE INTO cloud_file(uploader_id, remote_id, filename, size, status, ready_at, create_time)
        SELECT 0, remote_id, filename, size,
          CASE WHEN remote_status IN ('ready','deleted','expired') THEN remote_status ELSE 'ready' END, unixepoch(), unixepoch()
        FROM attachments WHERE storage = 'costaction' AND remote_id != '' GROUP BY remote_id`),
			db.prepare(`UPDATE attachments SET file_id = COALESCE(
          (SELECT f.file_id FROM cloud_file f WHERE f.uploader_id = attachments.user_id AND f.client_key = attachments.client_key AND attachments.client_key != ''),
          (SELECT f.file_id FROM cloud_file f WHERE f.remote_id = attachments.remote_id AND attachments.remote_id != ''), 0)
        WHERE storage = 'costaction' AND file_id = 0`),
			db.prepare(`INSERT OR IGNORE INTO user_file(user_id, file_id, uploaded) SELECT uploader_id, file_id, 1 FROM cloud_file WHERE status = 'ready' AND uploader_id != 0`)
		]);
	}
	await db.prepare(`CREATE TABLE IF NOT EXISTS ${MARKER} (id INTEGER PRIMARY KEY)`).run();
}

const ready = new WeakSet();

export async function ensureCloudFiles(env) {
	const db = env.db;
	if (!db || ready.has(db)) return;
	const marker = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(MARKER).first();
	if (!marker) {
		// A fresh database is set up by the initializer first.
		const setting = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'setting'").first();
		if (!setting) return;
		await migrateCloudFiles(db);
	}
	ready.add(db);
}
