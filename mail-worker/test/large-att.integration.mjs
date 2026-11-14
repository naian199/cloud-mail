// Large attachments (CostAction/Turbobit) end to end, against a local Worker and a mock
// CostAction API. Nothing reaches the real service.
//
//   node --test test/large-att.integration.mjs
//
// Starts `wrangler dev` on 8791 with its own state directory and the test-only variables
// costaction_api_base / costaction_upload_origin pointing at the mock on 8790.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const worker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOCK = 8790, PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`, API = `${BASE}/api`, MOCK_ORIGIN = `http://127.0.0.1:${MOCK}`;
const TOKEN = 'ca-test-token-7f3e9b1c5d';
const ADMIN = 'owner@example.com', PEER = 'palmer@example.com', THIRD = 'third@example.com', PASSWORD = 'Passw0rd!123';

// ---- mock CostAction -------------------------------------------------------------
const files = new Map();
const seen = { auth: [], uploadAuth: [], uploadUrlCalls: 0, uploadFolders: {}, folderCreates: 0 };
const folders = []; // { id, name, parent, apptype }
let rateLimitNext = 0, nextId = 1, mockDown = false;
const mock = createServer(async (req, res) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = Buffer.concat(chunks);
	const send = (status, data, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(data)); };
	const url = new URL(req.url, MOCK_ORIGIN);
	if (url.pathname.startsWith('/upload/')) {
		seen.uploadAuth.push(req.headers.authorization || '');
		const form = await new Response(body, { headers: { 'content-type': req.headers['content-type'] } }).formData();
		const file = form.get('file');
		if (!file) return send(400, { status: 'error', message: 'Wrong upload url' });
		const id = `mockfile${nextId++}`;
		files.set(id, { id, name: file.name, size: file.size, deleted: false, folder: seen.uploadFolders[url.pathname.split('/')[2]] });
		return send(200, { id, message: 'Everything is ok', delete_id: 'DEL' + id, status: 'success' });
	}
	if (mockDown) return send(503, { status: 'error', message: 'Service unavailable' });
	seen.auth.push(req.headers.authorization || '');
	if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'This action is unauthorized.', status: 'error' });
	if (req.method === 'POST' && url.pathname === '/v1/file/upload_url') {
		seen.uploadUrlCalls++;
		if (rateLimitNext > 0) { rateLimitNext--; return send(429, { message: 'Too many attempts', status: 'error', 'retry-after': 1 }, { 'retry-after': '1' }); }
		const req = JSON.parse(body.toString() || '{}');
		seen.uploadFolders[seen.uploadUrlCalls] = req.folder_id;
		return send(200, { url: `${MOCK_ORIGIN}/upload/${seen.uploadUrlCalls}`, expire: '2099-01-01 00:00:00', status: 'success' });
	}
	if (req.method === 'POST' && url.pathname === '/v1/folder/create') {
		const { name, parent_folder_id: parent = null, apptype } = JSON.parse(body.toString());
		seen.folderCreates++;
		if (folders.some((f) => f.name === name && f.parent === parent && f.apptype === apptype)) return send(422, { status: 'error', message: 'Folder with the same name already exists' });
		const folder = { id: 1000 + folders.length, name, parent, apptype };
		folders.push(folder);
		return send(201, { folder: { id: folder.id, name, parent_folder_id: parent }, status: 'success' });
	}
	if (req.method === 'POST' && url.pathname === '/v1/folders/search') {
		const { name, apptype } = JSON.parse(body.toString());
		const data = folders.filter((f) => f.apptype === apptype && f.name.includes(name)).map((f) => ({ id: f.id, name: f.name, parent_folder_id: f.parent }));
		return send(200, { current_page: 1, last_page: 1, data, status: 'success' });
	}
	const match = url.pathname.match(/^\/v1\/file\/([^/]+)(\/share)?$/);
	const file = match && files.get(match[1]);
	if (!match || !file) return send(404, { message: 'File not found or wrong ID', status: 'error' });
	if (req.method === 'DELETE') { if (file.deleted) return send(403, { status: 'error', message: 'File already deleted' }); file.deleted = true; return send(200, { status: 'success' }); }
	if (match[2]) return send(200, { links: { for_downloading: { standard: `https://turbobit.net/${file.id}.html`, with_file_name: `https://turbobit.net/${file.id}/${file.name}.html` } }, status: 'success' });
	return send(200, { file: { id: file.id, name: file.name, size_in_bytes: file.size, is_deleted: file.deleted, delete_reason: file.deleted ? 'user' : null, days_left: '30' }, status: 'success' });
});

// ---- local Worker -----------------------------------------------------------------
let wrangler, log = '';
const stateDir = path.join(worker, '.wrangler', 'large-att-test');
const config = path.join(worker, 'wrangler-large-att-test.toml');

async function call(pathname, token, method = 'GET', body) {
	const response = await fetch(API + pathname, {
		method,
		headers: { 'content-type': 'application/json', ...(token ? { Authorization: token } : {}) },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	return { status: response.status, text: await response.text(), get data() { return JSON.parse(this.text); } };
}
const ok = async (...args) => { const r = await call(...args); assert.equal(r.data.code, 200, `${args[0]}: ${r.text}`); return r.data.data; };
const login = async (email) => (await ok('/login', null, 'POST', { email, password: PASSWORD })).token;
// The browser posts the file to the Worker, which relays it to the storage service.
const relay = async (token, attId, name, size) => {
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(size)]), name);
	return (await fetch(`${API}/large-att/${attId}/upload`, { method: 'POST', headers: { Authorization: token }, body: form })).json();
};
let admin, peer, adminAccount, peerAccount;
const folderPathOf = (id) => { const names = []; for (let f = folders.find((x) => x.id === id); f; f = folders.find((x) => x.id === f.parent)) names.unshift(f.name); return names.join('/'); };
// Reads or changes the local D1 database directly (test setup only).
const d1 = (sql) => new Promise((resolve, reject) => {
	const p = spawn(path.join(worker, 'node_modules/.bin/wrangler'), ['d1', 'execute', 'email', '--local', '--persist-to', stateDir, '--config', config, '--json', '--command', sql], { cwd: worker });
	let out = '';
	p.stdout.on('data', (d) => { out += d; });
	p.on('close', (code) => { try { resolve(JSON.parse(out)[0].results); } catch { reject(new Error(`d1 failed (${code}): ${out}`)); } });
});
const library = async (token, query = '') => (await ok(`/cloud-file/list${query}`, token)).list;

before(async () => {
	await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));
	const dev = readFileSync(path.join(worker, 'wrangler-dev.toml'), 'utf8');
	writeFileSync(config, dev.replace(/^admin = .*$/m, `admin = "${ADMIN}"`));
	const secret = dev.match(/^jwt_secret = "(.*)"$/m)[1];
	rmSync(stateDir, { recursive: true, force: true });
	wrangler = spawn(path.join(worker, 'node_modules/.bin/wrangler'), ['dev', '--config', config, '--port', String(PORT), '--persist-to', stateDir, '--test-scheduled',
		'--var', `costaction_api_base:${MOCK_ORIGIN}`, '--var', `costaction_upload_origin:${MOCK_ORIGIN}`], { cwd: worker });
	wrangler.stdout.on('data', (d) => { log += d; });
	wrangler.stderr.on('data', (d) => { log += d; });
	for (let i = 0; i < 120; i++) {
		try { if ((await fetch(`${API}/setting/websiteConfig`)).ok) break; } catch {}
		await new Promise((r) => setTimeout(r, 1000));
	}
	await fetch(`${API}/init/${secret}`);
	await ok('/register', null, 'POST', { email: ADMIN, password: PASSWORD });
	await ok('/register', null, 'POST', { email: PEER, password: PASSWORD });
	await ok('/register', null, 'POST', { email: THIRD, password: PASSWORD });
	admin = await login(ADMIN); peer = await login(PEER);
	adminAccount = (await ok('/my/loginUserInfo', admin)).account.accountId;
	peerAccount = (await ok('/my/loginUserInfo', peer)).account.accountId;
});

after(async () => {
	wrangler?.kill();
	mock.close();
	rmSync(config, { force: true });
});

const MB = 1024 * 1024;
const clientId = () => crypto.randomUUID().replaceAll('-', '');

test('disabled by default and the token stays on the server', async () => {
	assert.equal((await ok('/large-att/config', admin)).enabled, false);
	await ok('/setting/set', admin, 'PUT', { costactionStatus: 0, costactionToken: TOKEN, costactionMinSize: MB, costactionMaxSize: 5 * MB });
	const query = await call('/setting/query', admin);
	assert.ok(!query.text.includes(TOKEN));
	assert.equal(query.data.data.costactionTokenSet, true);
	assert.ok(!(await call('/setting/websiteConfig', admin)).text.includes(TOKEN));
	// Saving other settings with an empty token keeps the saved one.
	await ok('/setting/set', admin, 'PUT', { costactionToken: '', title: 'Cloud Mail' });
	assert.equal((await ok('/setting/query', admin)).costactionTokenSet, true);
	assert.deepEqual(await ok('/setting/costactionTest', admin, 'POST', {}), { ok: true });
	assert.deepEqual(await ok('/setting/costactionTest', admin, 'POST', { token: 'wrong' }), { ok: false, reason: 'unauthorized' });
	assert.equal((await ok('/large-att/config', admin)).enabled, true);
});

test('only allowed roles may upload; normal users may not test the connection', async () => {
	assert.equal((await ok('/large-att/config', peer)).enabled, false);
	const denied = await call('/large-att/begin', peer, 'POST', { accountId: peerAccount, filename: 'a.bin', size: 2 * MB, clientId: clientId() });
	assert.equal(denied.data.code, 403);
	assert.notEqual((await call('/setting/costactionTest', peer, 'POST', {})).data.code, 200);
});

test('any size up to the maximum is accepted; empty and oversized files are not', async () => {
	assert.equal((await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'tiny.txt', size: 12, clientId: clientId() })).status, 'uploading');
	for (const size of [0, 5 * MB + 1]) {
		const r = await call('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'a.bin', size, clientId: clientId() });
		assert.equal(r.data.code, 400);
	}
});

let sentAtt, remoteId;
test('upload: one row per request ID, the file is verified before it is ready', async () => {
	const id = clientId(), size = 2 * MB;
	const first = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id });
	assert.equal(first.uploadUrl, undefined, 'upload URLs stay on the server');
	const retry = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id });
	assert.equal(retry.attId, first.attId);
	const conflict = await call('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'other.zip', size, clientId: id });
	assert.equal(conflict.data.code, 409);

	assert.equal((await call('/large-att/complete', admin, 'POST', { attId: first.attId, remoteId: 'mockfile999' })).data.code, 404);
	// Another user cannot upload into this record.
	assert.notEqual((await relay(peer, first.attId, 'archive.zip', size)).code, 200);
	// A body that does not match the registered size is refused before anything is relayed.
	assert.equal((await relay(admin, first.attId, 'archive.zip', MB)).code, 400);
	const done = await relay(admin, first.attId, 'archive.zip', size);
	assert.equal(done.code, 200, JSON.stringify(done));
	assert.equal(done.data.status, 'ready');
	assert.equal(seen.uploadAuth.at(-1), '', 'the relayed upload carries no token');
	const uploaded = { id: [...files.keys()].at(-1) };
	assert.equal(files.get(uploaded.id).size, size);
	// Once ready, the same request ID does not start another upload.
	const calls = seen.uploadUrlCalls;
	assert.equal((await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id })).status, 'ready');
	assert.equal(seen.uploadUrlCalls, calls);
	sentAtt = first.attId; remoteId = uploaded.id;
});

test('a 429 from the API is retried after retry-after', async () => {
	rateLimitNext = 1;
	const r = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'b.zip', size: 2 * MB, clientId: clientId() });
	assert.equal((await relay(admin, r.attId, 'b.zip', 2 * MB)).data.status, 'ready');
	assert.equal(rateLimitNext, 0);
});

let peerAttId;
let sentFile;
test('the upload is filed under Cloud-Mail/<category>/<year>/<month> and lands in the uploader\'s library', async () => {
	const date = new Date();
	const month = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
	assert.equal(folderPathOf(files.get(remoteId).folder), `Cloud-Mail/压缩包/${month}`);
	const mine = await library(admin);
	const entry = mine.find((f) => f.filename === 'archive.zip');
	assert.ok(entry, JSON.stringify(mine));
	assert.deepEqual([entry.uploaded, entry.viewed, entry.downloaded, entry.category, entry.status], [true, false, false, 'archive', 'ready']);
	sentFile = entry.fileId;
	// Folders are created once and then cached.
	const creates = seen.folderCreates;
	const begun = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'second.zip', size: 2 * MB, clientId: clientId() });
	await relay(admin, begun.attId, 'second.zip', 2 * MB);
	assert.equal(seen.folderCreates, creates);
	assert.equal(folderPathOf(files.get([...files.keys()].at(-1)).folder), `Cloud-Mail/压缩包/${month}`);
	// A video goes to its own category folder.
	const video = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'clip.mp4', mimeType: 'video/mp4', size: 2 * MB, clientId: clientId() });
	await relay(admin, video.attId, 'clip.mp4', 2 * MB);
	assert.equal(folderPathOf(files.get([...files.keys()].at(-1)).folder), `Cloud-Mail/视频/${month}`);
});

test('send in an internal chat; the recipient sees the file; showing it does not collect it', async () => {
	await ok('/mail-chat/send', admin, 'POST', { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: '', attachments: [], largeAttIds: [sentAtt], clientId: clientId() });
	// The same upload cannot be attached twice.
	const again = await call('/mail-chat/send', admin, 'POST', { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: 'x', attachments: [], largeAttIds: [sentAtt], clientId: clientId() });
	assert.equal(again.data.code, 409);
	const { conversations } = await ok(`/mail-chat/conversations?accountId=${peerAccount}&category=internal`, peer);
	const messages = await ok(`/mail-chat/messages?accountId=${peerAccount}&key=${conversations[0].key}`, peer);
	const message = messages.messages.find((m) => m.largeFiles?.length);
	assert.ok(message, JSON.stringify(messages).slice(0, 400));
	const [file] = message.largeFiles;
	assert.deepEqual([file.fileId, file.filename, file.size, file.status, file.category, file.preview], [sentFile, 'archive.zip', 2 * MB, 'ready', 'archive', 'none']);
	assert.equal(message.attachments.length, 0, 'large files are not treated as media');
	peerAttId = file.attId;
	assert.equal((await library(peer)).length, 0, 'loading messages collects nothing');
	// The stored-file endpoint does not serve large attachments.
	assert.equal((await call(`/mail-chat/attachment/${peerAttId}`, peer)).data.code, 404);
});

test('clicking download opens the official share page and collects the file as downloaded', async () => {
	const link = await ok(`/cloud-file/${sentFile}/download`, peer, 'POST');
	assert.equal(link.url, `https://turbobit.net/${remoteId}/archive.zip.html`);
	const [entry] = await library(peer);
	assert.deepEqual([entry.fileId, entry.uploaded, entry.downloaded], [sentFile, false, true]);
	// Viewing adds a mark to the same single entry.
	await ok(`/cloud-file/${sentFile}/view`, peer, 'POST');
	const entries = await library(peer);
	assert.equal(entries.length, 1);
	assert.deepEqual([entries[0].viewed, entries[0].downloaded], [true, true]);
	// Search, type filter and marks.
	assert.equal((await library(peer, '?q=archive')).length, 1);
	assert.equal((await library(peer, '?q=nothing')).length, 0);
	assert.equal((await library(peer, '?category=video')).length, 0);
	assert.equal((await library(admin, '?category=video')).length, 1);
	assert.equal((await library(admin, '?mark=downloaded')).length, 0);
	// Another user without access cannot reach a file by its ID.
	assert.equal((await call(`/cloud-file/${sentFile}/download`, await login(THIRD), 'POST')).data.code, 404);
});

test('deleting the chat for both keeps both libraries, and downloads still work from them', async () => {
	const { conversations } = await ok(`/mail-chat/conversations?accountId=${adminAccount}&category=internal`, admin);
	const conv = conversations.find((x) => x.peerEmail === PEER || x.email === PEER) || conversations[0];
	const messages = await ok(`/mail-chat/messages?accountId=${adminAccount}&key=${conv.key}`, admin);
	const through = messages.messages.at(-1).emailId;
	await ok('/mail-chat/delete', admin, 'POST', { accountId: adminAccount, key: conv.key, through });
	assert.ok((await library(admin)).some((f) => f.fileId === sentFile));
	assert.ok((await library(peer)).some((f) => f.fileId === sentFile));
	assert.ok((await ok(`/cloud-file/${sentFile}/download`, peer, 'POST')).url);
	assert.ok((await ok(`/cloud-file/${sentFile}/download`, admin, 'POST')).url);
});

test('removing a library entry affects only that user, not the original', async () => {
	await ok(`/cloud-file/${sentFile}`, peer, 'DELETE');
	assert.equal((await library(peer)).length, 0);
	// The chat is gone and the entry removed: the peer has no way to the file any more.
	assert.equal((await call(`/cloud-file/${sentFile}/download`, peer, 'POST')).data.code, 404);
	assert.ok((await library(admin)).some((f) => f.fileId === sentFile));
	assert.equal(files.get(remoteId).deleted, false);
});

test('retrying a committed send returns the same message', async () => {
	const id = clientId(), size = 2 * MB;
	const begun = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'retry.zip', size, clientId: clientId() });
	assert.equal((await relay(admin, begun.attId, 'retry.zip', size)).data.status, 'ready');
	const payload = { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: 'retry', attachments: [], largeAttIds: [begun.attId], clientId: id };
	const first = await ok('/mail-chat/send', admin, 'POST', payload);
	// The reply was lost; the composer resends the same request.
	const second = await ok('/mail-chat/send', admin, 'POST', payload);
	assert.equal(second.emailId, first.emailId);
});

test('existing small attachments keep working', async () => {
	const content = Buffer.from('hello attachment').toString('base64');
	await ok('/mail-chat/send', admin, 'POST', { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: 'small', attachments: [{ filename: 'note.txt', contentType: 'text/plain', content }], clientId: clientId() });
	const { conversations } = await ok(`/mail-chat/conversations?accountId=${peerAccount}&category=internal`, peer);
	const messages = await ok(`/mail-chat/messages?accountId=${peerAccount}&key=${conversations[0].key}`, peer);
	const att = messages.messages.flatMap((m) => m.attachments).find((a) => a.filename === 'note.txt');
	const response = await fetch(`${API}/mail-chat/attachment/${att.attId}`, { headers: { Authorization: peer } });
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'hello attachment');
});

test('a draft can be removed from the composer without deleting anything remote', async () => {
	const begun = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'draft.zip', size: 2 * MB, clientId: clientId() });
	await relay(admin, begun.attId, 'draft.zip', 2 * MB);
	const remote = [...files.keys()].at(-1);
	await ok(`/large-att/${begun.attId}`, admin, 'DELETE');
	assert.equal(files.get(remote).deleted, false);
	assert.ok((await library(admin)).some((f) => f.filename === 'draft.zip'), 'an uploaded file stays in the library');
});

test('previews: the uploader stores a small one; it is served for 7 days, then the card stays downloadable', async () => {
	const begun = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'photo.jpg', mimeType: 'image/jpeg', size: 2 * MB, clientId: clientId() });
	const done = await relay(admin, begun.attId, 'photo.jpg', 2 * MB);
	const fileId = done.data.fileId;
	const put = (token, body, type = 'image/webp') => fetch(`${API}/cloud-file/${fileId}/preview`, { method: 'PUT', headers: { Authorization: token, 'content-type': type }, body });
	assert.notEqual((await (await put(peer, new Uint8Array(100))).json()).code, 200, 'only the uploader stores a preview');
	assert.equal((await (await put(admin, new Uint8Array(100), 'text/html')).json()).code, 400);
	assert.equal((await (await put(admin, new Uint8Array(600 * 1024))).json()).code, 400);
	assert.equal((await (await put(admin, new Uint8Array([1, 2, 3, 4]))).json()).code, 200);
	const image = await fetch(`${API}/cloud-file/${fileId}/preview`, { headers: { Authorization: admin } });
	assert.equal(image.status, 200);
	assert.equal(image.headers.get('content-type'), 'image/webp');
	assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [1, 2, 3, 4]);
	assert.equal((await library(admin)).find((f) => f.fileId === fileId).preview, 'ready');
	// Others without access get nothing.
	assert.equal((await (await fetch(`${API}/cloud-file/${fileId}/preview`, { headers: { Authorization: peer } })).json()).code, 404);
	// Seven days later (moved back in time here), the hourly job drops it.
	await d1(`UPDATE cloud_file SET preview_until = unixepoch() - 1 WHERE file_id = ${fileId}`);
	assert.equal((await library(admin)).find((f) => f.fileId === fileId).preview, 'expired');
	assert.equal((await (await fetch(`${API}/cloud-file/${fileId}/preview`, { headers: { Authorization: admin } })).json()).code, 410);
	await fetch(`${BASE}/__scheduled?cron=0+*+*+*+*`);
	assert.deepEqual(await d1(`SELECT preview_key, preview_status FROM cloud_file WHERE file_id = ${fileId}`), [{ preview_key: '', preview_status: 'expired' }]);
	assert.ok((await ok(`/cloud-file/${fileId}/download`, admin, 'POST')).url, 'still downloadable');
});

test('a file deleted at CostAction shows as unavailable only once the API confirms it', async () => {
	const remote = files.get(remoteId);
	// A network failure is reported as retryable, not as deleted.
	mockDown = true;
	const down = await call(`/cloud-file/${sentFile}/download`, admin, 'POST');
	mockDown = false;
	assert.equal(down.data.code, 502);
	assert.equal((await library(admin)).find((f) => f.fileId === sentFile).status, 'ready');
	remote.deleted = true;
	assert.equal((await call(`/cloud-file/${sentFile}/download`, admin, 'POST')).data.code, 410);
	assert.equal((await library(admin)).find((f) => f.fileId === sentFile).status, 'deleted');
});

test('the token is never logged and only sent to the API', async () => {
	await new Promise((r) => setTimeout(r, 500));
	assert.ok(!log.includes(TOKEN), 'token found in Worker output');
	assert.ok(seen.auth.every((h) => h === `Bearer ${TOKEN}` || h === 'Bearer wrong'));
	assert.ok(seen.uploadAuth.every((h) => h === ''));
});
