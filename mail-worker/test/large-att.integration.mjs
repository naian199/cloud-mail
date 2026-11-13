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
const ADMIN = 'owner@example.com', PEER = 'palmer@example.com', PASSWORD = 'Passw0rd!123';

// ---- mock CostAction -------------------------------------------------------------
const files = new Map();
const seen = { auth: [], uploadAuth: [], uploadUrlCalls: 0 };
let rateLimitNext = 0, nextId = 1;
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
		files.set(id, { id, name: file.name, size: file.size, deleted: false });
		return send(200, { id, message: 'Everything is ok', delete_id: 'DEL' + id, status: 'success' });
	}
	seen.auth.push(req.headers.authorization || '');
	if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { message: 'This action is unauthorized.', status: 'error' });
	if (req.method === 'POST' && url.pathname === '/v1/file/upload_url') {
		seen.uploadUrlCalls++;
		if (rateLimitNext > 0) { rateLimitNext--; return send(429, { message: 'Too many attempts', status: 'error', 'retry-after': 1 }, { 'retry-after': '1' }); }
		return send(200, { url: `${MOCK_ORIGIN}/upload/${seen.uploadUrlCalls}`, expire: '2099-01-01 00:00:00', status: 'success' });
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
const uploadToMock = async (url, name, size) => {
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(size)]), name);
	return (await fetch(url, { method: 'POST', body: form })).json();
};
let admin, peer, adminAccount, peerAccount;

before(async () => {
	await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));
	const dev = readFileSync(path.join(worker, 'wrangler-dev.toml'), 'utf8');
	writeFileSync(config, dev.replace(/^admin = .*$/m, `admin = "${ADMIN}"`));
	const secret = dev.match(/^jwt_secret = "(.*)"$/m)[1];
	rmSync(stateDir, { recursive: true, force: true });
	wrangler = spawn(path.join(worker, 'node_modules/.bin/wrangler'), ['dev', '--config', config, '--port', String(PORT), '--persist-to', stateDir,
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

test('size limits are enforced', async () => {
	for (const size of [MB - 1, 5 * MB + 1]) {
		const r = await call('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'a.bin', size, clientId: clientId() });
		assert.equal(r.data.code, 400);
	}
});

let sentAtt, remoteId;
test('upload: one row per request ID, the file is verified before it is ready', async () => {
	const id = clientId(), size = 2 * MB;
	const first = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id });
	assert.match(first.uploadUrl, /^http:\/\/127\.0\.0\.1:8790\/upload\//);
	const retry = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id });
	assert.equal(retry.attId, first.attId);
	const conflict = await call('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'other.zip', size, clientId: id });
	assert.equal(conflict.data.code, 409);

	const uploaded = await uploadToMock(retry.uploadUrl, 'archive.zip', size);
	assert.equal(seen.uploadAuth.at(-1), '', 'the browser-side upload carries no token');
	assert.equal((await call('/large-att/complete', admin, 'POST', { attId: first.attId, remoteId: 'mockfile999' })).data.code, 404);
	const done = await ok('/large-att/complete', admin, 'POST', { attId: first.attId, remoteId: uploaded.id });
	assert.equal(done.status, 'ready');
	// Once ready, the same request ID does not start another upload.
	const calls = seen.uploadUrlCalls;
	assert.equal((await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'archive.zip', size, clientId: id })).status, 'ready');
	assert.equal(seen.uploadUrlCalls, calls);
	sentAtt = first.attId; remoteId = uploaded.id;
});

test('a 429 from the API is retried after retry-after', async () => {
	rateLimitNext = 1;
	const r = await ok('/large-att/begin', admin, 'POST', { accountId: adminAccount, filename: 'b.zip', size: 2 * MB, clientId: clientId() });
	assert.ok(r.uploadUrl);
	assert.equal(rateLimitNext, 0);
});

let peerAttId;
test('send in an internal chat; the recipient sees the file and gets a download page', async () => {
	await ok('/mail-chat/send', admin, 'POST', { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: '', attachments: [], largeAttIds: [sentAtt], clientId: clientId() });
	// The same upload cannot be attached twice.
	const again = await call('/mail-chat/send', admin, 'POST', { accountId: adminAccount, recipients: [PEER], subject: 'Chat', text: 'x', attachments: [], largeAttIds: [sentAtt], clientId: clientId() });
	assert.equal(again.data.code, 409);
	const { conversations } = await ok(`/mail-chat/conversations?accountId=${peerAccount}&category=internal`, peer);
	const messages = await ok(`/mail-chat/messages?accountId=${peerAccount}&key=${conversations[0].key}`, peer);
	const message = messages.messages.find((m) => m.largeFiles?.length);
	assert.ok(message, JSON.stringify(messages).slice(0, 400));
	assert.deepEqual(message.largeFiles.map(({ attId, ...f }) => f), [{ filename: 'archive.zip', size: 2 * MB, status: 'ready' }]);
	assert.equal(message.attachments.length, 0, 'large files are not treated as media');
	peerAttId = message.largeFiles[0].attId;
	const link = await ok(`/large-att/${peerAttId}/link`, peer);
	assert.equal(link.url, `https://turbobit.net/${remoteId}/archive.zip.html`);
	// The stored-file endpoint does not serve large attachments.
	assert.equal((await call(`/mail-chat/attachment/${peerAttId}`, peer)).data.code, 404);
	// Another user's attachment ID is not reachable.
	assert.equal((await call(`/large-att/${sentAtt}/link`, peer)).data.code, 404);
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

test('only the uploader deletes; then the file is gone for everyone', async () => {
	assert.equal((await call(`/large-att/${peerAttId}`, peer, 'DELETE')).data.code, 404);
	await ok(`/large-att/${sentAtt}`, admin, 'DELETE');
	assert.equal(files.get(remoteId).deleted, true);
	assert.equal((await call(`/large-att/${peerAttId}/link`, peer)).data.code, 410);
});

test('the token is never logged and only sent to the API', async () => {
	await new Promise((r) => setTimeout(r, 500));
	assert.ok(!log.includes(TOKEN), 'token found in Worker output');
	assert.ok(seen.auth.every((h) => h === `Bearer ${TOKEN}` || h === 'Bearer wrong'));
	assert.ok(seen.uploadAuth.every((h) => h === ''));
});
