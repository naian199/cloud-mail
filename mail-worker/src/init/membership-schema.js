// Cloud Mail membership (phase 1: site entitlement and orders only).
//
//   member_order     one purchase attempt. Price, currency and days are copied from the server's
//                    plan when the order is created and never taken from the client.
//                    status: pending | paid | failed | cancelled | refunded
//                    fulfilment: none | granted | revoked (the site entitlement for this order)
//   payment_event    one notice from a payment provider. event_id is the provider's unique
//                    transaction event, so a repeated notice is stored once and never applied twice.
//                    No card or account data is stored.
//   site_membership  the Cloud Mail entitlement per user (source 'site'). Vendor memberships and
//                    CostAction earnings are deliberately not modelled here.

const MARKER = 'membership_schema_v1';

const TABLES = [
	`CREATE TABLE IF NOT EXISTS member_order (
    order_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    plan_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    days INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    fulfilment TEXT NOT NULL DEFAULT 'none',
    failure TEXT NOT NULL DEFAULT '',
    create_time INTEGER NOT NULL DEFAULT (unixepoch()),
    paid_time INTEGER NOT NULL DEFAULT 0,
    update_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
	`CREATE INDEX IF NOT EXISTS idx_member_order_user ON member_order(user_id, create_time DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_member_order_status ON member_order(status, create_time DESC)`,
	`CREATE TABLE IF NOT EXISTS payment_event (
    event_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'pending',
    create_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
	`CREATE INDEX IF NOT EXISTS idx_payment_event_order ON payment_event(order_id)`,
	`CREATE TABLE IF NOT EXISTS site_membership (
    user_id INTEGER PRIMARY KEY,
    plan_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    update_time INTEGER NOT NULL DEFAULT (unixepoch())
  )`
];

const PERMS = [
	`INSERT OR IGNORE INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES (40, '会员中心', NULL, 0, 1, 7)`,
	`INSERT OR IGNORE INTO perm (perm_id, name, perm_key, pid, type, sort) VALUES (41, '会员订单查看', 'member:query', 40, 2, 0)`
];

export async function migrateMembership(db) {
	await db.batch(TABLES.map((sql) => db.prepare(sql)));
	for (const sql of PERMS) {
		try { await db.prepare(sql).run(); } catch (e) { console.warn(`跳过数据：${e.message}`); }
	}
	await db.prepare(`CREATE TABLE IF NOT EXISTS ${MARKER} (id INTEGER PRIMARY KEY)`).run();
}

const ready = new WeakSet();

export async function ensureMembership(env) {
	const db = env.db;
	if (!db || ready.has(db)) return;
	const marker = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(MARKER).first();
	if (!marker) {
		const perm = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'perm'").first();
		if (!perm) return;
		await migrateMembership(db);
	}
	ready.add(db);
}
