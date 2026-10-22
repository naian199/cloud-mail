import BizError from '../error/biz-error';
import { displayMail, plainMail } from '../lib/mail-conversations';
import userContext from '../security/user-context';
import permService from './perm-service';

export async function requireMailAdmin(c) {
	const user = userContext.getUser(c);
	const active = await c.env.db
		.prepare('SELECT email FROM user WHERE user_id=? AND status=0 AND is_del=0')
		.bind(user.userId)
		.first();
	if (
		!active ||
		(active.email !== c.env.admin &&
			!(await permService.userPermKeys(c, user.userId)).includes('all-email:query'))
	)
		throw new BizError('Administrator access required / 仅管理员可查看删除记录', 403);
}
export async function revokedAttachment(env, key) {
	return !!(await env.db
		.prepare(
			'SELECT 1 FROM attachments a JOIN mail_removed_message m ON m.email_id=a.email_id WHERE a.key=? LIMIT 1'
		)
		.bind(key)
		.first());
}
export async function removedMail(c, id) {
	await requireMailAdmin(c);
	if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new BizError('Invalid ID', 400);
	const row = await c.env.db
		.prepare(
			`SELECT e.email_id AS emailId,e.subject,e.send_email AS sendEmail,e.text,e.content,e.create_time AS createTime,u.email AS owner FROM email e JOIN mail_removed_message m ON m.email_id=e.email_id LEFT JOIN user u ON u.user_id=e.user_id WHERE e.email_id=?`
		)
		.bind(Number(id))
		.first();
	if (!row) throw new BizError('Record unavailable', 404);
	const { results: atts } = await c.env.db
		.prepare(
			'SELECT att_id AS attId,key,filename,size,mime_type AS mimeType,content_id AS contentId,type FROM attachments WHERE email_id=?'
		)
		.bind(row.emailId)
		.all();
	return {
		...row,
		...displayMail(
			row.content ||
				`<pre>${String(row.text || '')
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')}</pre>`,
			atts
		),
		content: undefined,
		text: row.text || plainMail(row.content),
		attachments: atts.filter((a) => !a.contentId).map(({ key, ...att }) => att)
	};
}
export async function removedAttachment(c, id, attId) {
	await requireMailAdmin(c);
	const row = await c.env.db
		.prepare(
			'SELECT a.key FROM attachments a JOIN mail_removed_message m ON m.email_id=a.email_id WHERE a.email_id=? AND a.att_id=?'
		)
		.bind(Number(id), Number(attId))
		.first();
	if (!row) throw new BizError('Attachment unavailable', 404);
	return row;
}

// Remove archived excerpts from ordinary views while keeping the original record for administrators.
export async function redactRemovedQuotes(c, rows, field = 'content') {
	const { parseHTML } = await import('linkedom');
	const documents = [];
	const ids = new Set();
	for (const row of rows) {
		if (!row[field]?.includes('cloud-mail-reference')) continue;
		const { document } = parseHTML(`<html><body>${row[field]}</body></html>`);
		documents.push([row, document]);
		for (const node of document.querySelectorAll('blockquote.cloud-mail-reference')) {
			const id = node.getAttribute('data-message-id');
			if (id) ids.add(id);
		}
	}
	if (!ids.size) return;
	const { results } = await c.env.db
		.prepare(
			`SELECT DISTINCT e.message_id FROM email e JOIN mail_removed_message m ON m.email_id=e.email_id WHERE e.user_id=? AND e.message_id IN (${[...ids].map(() => '?').join(',')})`
		)
		.bind(c.get?.('user')?.userId || rows[0]?.userId, ...ids)
		.all();
	const removed = new Set(results.map((row) => row.message_id));
	for (const [row, document] of documents) {
		for (const node of document.querySelectorAll('blockquote.cloud-mail-reference'))
			if (removed.has(node.getAttribute('data-message-id'))) {
				node.textContent = '消息已删除 / Message deleted';
				node.setAttribute('data-author', '');
				node.setAttribute('data-deleted', 'true');
			}
		row[field] = document.body.innerHTML;
	}
}
