import test from 'node:test';
import assert from 'node:assert/strict';
import { packName, fetchPack, fetchSticker } from '../src/lib/telegram-stickers.mjs';
const token = '123456789:' + 'a'.repeat(30);
test('Telegram pack names accept ordinary and custom emoji packs; remote URLs cannot choose a provider', () => {
	for (const value of [
		'Animals',
		'https://t.me/addstickers/Animals',
		'https://telegram.me/addemoji/Animals/'
	])
		assert.equal(packName(value), 'Animals');
	for (const value of [
		'https://evil.com/addstickers/Animals',
		'https://t.me.evil.com/addstickers/Animals',
		'http://t.me/addstickers/Animals',
		'https://x@t.me/addstickers/Animals',
		'https://t.me:444/addstickers/Animals',
		'https://t.me/addstickers/Animals?x=1',
		'../secret',
		'https://t.me/other/Animals',
		null
	])
		assert.throws(() => packName(value));
});
test('all three Telegram sticker formats have token-free manifest entries', async () => {
	let calls = 0;
	const result = await fetchPack(token, 'Animals', async (url, options) => {
		calls++;
		assert.equal(url, `https://api.telegram.org/bot${token}/getStickerSet`);
		assert.equal(options.redirect, 'error');
		assert.deepEqual(JSON.parse(options.body), { name: 'Animals' });
		return Response.json({
			ok: true,
			result: {
				title: 'Animals',
				stickers: [
					{ file_id: 'static', emoji: '🐱' },
					{ file_id: 'animated', is_animated: true },
					{ file_id: 'video', is_video: true },
					{ file_id: '../../bad' }
				]
			}
		});
	});
	assert.equal(calls, 1);
	assert.deepEqual(
		result.stickers.map((s) => s.format),
		['webp', 'tgs', 'webm']
	);
	assert(!JSON.stringify(result).includes(token));
});
test('sticker downloads use only Telegram file paths and reject oversized or redirected content', async () => {
	const calls = [];
	const bytes = await fetchSticker(token, 'static', async (url) => {
		calls.push(url);
		return calls.length === 1
			? Response.json({ ok: true, result: { file_path: 'stickers/file_1.webp', file_size: 4 } })
			: new Response('RIFF');
	});
	assert.equal(new TextDecoder().decode(bytes), 'RIFF');
	assert.equal(calls[1], `https://api.telegram.org/file/bot${token}/stickers/file_1.webp`);
	for (const path of [
		'../secret.webp',
		'https://evil.com/x.webp',
		'stickers/x.svg',
		'stickers/x.webp?key=1'
	])
		await assert.rejects(
			fetchSticker(token, 'static', async () =>
				Response.json({ ok: true, result: { file_path: path } })
			)
		);
	await assert.rejects(
		fetchSticker(token, 'static', async () =>
			Response.json({ ok: true, result: { file_path: 'stickers/x.tgs', file_size: 2000000 } })
		)
	);
	let count = 0;
	await assert.rejects(
		fetchSticker(token, 'static', async () =>
			++count === 1
				? Response.json({ ok: true, result: { file_path: 'stickers/x.webp' } })
				: new Response(new Uint8Array(1024 * 1024 + 1))
		)
	);
	await assert.rejects(
		fetchPack('invalid', 'Animals', () => {
			throw Error('Must not fetch');
		})
	);
	await assert.rejects(
		fetchPack(token, 'Animals', async () => Response.json({ ok: false, description: token })),
		(error) => !error.message.includes(token)
	);
});
