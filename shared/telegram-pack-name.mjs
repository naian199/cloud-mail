export function packName(value) {
	if (typeof value !== 'string' || value.length > 300) throw Error('Invalid sticker pack');
	let name = value.trim();
	if (/^(?:t\.me|telegram\.me)\//i.test(name)) name = 'https://' + name;
	if (/^tg:\/\//i.test(name)) {
		const url = new URL(name);
		if (!['addstickers','addemoji'].includes(url.hostname) || [...url.searchParams.keys()].some(key => key !== 'set') || url.username || url.password || url.port || !['','/'].includes(url.pathname) || url.hash) throw Error('Invalid sticker pack');
		name = url.searchParams.get('set') || '';
	}
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
