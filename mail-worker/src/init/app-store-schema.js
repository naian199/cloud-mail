// App store: download-type apps whose installers are CostAction files verified by this site.
//
//   app          one listing, owned by its publisher.
//                status: draft -> review -> published | rejected; published -> hidden (publisher)
//                or removed (reviewer takedown). removed_by says who took it down.
//   app_version  one installer for one platform. file_id is a cloud_file the publisher uploaded
//                and the Worker verified (status 'ready').
//                status: review -> published | rejected; published -> withdrawn (publisher) or
//                blocked (reviewer). Only published versions of published apps can be downloaded.
//   click_count  counts download clicks on this site; it is not a completed download and not
//                the provider's settled earnings.
// Chat attachments never become listings: a version only references a file on purpose.

const MARKER = 'app_store_schema_v1';

const TABLES = [
	`CREATE TABLE IF NOT EXISTS app (
    app_id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'tools',
    source_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    removed_by TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    publish_time INTEGER NOT NULL DEFAULT 0,
    create_time INTEGER NOT NULL DEFAULT (unixepoch()),
    update_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
	`CREATE INDEX IF NOT EXISTS idx_app_status ON app(status, publish_time DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_app_publisher ON app(publisher_id)`,
	`CREATE TABLE IF NOT EXISTS app_version (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id INTEGER NOT NULL REFERENCES app(app_id),
    version TEXT NOT NULL,
    platform TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    file_id INTEGER NOT NULL REFERENCES cloud_file(file_id),
    status TEXT NOT NULL DEFAULT 'review',
    review_note TEXT NOT NULL DEFAULT '',
    click_count INTEGER NOT NULL DEFAULT 0,
    publish_time INTEGER NOT NULL DEFAULT 0,
    create_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
	`CREATE INDEX IF NOT EXISTS idx_app_version_app ON app_version(app_id, status)`
];

// Permissions: publishing and reviewing are granted per role; the site admin has both.
const PERMS = [
	`INSERT OR IGNORE INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES (37, '应用商城', NULL, 0, 1, 6)`,
	`INSERT OR IGNORE INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES (38, '发布应用', 'app:publish', 37, 2, 0)`,
	`INSERT OR IGNORE INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES (39, '审核应用', 'app:review', 37, 2, 1)`
];

export async function migrateAppStore(db) {
	await db.batch(TABLES.map((sql) => db.prepare(sql)));
	for (const sql of PERMS) {
		try { await db.prepare(sql).run(); } catch (e) { console.warn(`跳过数据：${e.message}`); }
	}
	await db.prepare(`CREATE TABLE IF NOT EXISTS ${MARKER} (id INTEGER PRIMARY KEY)`).run();
}

const ready = new WeakSet();

export async function ensureAppStore(env) {
	const db = env.db;
	if (!db || ready.has(db)) return;
	const marker = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(MARKER).first();
	if (!marker) {
		// A fresh database is set up by the initializer first; the store needs the perm table.
		const perm = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'perm'").first();
		if (!perm) return;
		await migrateAppStore(db);
	}
	ready.add(db);
}
