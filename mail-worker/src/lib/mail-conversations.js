import { parseHTML } from 'linkedom';

export function addresses(value) {
	try {
		const list = typeof value === 'string' ? JSON.parse(value || '[]') : value;
		return [
			...new Set(
				(Array.isArray(list) ? list : [])
					.map((item) =>
						String(typeof item === 'string' ? item : item?.address || '')
							.trim()
							.toLowerCase()
					)
					.filter((value) => value && !/[\r\n]/.test(value))
			)
		].sort();
	} catch {
		return [];
	}
}

export async function digest(value) {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function conversation(row, mailbox) {
	const own = new Set(
		[mailbox.email, row.toEmail || row.to_email].filter(Boolean).map((s) => s.toLowerCase())
	);
	const sender = row.sendEmail || row.send_email;
	// Never add BCC to a reply-all or expose hidden recipients to other contacts.
	let peers = [
		...new Set([
			...addresses(row.recipient),
			...addresses(row.cc),
			...addresses(sender ? [sender] : [])
		])
	]
		.filter((address) => !own.has(address))
		.sort();
	if (!peers.length) peers = [mailbox.email.toLowerCase()];
	return { key: await digest(peers.join('\n')), peers };
}

export async function indexMail(c, row) {
	const accountId = row.accountId ?? row.account_id;
	if (!accountId) return;
	const mailbox = await c.env.db
		.prepare('SELECT email FROM account WHERE account_id = ?')
		.bind(accountId)
		.first();
	if (!mailbox) return;
	const data = await conversation(row, mailbox);
	await c.env.db
		.prepare('UPDATE email SET conversation_key = ?, conversation_peers = ? WHERE email_id = ?')
		.bind(data.key, JSON.stringify(data.peers), row.emailId ?? row.email_id)
		.run();
	return data;
}

export function threadReferences(parent) {
	const values =
		`${parent.relation || ''} ${parent.messageId || ''}`.match(/<[^<>\s\r\n]+>/g) || [];
	return [...new Set(values)].slice(-20).join(' ');
}

export function plainMail(html = '') {
	const { document } = parseHTML(`<html><body>${html}</body></html>`);
	document
		.querySelectorAll('script,style,head,iframe,object,embed,template')
		.forEach((node) => node.remove());
	document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
	document.querySelectorAll('a').forEach((node) => {
		const url = node.getAttribute('href') || '';
		if (/^https?:\/\/[^\s]+$/i.test(url) && node.textContent.trim() !== url)
			node.append(` (${url})`);
	});
	document.querySelectorAll('p,div,tr,blockquote').forEach((node) => node.append('\n'));
	return document.body.textContent || '';
}

export function safeMailHtml(html = '') {
	const { document } = parseHTML(`<html><body>${html}</body></html>`);
	const allowed = new Set(
		'P DIV SPAN BR HR B STRONG I EM U S DEL BLOCKQUOTE PRE CODE TABLE THEAD TBODY TFOOT TR TD TH UL OL LI H1 H2 H3 H4 H5 H6 IMG A'.split(
			' '
		)
	);
	const dangerous =
		'script,style,iframe,object,embed,form,input,button,textarea,select,meta,link,base,svg,math,video,audio,source,template';
	document.querySelectorAll(dangerous).forEach((node) => node.remove());
	for (const node of document.body.querySelectorAll('*')) {
		if (!allowed.has(node.tagName)) {
			node.replaceWith(...node.childNodes);
			continue;
		}
		for (const attr of [...node.attributes]) {
			if (['colspan', 'rowspan'].includes(attr.name) && /^\d{1,2}$/.test(attr.value)) continue;
			if (attr.name === 'alt' && node.tagName === 'IMG') continue;
			if (
				attr.name === 'href' &&
				node.tagName === 'A' &&
				/^(https?:\/\/|mailto:)[^\s]+$/i.test(attr.value)
			)
				continue;
			if (
				attr.name === 'src' &&
				node.tagName === 'IMG' &&
				/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value)
			)
				continue;
			node.removeAttribute(attr.name);
		}
		if (node.tagName === 'A' && node.hasAttribute('href')) {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer');
			node.setAttribute('referrerpolicy', 'no-referrer');
		}
	}
	return document.body.innerHTML;
}

// Presentation only: retain the complete original mail for the standard mailbox view.
export function replyText(text = '') {
	const value = String(text)
		.replace(/\r\n?/g, '\n')
		.replace(/\u200b|\ufeff/g, '');
	const boundaries = [
		/^\s*>/m,
		/\bOn\s+[\s\S]{0,300}?wrote\s*[:：]/im,
		/(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)[,]?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[^\n]{0,250}?wrote\s*[:：]/i,
		/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[^\n]{0,250}?wrote\s*[:：]/i,
		/\d{4}[-/]\d{1,2}[-/]\d{1,2}[^\n]{0,220}?(?:写道|wrote)\s*[:：]/i,
		/(?:在\s*)?\d{4}年\d{1,2}月\d{1,2}日[^\n]{0,220}写道\s*[:：]/m,
		/(?:在\s*)?\d{1,2}\s*月\s*\d{1,2}\s*日[^\n]{0,220}写道\s*[:：]/m,
		/(?:^|\n)\s*在[^\n]{0,250}写道\s*[:：]/m,
		/^\s*-{2,}\s*(?:Original Message|原始邮件|Forwarded message|转发邮件)/im,
		/^\s*(?:From|发件人)\s*[:：][^\n]*\n\s*(?:Sent|发送时间|Date|日期)\s*[:：]/im,
		/^--\s*$/m
	];
	const positions = boundaries.map((pattern) => value.search(pattern)).filter((at) => at >= 0);
	return value.slice(0, positions.length ? Math.min(...positions) : value.length).trim();
}

function decodeCid(value) {
	try {
		return decodeURIComponent(value).replace(/^<|>$/g, '');
	} catch {
		return value;
	}
}

export function chatBody(text = '', html = '', attachments = []) {
	const { document } = parseHTML(`<html><body>${html}</body></html>`);
	const reference = document.querySelector('blockquote.cloud-mail-reference');
	const quote = reference
		? {
				messageId: reference.getAttribute('data-message-id') || '',
				author: reference.getAttribute('data-author') || '',
				text: plainMail(reference.innerHTML).trim().slice(0, 300)
			}
		: null;
	document
		.querySelectorAll(
			'blockquote,.gmail_quote,.gmail_signature,.yahoo_quoted,.moz-signature,script,style,iframe,object,template'
		)
		.forEach((node) => node.remove());
	// Outlook's reply header is followed by the quoted history as sibling nodes.
	const header = document.querySelector('#divRplyFwdMsg');
	if (header) {
		while (header.nextSibling) header.nextSibling.remove();
		header.remove();
	}
	const images = [];
	const seen = new Set();
	for (const img of document.querySelectorAll('img')) {
		const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
		if (Number(img.getAttribute('width')) === 1 || Number(img.getAttribute('height')) === 1)
			continue;
		const att = attachments.find(
			(a) =>
				(src.startsWith('cid:') &&
					a.contentId?.replace(/^<|>$/g, '') === decodeCid(src.slice(4))) ||
				(a.key &&
					(src.replace(/^\{\{domain\}\}/, '').replace(/^\//, '') === a.key ||
						(() => {
							try {
								return new URL(src).pathname.replace(/^\//, '') === a.key;
							} catch {
								return false;
							}
						})()))
		);
		const image = att
			? { attId: att.attId }
			: /^(https?:\/\/[^\s]+|data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+)$/i.test(src)
				? { src }
				: null;
		if (image && !seen.has(image.attId || image.src)) {
			images.push({ ...image, alt: img.getAttribute('alt') || '' });
			seen.add(image.attId || image.src);
		}
	}
	for (const att of attachments) {
		if (
			!att.contentId &&
			att.type === 0 &&
			(/^image\/(png|jpe?g|pjpeg|gif|webp)(?:;|$)/i.test(att.mimeType || '') ||
				/\.(png|jpe?g|gif|webp)$/i.test(att.filename || '')) &&
			!seen.has(att.attId)
		) {
			images.push({ attId: att.attId, alt: att.filename || '' });
			seen.add(att.attId);
		}
	}
	return { replyText: replyText(html ? plainMail(document.body.innerHTML) : text), images, quote };
}
