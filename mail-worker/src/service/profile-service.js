import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import { notifyMail } from '../chat/mail-notify';

export async function profilesFor(c, emails) {
	const values = [...new Set(emails.filter(Boolean).map((email) => email.toLowerCase()))];
	if (!values.length) return new Map();
	const { results } = await c.env.db
		.prepare(
			`SELECT a.email, p.display_name AS displayName,
    p.bio, p.avatar FROM account a JOIN user u ON u.user_id=a.user_id
    JOIN mail_user_profile p ON p.user_id=a.user_id
    WHERE lower(a.email) IN (SELECT value FROM json_each(?))
    AND a.is_del=0 AND a.status=0 AND u.is_del=0 AND u.status=0`
		)
		.bind(JSON.stringify(values))
		.all();
	return new Map(results.map((row) => [row.email.toLowerCase(), row]));
}

export default {
	async get(c) {
		return (
			(await c.env.db
				.prepare(
					'SELECT display_name AS displayName, bio, avatar FROM mail_user_profile WHERE user_id=?'
				)
				.bind(userContext.getUserId(c))
				.first()) || { displayName: '', bio: '', avatar: '' }
		);
	},
	async save(c, params) {
		const { displayName, bio, avatar } = params;
		if (
			typeof displayName !== 'string' ||
			!displayName.trim() ||
			displayName.trim().length > 40 ||
			typeof bio !== 'string' ||
			bio.length > 200 ||
			typeof avatar !== 'string' ||
			avatar.length > 90000
		)
			throw new BizError('Invalid profile / 昵称限40字，简介限200字，头像需小于64KB', 400);
		if (avatar) {
			const match = avatar.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
			let bytes;
			try {
				bytes = match && Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));
			} catch {}
			const valid =
				bytes &&
				bytes.length <= 65536 &&
				((match[1] === 'png' &&
					bytes[0] === 137 &&
					bytes[1] === 80 &&
					bytes[2] === 78 &&
					bytes[3] === 71) ||
					(match[1] === 'jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
					(match[1] === 'webp' &&
						String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
						String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'));
			if (!valid) throw new BizError('Invalid avatar / 请上传 PNG、JPEG 或 WebP 图片', 400);
		}
		const userId = userContext.getUserId(c);
		await c.env.db
			.prepare(
				`INSERT INTO mail_user_profile(user_id,display_name,bio,avatar) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,bio=excluded.bio,avatar=excluded.avatar`
			)
			.bind(userId, displayName.trim(), bio.trim(), avatar)
			.run();
		// Invalidate connected correspondents so profile edits appear without reloading.
		const { results } = await c.env.db
			.prepare(
				`SELECT DISTINCT e.user_id FROM email e
      WHERE e.is_del=0 AND e.send_email IN (SELECT email FROM account WHERE user_id=?) LIMIT 100`
			)
			.bind(userId)
			.all();
		c.executionCtx.waitUntil(notifyMail(c.env, userId, ...results.map((row) => row.user_id)));
		return this.get(c);
	},
	async alerts(c, query) {
		const userId = userContext.getUserId(c);
		if (
			query.after !== undefined &&
			(!/^\d+$/.test(query.after) || !Number.isSafeInteger(Number(query.after)))
		)
			throw new BizError('Invalid cursor', 400);
		const max = await c.env.db
			.prepare('SELECT coalesce(max(email_id),0) AS cursor FROM email WHERE user_id=? AND type=0')
			.bind(userId)
			.first();
		if (query.after === undefined) return { cursor: max.cursor, messages: [], hasMore: false };
		const { results } = await c.env.db
			.prepare(
				`SELECT e.email_id AS emailId, e.account_id AS accountId,
      e.send_email AS email, e.subject, e.conversation_key AS conversationKey
      FROM email e JOIN account a ON a.account_id=e.account_id
      WHERE e.user_id=? AND e.type=0 AND e.is_del=0 AND e.unread=0 AND e.status!=6
      AND coalesce(e.ingest_key,'') NOT LIKE 'legacy-chat:%'
      AND a.is_del=0 AND a.status=0 AND e.email_id>? AND e.email_id<=? ORDER BY e.email_id LIMIT 51`
			)
			.bind(userId, Number(query.after), max.cursor)
			.all();
		const messages = results.slice(0, 50);
		const profiles = await profilesFor(
			c,
			messages.map((row) => row.email)
		);
		return {
			cursor:
				results.length > 50
					? messages[messages.length - 1].emailId
					: Math.max(Number(query.after), max.cursor),
			hasMore: results.length > 50,
			messages: messages.map((row) => ({
				...row,
				displayName: profiles.get(row.email.toLowerCase())?.displayName || row.email
			}))
		};
	}
};
