import BizError from '../error/biz-error';
import { adminConversationList, adminConversationMessages } from '../lib/admin-mail-conversations.mjs';
import { addresses, plainMail, replyText } from '../lib/mail-conversations';
import { requireMailAdmin } from './removed-mail-service';

const pageSize = 25;

function mailId(value) {
	const id = Number(value);
	if (!Number.isSafeInteger(id) || id < 1) throw new BizError('invalidInput', 400);
	return id;
}

async function cursor(db, value) {
	if (!value) return ['', 0];
	const id = mailId(value);
	const row = await db.prepare('SELECT create_time FROM email WHERE email_id = ?').bind(id).first();
	if (!row) throw new BizError('invalidInput', 400);
	return [row.create_time, id];
}

async function page(c, query, statement, first, format) {
	// Use the existing administrative permission and check that the account is
	// still active, including when a user opens a saved conversation URL.
	await requireMailAdmin(c);
	const db = c.env.db;
	const { results } = await db.prepare(statement)
		.bind(first, ...await cursor(db, query.before), pageSize + 1)
		.all();
	const rows = results.slice(0, pageSize);
	return {
		items: rows.map(({ peers, ...row }) => ({ ...format(row), peers: addresses(peers) })),
		before: results.length > pageSize ? rows.at(-1).emailId : null
	};
}

export function listAdminConversations(c, query) {
	const search = String(query.q || '').trim().toLowerCase().slice(0, 160);
	return page(c, query, adminConversationList, search, (row) => row);
}

export function listAdminConversationMessages(c, id, query) {
	return page(c, query, adminConversationMessages, mailId(id), ({ text, html, ...row }) => {
		const body = text?.trim() || (html ? plainMail(html).trim() : '');
		return { ...row, text: (replyText(body) || body).slice(0, 8000) };
	});
}
