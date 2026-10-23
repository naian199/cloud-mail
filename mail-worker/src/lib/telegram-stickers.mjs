const MAX = 1024 * 1024;
export function packName(value) {
	if (typeof value !== 'string' || value.length > 300) throw Error('Invalid sticker pack');
	let name = value.trim();
	if (/^https?:/i.test(name)) {
		const url = new URL(name);
		if (
			url.protocol !== 'https:' ||
			!['t.me', 'telegram.me'].includes(url.hostname) ||
			url.username ||
			url.password ||
			url.port ||
			url.search ||
			url.hash
		)
			throw Error('Invalid sticker pack');
		const match = url.pathname.match(/^\/(?:addstickers|addemoji)\/([A-Za-z0-9_]{1,64})\/?$/);
		if (!match) throw Error('Invalid sticker pack');
		name = match[1];
	}
	if (!/^[A-Za-z0-9_]{1,64}$/.test(name)) throw Error('Invalid sticker pack');
	return name;
}
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
		throw Error('Sticker platform not configured');
	const response = await request(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
		redirect: 'error',
		signal: AbortSignal.timeout(15000)
	});
	const body = JSON.parse(new TextDecoder().decode(await bounded(response, 512 * 1024)));
	if (!body.ok || !body.result) throw Error('Sticker provider unavailable');
	return body.result;
}
export async function fetchPack(token, value, request = fetch) {
	const name = packName(value),
		pack = await call(token, 'getStickerSet', { name }, request);
	if (!Array.isArray(pack.stickers)) throw Error('Invalid sticker pack');
	return {
		name,
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
