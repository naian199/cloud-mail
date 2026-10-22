import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import emailService from './email-service';
import {
	addresses,
	conversation,
	digest,
	plainMail,
	safeMailHtml,
	chatBody
} from '../lib/mail-conversations';
import verify from '../utils/verify-utils';
import { notifyMail } from '../chat/mail-notify';

const fail = (message, code = 400) => {
	throw new BizError(message, code);
};
const id = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID / 无效编号');
	return n;
};
const key = (value) => {
	if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
		fail('Invalid conversation / 无效会话');
	return value;
};
const fields = `email_id AS emailId, send_email AS sendEmail, name, account_id AS accountId,
 subject, substr(text, 1, 10000) AS text, content AS htmlPreview,
 recipient, cc, reply_to AS replyTo, in_reply_to AS inReplyTo, message_id AS messageId,
 relation, type, status, message, unread, create_time AS createTime, conversation_key AS conversationKey,
 conversation_peers AS conversationPeers, length(coalesce(text, '')) > 10000 AS truncated`;

const mailChat = {
	async account(c, rawAccountId) {
		const accountId = id(rawAccountId),
			userId = userContext.getUserId(c);
		const account = await c.env.db
			.prepare(
				`SELECT a.* FROM account a JOIN user u ON u.user_id = a.user_id
      WHERE a.account_id = ? AND a.user_id = ? AND a.is_del = 0 AND a.status = 0 AND u.is_del = 0 AND u.status = 0`
			)
			.bind(accountId, userId)
			.first();
		if (!account) fail('Mailbox unavailable / 邮箱不可用', 403);
		return account;
	},

	async backfill(c, account) {
		const { results } = await c.env.db
			.prepare(
				`SELECT email_id, send_email, to_email, recipient, cc
      FROM email WHERE account_id = ? AND user_id = ? AND conversation_key = '' ORDER BY email_id DESC LIMIT 100`
			)
			.bind(account.account_id, account.user_id)
			.all();
		const updates = [];
		for (const row of results) {
			const data = await conversation(row, account);
			updates.push({ id: row.email_id, key: data.key, peers: JSON.stringify(data.peers) });
		}
		// One statement per batch avoids exhausting D1's per-invocation query limit
		// when a free-plan mailbox indexes its first hundred legacy messages.
		if (updates.length)
			await c.env.db
				.prepare(
					`WITH updates AS (
      SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.key') AS key,
      json_extract(value, '$.peers') AS peers FROM json_each(?)
    ) UPDATE email SET conversation_key = updates.key, conversation_peers = updates.peers
      FROM updates WHERE email.email_id = updates.id AND email.conversation_key = '' AND email.account_id = ? AND email.user_id = ?`
				)
				.bind(JSON.stringify(updates), account.account_id, account.user_id)
				.run();
		return !!(await c.env.db
			.prepare(
				"SELECT 1 FROM email WHERE account_id = ? AND user_id = ? AND conversation_key = '' LIMIT 1"
			)
			.bind(account.account_id, account.user_id)
			.first());
	},

	async list(c, query) {
		const account = await this.account(c, query.accountId);
		const indexing = await this.backfill(c, account);
		const before = query.before ? id(query.before) : Number.MAX_SAFE_INTEGER;
		const search =
			typeof query.search === 'string' ? query.search.trim().slice(0, 100).toLowerCase() : '';
		const { results } = await c.env.db
			.prepare(
				`WITH conversations AS (
      SELECT conversation_key, MAX(email_id) AS latestId,
      COUNT(DISTINCT CASE WHEN type = 0 AND unread = 0 THEN
        CASE WHEN coalesce(message_id, '') != '' THEN 'm:' || message_id ELSE 'i:' || email_id END END) AS unread
      FROM email WHERE user_id = ? AND account_id = ? AND is_del = 0 AND type IN (0,1) AND status != 6
      AND conversation_key != '' GROUP BY conversation_key
    ) SELECT e.conversation_key AS key, e.conversation_peers AS peers, e.email_id AS latestId,
      e.subject, substr(e.text, 1, 150) AS preview, e.create_time AS createTime, c.unread,
      p.conversation_key IS NOT NULL AS pinned
      FROM conversations c JOIN email e ON e.email_id = c.latestId
      LEFT JOIN mail_conversation_pin p ON p.user_id = e.user_id AND p.account_id = e.account_id AND p.conversation_key = c.conversation_key
      WHERE c.latestId < ? AND (? = '' OR instr(lower(e.conversation_peers), ?) > 0 OR instr(lower(coalesce(e.subject, '')), ?) > 0)
      ORDER BY c.latestId DESC LIMIT 31`
			)
			.bind(account.user_id, account.account_id, before, search, search, search)
			.all();
		return {
			conversations: results.slice(0, 30).map((row) => ({ ...row, peers: addresses(row.peers) })),
			hasMore: results.length > 30,
			indexing
		};
	},

	async messages(c, query) {
		const account = await this.account(c, query.accountId);
		const conversationKey = key(query.key);
		if (query.before && query.after) fail('Invalid pagination / 无效分页');
		const cursor = query.before ? id(query.before) : query.after ? id(query.after) : null;
		const cmp = query.after ? '>' : '<',
			order = query.after ? 'ASC' : 'DESC';
		const { results } = await c.env.db
			.prepare(
				`SELECT ${fields} FROM email e WHERE user_id = ? AND account_id = ?
      AND conversation_key = ? AND is_del = 0 AND type IN (0,1) AND status != 6
      AND (coalesce(e.message_id, '') = '' OR NOT EXISTS (
        SELECT 1 FROM email prior WHERE prior.user_id = e.user_id AND prior.account_id = e.account_id
        AND prior.type = e.type AND prior.message_id = e.message_id AND prior.is_del = 0 AND prior.status != 6
        AND prior.email_id < e.email_id
      ))
      ${cursor ? `AND email_id ${cmp} ?` : ''} ORDER BY email_id ${order} LIMIT 21`
			)
			.bind(...[account.user_id, account.account_id, conversationKey, ...(cursor ? [cursor] : [])])
			.all();
		const hasMore = results.length > 20;
		const messages = results.slice(0, 20);
		if (!query.after) messages.reverse();
		for (const row of messages) {
			row.text = row.text || plainMail(row.htmlPreview || '');
			row.hasHtml = !!row.htmlPreview;
			row.attachments = [];
		}
		if (messages.length) {
			const { results: atts } = await c.env.db
				.prepare(
					`SELECT att_id AS attId, email_id AS emailId, filename, size, mime_type AS mimeType, content_id AS contentId, type, key FROM attachments
        WHERE user_id = ? AND account_id = ? AND type IN (0,1)
        AND email_id IN (${messages.map(() => '?').join(',')})`
				)
				.bind(account.user_id, account.account_id, ...messages.map((m) => m.emailId))
				.all();
			for (const att of atts)
				messages.find((m) => m.emailId === att.emailId)?.attachments.push(att);
		}
		for (const row of messages) {
			Object.assign(row, chatBody(row.text, row.htmlPreview || '', row.attachments));
			delete row.htmlPreview;
			row.attachments = row.attachments
				.filter(
					(att) =>
						!att.contentId &&
						att.type === 0 &&
						!row.images.some((image) => image.attId === att.attId)
				)
				.map(({ key, ...att }) => att);
		}
		return { messages, hasMore };
	},

	async detail(c, rawId) {
		const userId = userContext.getUserId(c);
		const row = await c.env.db
			.prepare(
				`SELECT email_id AS emailId, account_id AS accountId, subject, text, content,
      send_email AS sendEmail, recipient, cc, reply_to AS replyTo, message_id AS messageId, in_reply_to AS inReplyTo, relation
      FROM email WHERE email_id = ? AND user_id = ? AND is_del = 0`
			)
			.bind(id(rawId), userId)
			.first();
		if (!row) fail('Email unavailable / 邮件不可用', 404);
		await this.account(c, row.accountId);
		return {
			...row,
			text: row.text || plainMail(row.content || ''),
			...chatBody(row.text, row.content || ''),
			content: safeMailHtml(row.content || '')
		};
	},

	async attachment(c, rawId) {
		const userId = userContext.getUserId(c);
		const row = await c.env.db
			.prepare(
				`SELECT a.key, a.account_id AS accountId FROM attachments a JOIN email e ON e.email_id = a.email_id
      WHERE a.att_id = ? AND a.user_id = ? AND e.user_id = ? AND a.account_id = e.account_id AND e.is_del = 0 AND a.type IN (0,1)`
			)
			.bind(id(rawId), userId, userId)
			.first();
		if (!row) fail('Attachment unavailable / 附件不可用', 404);
		await this.account(c, row.accountId);
		return row;
	},

	async read(c, params) {
		const account = await this.account(c, params?.accountId);
		const conversationKey = key(params.key),
			through = id(params.through);
		await c.env.db
			.prepare(
				`UPDATE email SET unread = 1 WHERE user_id = ? AND account_id = ? AND conversation_key = ?
      AND type = 0 AND is_del = 0 AND unread = 0 AND (email_id <= ? OR (coalesce(message_id, '') != '' AND message_id IN (
        SELECT message_id FROM email WHERE user_id = ? AND account_id = ? AND conversation_key = ? AND type = 0 AND email_id <= ?
      )))`
			)
			.bind(
				account.user_id,
				account.account_id,
				conversationKey,
				through,
				account.user_id,
				account.account_id,
				conversationKey,
				through
			)
			.run();
	},

	async pin(c, params) {
		const account = await this.account(c, params?.accountId),
			conversationKey = key(params.key);
		if (typeof params.pinned !== 'boolean') fail('Invalid action / 无效操作');
		const sql = params.pinned
			? 'INSERT OR IGNORE INTO mail_conversation_pin (user_id, account_id, conversation_key) VALUES (?, ?, ?)'
			: 'DELETE FROM mail_conversation_pin WHERE user_id = ? AND account_id = ? AND conversation_key = ?';
		await c.env.db.prepare(sql).bind(account.user_id, account.account_id, conversationKey).run();
	},

	async send(c, params) {
		const account = await this.account(c, params?.accountId);
		if (typeof params.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(params.clientId))
			fail('Invalid request ID / 无效请求标识');
		const body = typeof params.text === 'string' ? params.text.trim() : '';
		const subject = typeof params.subject === 'string' ? params.subject.trim() : '';
		if (!body || body.length > 20000 || !subject || subject.length > 300 || /[\r\n]/.test(subject))
			fail('Invalid text or subject / 请检查正文和标题');
		// Normalize domains for delivery, but keep case-sensitive local parts.
		// Conversation identity may be case-folded without rewriting SMTP targets.
		if (
			!Array.isArray(params.recipients) ||
			params.recipients.some((value) => typeof value !== 'string')
		)
			fail('Invalid recipients / 请检查收件人');
		const recipients = [
			...new Set(
				params.recipients.map((value) => {
					const address = value.trim(),
						split = address.lastIndexOf('@');
					return split < 0
						? address
						: address.slice(0, split) + '@' + address.slice(split + 1).toLowerCase();
				})
			)
		];
		if (
			!recipients.length ||
			recipients.length > 20 ||
			recipients.some((email) => !verify.isEmail(email))
		)
			fail('Invalid recipients / 请检查收件人');
		let parent;
		if (params.replyId) {
			parent = await c.env.db
				.prepare(
					`SELECT email_id, send_email, recipient, cc, reply_to, account_id FROM email
        WHERE email_id = ? AND user_id = ? AND account_id = ? AND is_del = 0 AND status != 6`
				)
				.bind(id(params.replyId), account.user_id, account.account_id)
				.first();
			if (!parent) fail('Reply unavailable / 无权回复此邮件', 403);
			const sender = addresses(parent.reply_to).length
				? addresses(parent.reply_to)
				: addresses([parent.send_email]);
			const allowed = new Set(
				[...sender, ...addresses(parent.recipient), ...addresses(parent.cc)].filter(
					(a) => a !== account.email.toLowerCase()
				)
			);
			if (recipients.some((a) => !allowed.has(a.toLowerCase())))
				fail('Reply recipients changed / 请使用新会话发送给其他收件人');
		}
		const attachments = params.attachments || [];
		if (!Array.isArray(attachments) || attachments.length > 10)
			fail('Too many attachments / 最多 10 个附件');
		let bytes = 0;
		for (const att of attachments) {
			if (
				typeof att.filename !== 'string' ||
				!att.filename ||
				att.filename.length > 200 ||
				/[\r\n]/.test(att.filename) ||
				typeof att.content !== 'string' ||
				!/^[A-Za-z0-9+/]*={0,2}$/.test(att.content)
			)
				fail('Invalid attachment / 附件无效');
			bytes += Math.ceil((att.content.length * 3) / 4);
		}
		if (bytes > 10 * 1024 * 1024) fail('Attachments exceed 10 MB / 附件总计不能超过 10 MB');
		const requestKey = await digest(`${account.user_id}:${params.clientId}`);
		const fingerprint = await digest(
			JSON.stringify({
				account: account.account_id,
				body,
				subject,
				recipients,
				replyId: params.replyId || null,
				attachments
			})
		);
		const attempt = await c.env.db
			.prepare(
				`INSERT INTO mail_send_attempt (request_key, user_id, account_id, fingerprint)
      VALUES (?, ?, ?, ?) ON CONFLICT(request_key) DO NOTHING`
			)
			.bind(requestKey, account.user_id, account.account_id, fingerprint)
			.run();
		if (!attempt.meta.changes) {
			const existing = await c.env.db
				.prepare('SELECT * FROM mail_send_attempt WHERE request_key = ?')
				.bind(requestKey)
				.first();
			if (existing.fingerprint !== fingerprint)
				fail('Request ID already used / 请求标识已使用', 409);
			// A committed outgoing record proves acceptance even if the HTTP response was lost.
			const saved = await c.env.db
				.prepare(
					'SELECT email_id AS emailId, conversation_key AS conversationKey FROM email WHERE send_key = ? AND user_id = ? AND is_del = 0'
				)
				.bind(requestKey, account.user_id)
				.first();
			if (existing.state === 'completed' && saved) return saved;
			fail(
				'Sending status uncertain; inspect Sent before retrying / 发送中或结果待确认，请先检查已发送邮件，系统不会重复投递',
				409
			);
		}
		let started = false;
		try {
			const escape = (value) =>
				value.replace(
					/[&<>"']/g,
					(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
				);
			const [sent] = await emailService.send(
				c,
				{
					accountId: account.account_id,
					receiveEmail: recipients,
					subject,
					text: body,
					content: `<div style="white-space:pre-wrap">${escape(body)}</div>`,
					sendType: parent ? 'reply' : 'send',
					emailId: parent?.email_id,
					attachments: attachments.map((att) => ({
						filename: att.filename,
						content: att.content,
						type: att.contentType || 'application/octet-stream'
					}))
				},
				account.user_id,
				{
					sendKey: requestKey,
					beforeDelivery: () => {
						started = true;
					}
				}
			);
			const indexed = await c.env.db
				.prepare('SELECT conversation_key AS conversationKey FROM email WHERE email_id = ?')
				.bind(sent.emailId)
				.first();
			await c.env.db
				.prepare(
					"UPDATE mail_send_attempt SET state = 'completed', email_id = ? WHERE request_key = ?"
				)
				.bind(sent.emailId, requestKey)
				.run();
			return { emailId: sent.emailId, conversationKey: indexed.conversationKey };
		} catch (error) {
			if (!started)
				await c.env.db
					.prepare('DELETE FROM mail_send_attempt WHERE request_key = ?')
					.bind(requestKey)
					.run();
			else
				await c.env.db
					.prepare("UPDATE mail_send_attempt SET state = 'uncertain' WHERE request_key = ?")
					.bind(requestKey)
					.run();
			throw error;
		}
	}
};
export default mailChat;
