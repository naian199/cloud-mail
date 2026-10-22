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
