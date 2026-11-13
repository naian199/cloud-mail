import test from 'node:test';
import assert from 'node:assert/strict';
import { createCostAction, kvRateLimiter, CostActionError } from '../src/lib/costaction.mjs';

const TOKEN = 'secret-token-value-123';
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function client(responses, extra = {}) {
	const calls = [], sleeps = [];
	const fetch = async (url, init) => {
		calls.push({ url, init });
		const next = responses.shift();
		if (next instanceof Error) throw next;
		return typeof next === 'function' ? next(url, init) : next;
	};
	return { api: createCostAction({ token: TOKEN, fetch, sleep: async (ms) => { sleeps.push(ms); }, ...extra }), calls, sleeps };
}

test('requests an fd1 upload URL with the bearer token', async () => {
	const { api, calls } = client([json(200, { url: 'https://s1.turbobit.net/v2/file/WG13', expire: '2026-11-14 10:00:00', status: 'success' })]);
	const result = await api.requestUploadUrl();
	assert.equal(result.url, 'https://s1.turbobit.net/v2/file/WG13');
	assert.equal(calls[0].url, 'https://api.costaction.com/v1/file/upload_url');
	assert.equal(calls[0].init.method, 'POST');
	assert.deepEqual(JSON.parse(calls[0].init.body), { apptype: 'fd1', folder_id: 0 });
	assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
});

test('rejects upload URLs outside https Turbobit hosts', async () => {
	for (const url of ['http://s1.turbobit.net/v2/file/x', 'https://evil.example/upload', 'https://turbobit.net.evil.example/x', 'not a url']) {
		const { api } = client([json(200, { url, status: 'success' })]);
		await assert.rejects(api.requestUploadUrl(), CostActionError);
	}
});

test('waits for retry-after on 429 and then succeeds', async () => {
	const { api, sleeps, calls } = client([
		json(429, { message: 'Too many attempts', status: 'error', 'retry-after': 9 }, { 'retry-after': '9' }),
		json(200, { url: 'https://s2.turbobit.net/v2/file/A', status: 'success' })
	]);
	await api.requestUploadUrl();
	assert.equal(calls.length, 2);
	assert.deepEqual(sleeps, [9000]);
});

test('caps the 429 wait and gives up after the retry budget', async () => {
	const many = Array.from({ length: 4 }, () => json(429, { message: 'Too many attempts', status: 'error' }, { 'retry-after': '600' }));
	const { api, sleeps } = client(many);
	await assert.rejects(api.requestUploadUrl(), (e) => e instanceof CostActionError && e.status === 429 && e.retryable);
	assert.deepEqual(sleeps, [30000, 30000, 30000]);
});

test('retries timeouts and server errors with backoff', async () => {
	const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
	const { api, sleeps } = client([abort, json(502, {}), json(200, { file: { id: 'abc', name: 'a.zip', size_in_bytes: 5, is_deleted: false, days_left: '30' }, status: 'success' })]);
	const info = await api.fileInfo('abc');
	assert.deepEqual(info, { id: 'abc', name: 'a.zip', size: 5, deleted: false, deleteReason: '', daysLeft: 30 });
	assert.deepEqual(sleeps, [1000, 2000]);
});

test('does not retry client errors', async () => {
	const { api, calls } = client([json(404, { message: 'File not found or wrong ID', status: 'error' })]);
	await assert.rejects(api.fileInfo('missing'), (e) => e.status === 404 && e.message === 'File not found or wrong ID');
	assert.equal(calls.length, 1);
});

test('download link prefers the link with the file name', async () => {
	const { api } = client([json(200, { links: { for_downloading: { standard: 'https://turbobit.net/abc.html', with_file_name: 'https://turbobit.net/abc/a.zip.html' } }, status: 'success' })]);
	assert.equal(await api.downloadLink('abc'), 'https://turbobit.net/abc/a.zip.html');
});

test('deleting an already deleted file counts as done', async () => {
	const { api, calls } = client([json(403, { message: 'File already deleted', status: 'error' })]);
	await api.deleteFile('abc');
	assert.match(calls[0].url, /\/v1\/file\/abc\?permanent=true$/);
	assert.equal(calls[0].init.method, 'DELETE');
});

test('connection test separates a bad token from a working one', async () => {
	assert.deepEqual(await client([json(404, { message: 'File not found or wrong ID', status: 'error' })]).api.testConnection(), { ok: true });
	assert.deepEqual(await client([json(401, { message: 'This action is unauthorized.', status: 'error' })]).api.testConnection(), { ok: false, reason: 'unauthorized' });
	const down = Array.from({ length: 4 }, () => new Error('offline'));
	assert.deepEqual(await client(down).api.testConnection(), { ok: false, reason: 'unavailable' });
});

test('the token never appears in errors', async () => {
	const cases = [new Error(`connect failed ${TOKEN}`), json(400, { message: 'Wrong upload url', status: 'error' })];
	for (const response of cases) {
		const { api } = client([response, response, response, response]);
		const error = await api.requestUploadUrl().catch((e) => e);
		assert.ok(!JSON.stringify({ message: error.message, stack: error.stack }).includes(TOKEN));
	}
});

test('refuses to run without a token', () => {
	assert.throws(() => createCostAction({ token: '' }), (e) => e.status === 503);
});

test('rate limiter waits for the next minute once the budget is spent', async () => {
	const store = new Map(), slept = [];
	let clock = 60_000 * 1000 + 59_000;
	const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
	const acquire = kvRateLimiter(kv, { perMinute: 2, now: () => clock, sleep: async (ms) => { slept.push(ms); clock += ms; } });
	await acquire(); await acquire(); await acquire();
	assert.equal(slept.length, 1);
	assert.ok(slept[0] > 0 && slept[0] <= 1050);
});
