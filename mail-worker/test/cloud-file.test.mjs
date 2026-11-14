import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { categoryOf, folderPath } from '../src/lib/cloud-file-paths.mjs';
import { migrateCloudFiles } from '../src/init/cloud-file-schema.js';
import { createCostAction } from '../src/lib/costaction.mjs';

test('files are classified by type, then by extension', () => {
	assert.equal(categoryOf('a.bin', 'image/png'), 'image');
	assert.equal(categoryOf('clip.MOV'), 'video');
	assert.equal(categoryOf('song.flac'), 'audio');
	assert.equal(categoryOf('report.pdf'), 'document');
	assert.equal(categoryOf('idman安装 激活.zip'), 'archive');
	assert.equal(categoryOf('data.unknown'), 'other');
	assert.equal(categoryOf('notes', 'text/plain'), 'document');
});

test('folder path is Cloud-Mail/<category>/<year>/<month> in UTC', () => {
	const t = Date.UTC(2026, 0, 31, 23, 30) / 1000;
	assert.deepEqual(folderPath('archive', t), ['Cloud-Mail', '压缩包', '2026', '01']);
	assert.deepEqual(folderPath('nope', t), ['Cloud-Mail', '其他', '2026', '01']);
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
test('folder API: create returns the integer ID; an existing name answers null; search matches the parent', async () => {
	const calls = [];
	const responses = [
		json(201, { folder: { id: 77, name: 'Cloud-Mail' }, status: 'success' }),
		json(422, { message: 'Folder with the same name already exists', status: 'error' }),
		json(200, { current_page: 1, last_page: 1, data: [{ id: 5, name: '2026', parent_folder_id: 9 }, { id: 6, name: '2026', parent_folder_id: 77 }], status: 'success' })
	];
	const api = createCostAction({ token: 't', apptype: 'fd2', fetch: async (url, init) => { calls.push({ url, body: init.body && JSON.parse(init.body) }); return responses.shift(); } });
	assert.equal(await api.createFolder('Cloud-Mail'), 77);
	assert.deepEqual(calls[0].body, { name: 'Cloud-Mail', can_be_copied: false, apptype: 'fd2', parent_folder_id: null });
	assert.equal(await api.createFolder('2026', 77), null);
	assert.equal(await api.findFolder('2026', 77), 6);
	assert.deepEqual(calls[2].body, { apptype: 'fd2', name: '2026' });
});

test('upload URLs go to the chosen program and its folder; hitfile hosts are accepted for fd2', async () => {
	let sent;
	const api = createCostAction({ token: 't', apptype: 'fd2', fetch: async (url, init) => { sent = JSON.parse(init.body); return json(200, { url: 'https://s5.hitfile.net/v2/file/x', status: 'success' }); } });
	assert.equal((await api.requestUploadUrl(42)).url, 'https://s5.hitfile.net/v2/file/x');
	assert.deepEqual(sent, { apptype: 'fd2', folder_id: 42 });
	// An unknown program falls back to fd1.
	const fallback = createCostAction({ token: 't', apptype: 'zz', fetch: async (url, init) => { sent = JSON.parse(init.body); return json(200, { url: 'https://s1.turbobit.net/x', status: 'success' }); } });
	await fallback.requestUploadUrl();
	assert.equal(sent.apptype, 'fd1');
});

// A D1-like wrapper over node:sqlite, enough for the migration.
function d1(db) {
	const stmt = (sql, args = []) => ({
		bind: (...a) => stmt(sql, a),
		run: async () => db.prepare(sql).run(...args),
		all: async () => ({ results: db.prepare(sql).all(...args) }),
		first: async () => db.prepare(sql).get(...args) ?? null
	});
	return { prepare: (sql) => stmt(sql), batch: async (list) => { for (const s of list) await s.run(); } };
}

test('migration: existing large attachments become files, message copies link to them, uploads join the uploader\'s library', async () => {
	const db = new DatabaseSync(':memory:');
	db.exec(`CREATE TABLE setting (id INTEGER);
    CREATE TABLE attachments (att_id INTEGER PRIMARY KEY, user_id INTEGER, email_id INTEGER, filename TEXT, size INTEGER,
      storage TEXT NOT NULL DEFAULT '', remote_id TEXT NOT NULL DEFAULT '', remote_status TEXT NOT NULL DEFAULT '', client_key TEXT NOT NULL DEFAULT '');
    INSERT INTO attachments VALUES (1, 10, 5, 'a.zip', 100, 'costaction', 'R1', 'ready', 'k1');
    INSERT INTO attachments VALUES (2, 20, 6, 'a.zip', 100, 'costaction', 'R1', 'ready', '');
    INSERT INTO attachments VALUES (3, 10, 0, 'b.zip', 50, 'costaction', '', 'failed', 'k2');
    INSERT INTO attachments VALUES (4, 10, 7, 'pic.png', 9, '', '', '', '');`);
	const wrapped = d1(db);
	await migrateCloudFiles(wrapped);
	await migrateCloudFiles(wrapped); // idempotent
	const files = db.prepare('SELECT file_id, uploader_id, remote_id, status FROM cloud_file ORDER BY file_id').all();
	assert.deepEqual(files.map((f) => [f.uploader_id, f.remote_id, f.status]), [[10, 'R1', 'ready'], [10, '', 'failed']]);
	const links = db.prepare('SELECT att_id, file_id FROM attachments ORDER BY att_id').all().map((r) => r.file_id);
	assert.deepEqual(links, [files[0].file_id, files[0].file_id, files[1].file_id, 0]);
	assert.deepEqual(db.prepare('SELECT user_id, file_id, uploaded FROM user_file').all().map((r) => [r.user_id, r.file_id, r.uploaded]), [[10, files[0].file_id, 1]]);
	assert.ok(db.prepare("SELECT costaction_apptype FROM setting").all());
});
