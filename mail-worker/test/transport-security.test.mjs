import test from 'node:test';
import assert from 'node:assert/strict';
import { httpsRedirect, secureResponse } from '../src/lib/transport-security.js';

test('public HTTP redirects with method-preserving status; localhost development remains usable', () => {
	const response = httpsRedirect(
		new Request('http://mail.example/api/mail-chat/instant?test=1', {
			method: 'POST',
			body: 'test'
		})
	);
	assert.equal(response.status, 308);
	assert.equal(
		response.headers.get('Location'),
		'https://mail.example/api/mail-chat/instant?test=1'
	);
	for (const url of [
		'http://localhost:8787/api/test',
		'http://127.0.0.1:8787/',
		'http://[::1]:8787/',
		'http://worker.localhost:8787/',
		'https://mail.example/'
	])
		assert.equal(httpsRedirect(new Request(url)), null);
	assert(httpsRedirect(new Request('http://localhost.evil.example/')));
});

test('private responses and errors are not cached; response bytes, headers and status are retained', async () => {
	for (const path of [
		'/api/mail-chat/messages',
		'/api/allEmail/removed/1',
		'/api/mail-chat/attachment/1',
		'/attachments/private.png'
	]) {
		const response = secureResponse(
			new Response('original body', {
				status: 403,
				headers: {
					'Cache-Control': 'public,max-age=86400',
					'Access-Control-Allow-Origin': '*',
					'Content-Type': 'text/plain'
				}
			}),
			'https://mail.example' + path
		);
		assert.equal(response.status, 403);
		assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
		assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
		assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
		assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
		assert.equal(await response.text(), 'original body');
	}
});

test('public static caching and WebSocket upgrades remain intact', () => {
	const response = secureResponse(
		new Response('asset', { headers: { 'Cache-Control': 'public,max-age=3600' } }),
		'https://mail.example/assets/app.js'
	);
	assert.equal(response.headers.get('Cache-Control'), 'public,max-age=3600');
	const upgrade = { status: 101, webSocket: { privateHandle: true } };
	assert.equal(secureResponse(upgrade, 'https://mail.example/api/chat/socket'), upgrade);
	assert.equal(
		secureResponse(new Response('local'), 'http://127.0.0.1:8787/api/test').headers.get(
			'Strict-Transport-Security'
		),
		null
	);
});
