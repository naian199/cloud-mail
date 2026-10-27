import {parseHTML} from 'linkedom';
const MAX = 1024 * 1024;
import {packName} from '../../../shared/telegram-pack-name.mjs';
export {packName};
async function bounded(response, max = MAX) {
	if (!response.ok || Number(response.headers.get('content-length') || 0) > max)
		throw Error('Sticker provider unavailable');
	const reader = response.body.getReader();
	let size = 0;
	const chunks = [];
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > max) throw Error('Sticker too large');
			chunks.push(value);
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}
async function call(token, method, params, request) {
	if (!/^\d{4,20}:[A-Za-z0-9_-]{20,100}$/.test(token || ''))
		throw Error('stickersErrorConfig');
	let response;
	try { response = await request(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
		redirect: 'error',
		signal: AbortSignal.timeout(15000)
	}); } catch { throw Error('stickersErrorNetwork'); }
	if ([401,403].includes(response.status)) throw Error('stickersErrorAuth');
	if (!response.ok) throw Error(response.status===400 ? 'stickersErrorNotFound' : 'stickersErrorNetwork');
	const body = JSON.parse(new TextDecoder().decode(await bounded(response, 512 * 1024)));
	if (!body.ok || !body.result) throw Error([401,403].includes(body.error_code) ? 'stickersErrorAuth' : body.error_code===400 ? 'stickersErrorNotFound' : 'stickersErrorNetwork');
	return body.result;
}
export async function fetchPack(token, value, request = fetch) {
	const name = packName(value),
		pack = await call(token, 'getStickerSet', { name }, request);
	if (!Array.isArray(pack.stickers) || !pack.stickers.length) throw Error('stickersErrorEmpty');
	return {
		name,
		source: 'telegram',
		title: String(pack.title || name).slice(0, 100),
		stickers: pack.stickers
			.slice(0, 200)
			.filter((s) => typeof s.file_id === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(s.file_id))
			.map((s) => ({
				id: s.file_id,
				emoji: String(s.emoji || '🙂').slice(0, 32),
				format: s.is_video ? 'webm' : s.is_animated ? 'tgs' : 'webp'
			}))
	};
}
export async function fetchSticker(token, id, request = fetch) {
	if (!/^[A-Za-z0-9_-]{1,512}$/.test(id || '')) throw Error('Invalid sticker');
	const file = await call(token, 'getFile', { file_id: id }, request);
	if (
		file.file_size > MAX ||
		typeof file.file_path !== 'string' ||
		!/^[A-Za-z0-9_/-]+\.(?:webp|webm|tgs)$/.test(file.file_path) ||
		file.file_path.includes('..')
	)
		throw Error('Invalid sticker file');
	const response = await request(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
		redirect: 'error',
		signal: AbortSignal.timeout(15000)
	});
	return bounded(response);
}

export function publicStickerUrl(value) {
  try {
    const url=new URL(value);
    if(url.protocol!=='https:' || !/^cdn[0-9]+\.cdn-telegram\.org$/.test(url.hostname) || url.username || url.password || url.port || !url.pathname.startsWith('/file/') || url.href.length>2048)return null;
    return url.href;
  }catch{return null;}
}
export async function fetchPublicPack(value,request=fetch) {
  const name=packName(value);
  let failure;
  for(const kind of ['addstickers','addemoji']){
  try{
  const response=await request(`https://t.me/${kind}/${encodeURIComponent(name)}`,{redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
  if(response.status===404)throw Error('stickersErrorNotFound');
  const html=new TextDecoder().decode(await bounded(response));
  const {document}=parseHTML(html);
  const roots=[...document.querySelectorAll('.tgme_page_stickers,.tgme_page_stickers_wrap')];
  const urls=new Set();
  for(const root of roots){
    for(const element of root.querySelectorAll('.tgme_widget_sticker,.js-sticker_image,img')){
      const values=[element.getAttribute('data-webp'),element.getAttribute('data-sticker-thumb'),element.getAttribute('data-thumb'),element.getAttribute('src'),element.getAttribute('data-src'),element.querySelector('img')?.getAttribute('src')];
      for(const value of values){const url=publicStickerUrl(value);if(url)urls.add(url);}
    }
  }
  if(!urls.size)throw Error('stickersErrorPublic');
  return {name,title:(document.querySelector('.tgme_page_title')?.textContent?.trim()||name).slice(0,100),source:'public',partial:true,
    stickers:await Promise.all([...urls].slice(0,120).map(async url=>{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url))),b=>b.toString(16).padStart(2,'0')).join('');return {id:`preview_${hash}`,emoji:'🙂',format:'webp',url};}))};
  }catch(error){failure=error;}
  }
  throw Error(failure?.message==='stickersErrorNotFound'?'stickersErrorNotFound':'stickersErrorPublic');
}
export async function fetchPublicSticker(value,request=fetch) {
  const url=publicStickerUrl(value);if(!url)throw Error('stickersErrorPublic');
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  const bytes=await bounded(response),head=String.fromCharCode(...bytes.slice(0,12));
  const mime=head.startsWith('RIFF')&&head.slice(8)==='WEBP'?'image/webp':bytes[0]===137&&head.slice(1,4)==='PNG'?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':'';
  if(!mime)throw Error('stickersErrorPublic');
  return {bytes,mime};
}
