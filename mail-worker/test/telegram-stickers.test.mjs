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

test('copied short links and Telegram app links normalize without accepting other providers',()=>{
 for(const value of ['t.me/addstickers/Animals','telegram.me/addemoji/Animals','tg://addstickers?set=Animals','tg://addemoji?set=Animals'])assert.equal(packName(value),'Animals');
 for(const value of ['tg://evil?set=Animals','tg://addstickers?set=Animals&url=https://evil.com','tg://addstickers/secret?set=Animals'])assert.throws(()=>packName(value));
});
test('bot failures return actionable error codes without leaking provider messages or credentials',async()=>{
 for(const [status,body,key] of [[401,{},'stickersErrorAuth'],[200,{ok:false,error_code:400,description:token},'stickersErrorNotFound'],[200,{ok:false,error_code:401,description:token},'stickersErrorAuth']])
  await assert.rejects(()=>fetchPack(token,'Animals',async()=>Response.json(body,{status})),error=>error.message===key&&!error.message.includes(token));
 await assert.rejects(()=>fetchPack(token,'Animals',async()=>{throw Error(token);}),error=>error.message==='stickersErrorNetwork');
});
test('public-page fallback extracts only Telegram CDN sticker previews, bounds images and keeps stable IDs',async()=>{
 const {fetchPublicPack,fetchPublicSticker,publicStickerUrl}=await import('../src/lib/telegram-stickers.mjs');
 const html=`<html><div class="tgme_page_title">Animals</div><img src="https://evil.com/outside.webp"><div class="tgme_page_stickers_wrap"><div class="tgme_page_stickers"><i class="tgme_widget_sticker js-sticker_image" data-webp="https://cdn4.cdn-telegram.org/file/first"><img src="https://cdn4.cdn-telegram.org/file/first"></i><i class="js-sticker_image"><img src="https://cdn5.cdn-telegram.org/file/second"></i><img src="https://cdn4.cdn-telegram.org.evil.com/file/bad"><img src="http://cdn4.cdn-telegram.org/file/bad"></div></div></html>`;
 const pack=await fetchPublicPack('Animals',async(url,options)=>{assert.equal(url,'https://t.me/addstickers/Animals');assert.equal(options.redirect,'error');assert(!options.headers.Authorization);return new Response(html);});
 assert.equal(pack.partial,true);assert.equal(pack.source,'public');assert.equal(pack.stickers.length,2);assert.equal(pack.title,'Animals');
 const again=await fetchPublicPack('Animals',async()=>new Response(html.replace('first','replaced')));assert.equal(pack.stickers[1].id,again.stickers.find(s=>s.url.endsWith('second')).id);
 for(const url of ['https://127.0.0.1/file/x','https://cdn4.cdn-telegram.org.evil.com/file/x','https://user@cdn4.cdn-telegram.org/file/x','https://cdn4.cdn-telegram.org:8443/file/x','https://cdn4.cdn-telegram.org/secret'])assert.equal(publicStickerUrl(url),null);
 const bytes=await fetchPublicSticker(pack.stickers[0].url,async()=>new Response('RIFF0000WEBPdata'));assert.equal(bytes.mime,'image/webp');
 await assert.rejects(()=>fetchPublicSticker(pack.stickers[0].url,async()=>new Response('<svg onload="bad()"/>')));
 await assert.rejects(()=>fetchPublicSticker(pack.stickers[0].url,async()=>new Response(new Uint8Array(1024*1024+1))));
 await assert.rejects(()=>fetchPublicPack('Animals',async()=>new Response('<img src="https://cdn4.cdn-telegram.org/file/outside">')),error=>error.message==='stickersErrorPublic');
});
