import { parseHTML } from 'linkedom';

export function sharedLinks(text = '', html = '') {
	const candidates = (text.match(/https?:\/\/[^\s<>"']+/gi) || []).map((url) =>
		url.replace(/[),.;!?，。；！？]+$/u, '')
	);
	if (html) {
		const { document } = parseHTML(`<html><body>${html}</body></html>`);
		for (const anchor of document.querySelectorAll('a[href]'))
			candidates.push(anchor.getAttribute('href'));
	}
	const links = new Set();
	for (const candidate of candidates) {
		try {
			const url = new URL(candidate);
			if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
				links.add(url.href);
		} catch {
			/* Ignore malformed and relative links. */
		}
		if (links.size >= 100) break;
	}
	return [...links];
}

export function sharedImages(html = '') {
	if (!html) return [];
	const { document } = parseHTML(`<html><body>${html}</body></html>`);
	const images = new Map();
	for (const image of document.querySelectorAll('img[src]')) {
		try {
			const url = new URL(image.getAttribute('src'));
			if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
				images.set(url.href, { src: url.href, alt: image.getAttribute('alt') || '' });
		} catch {
			/* Private mail-image references are handled through authenticated attachment IDs. */
		}
		if (images.size >= 100) break;
	}
	return [...images.values()];
}
