import BizError from '../error/biz-error';
import { addresses, digest } from '../lib/mail-conversations';
import { notifyMail } from '../chat/mail-notify';
import r2 from './r2-service';
const fail = (message, code = 400) => {
	throw new BizError(message, code);
};
const positive = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID');
	return n;
};

export default {
	async resolve(c, account, key) {
		if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return null;
		const row = await c.env.db
			.prepare(
				`SELECT conversation_peers AS peers FROM email WHERE user_id=? AND account_id=? AND conversation_key=? ORDER BY email_id DESC LIMIT 1`
			)
			.bind(account.user_id, account.account_id, key)
			.first();
		const contact = row
			? null
			: await c.env.db
					.prepare(
						'SELECT peer_email FROM mail_conversation_contact WHERE user_id=? AND account_id=? AND conversation_key=?'
					)
					.bind(account.user_id, account.account_id, key)
					.first();
		const peers = row ? addresses(row.peers) : contact ? [contact.peer_email] : [];
		if (peers.length !== 1) return null;
    return this.lookupPeer(c, account, peers[0]);
  },
  async lookupPeer(c, account, email) {
		const peer = await c.env.db
			.prepare(
				`SELECT a.account_id, a.user_id, a.email, u.email AS primary_email, f.id AS friendship_id
      FROM account a JOIN user u ON u.user_id=a.user_id
      LEFT JOIN chat_friendship f ON f.low_user_id=min(?,a.user_id) AND f.high_user_id=max(?,a.user_id) AND f.status='accepted'
      WHERE a.email=? COLLATE NOCASE AND a.is_del=0 AND a.status=0 AND u.is_del=0 AND u.status=0 AND a.user_id!=? LIMIT 1`
			)
			.bind(account.user_id, account.user_id, email.trim(), account.user_id)
			.first();
		return peer;
	},
	async status(c, account, key) {
		const peer = await this.resolve(c, account, key);
		if (!peer) return { internal: false };
		const now = Date.now();
		const state = await c.env.db
			.prepare(
				`SELECT count(*)>0 AS online, coalesce(max(CASE WHEN account_id=? AND peer_account_id=? THEN typing_until ELSE 0 END),0)>? AS typing FROM mail_live_session WHERE user_id=? AND expires_at>?`
			)
			.bind(peer.account_id, account.account_id, now, peer.user_id, now)
			.first();
		return {
			internal: true,
			friend: !!peer.friendship_id,
			online: !!state.online,
			typing: !!state.typing
		};
	},
	async pulse(c, account, params) {
		if (
			typeof params.sessionId !== 'string' ||
			!/^[a-zA-Z0-9_-]{16,80}$/.test(params.sessionId) ||
			typeof params.active !== 'boolean' ||
			typeof params.typing !== 'boolean'
		)
			fail('Invalid presence');
		const previous = await c.env.db
			.prepare('SELECT peer_account_id FROM mail_live_session WHERE user_id=? AND session_id=?')
			.bind(account.user_id, params.sessionId)
			.first();
		const peer = params.key ? await this.resolve(c, account, params.key) : null;
		if (params.key && (typeof params.key !== 'string' || !/^[a-f0-9]{64}$/.test(params.key)))
			fail('Invalid conversation');
		const now = Date.now();
		if (!params.active)
			await c.env.db
				.prepare('DELETE FROM mail_live_session WHERE user_id=? AND session_id=?')
				.bind(account.user_id, params.sessionId)
				.run();
		else
			await c.env.db
				.prepare(
					`INSERT INTO mail_live_session(user_id,session_id,account_id,peer_account_id,expires_at,typing_until) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,session_id) DO UPDATE SET account_id=excluded.account_id,peer_account_id=excluded.peer_account_id,expires_at=excluded.expires_at,typing_until=excluded.typing_until`
				)
				.bind(
					account.user_id,
					params.sessionId,
					account.account_id,
					peer?.account_id || null,
					now + 45000,
					params.typing && peer ? now + 6000 : 0
				)
				.run();
		// Notify active conversations involving this user; payloads contain no presence or mail data.
		const { results: watchers } = await c.env.db
			.prepare(
				`SELECT DISTINCT user_id FROM mail_live_session WHERE expires_at>? AND (peer_account_id IN (SELECT account_id FROM account WHERE user_id=?) OR account_id=?)`
			)
			.bind(now, account.user_id, previous?.peer_account_id || 0)
			.all();
		c.executionCtx.waitUntil(notifyMail(c.env, peer?.user_id, ...watchers.map((r) => r.user_id)));
		c.executionCtx.waitUntil(
			c.env.db
				.prepare('DELETE FROM mail_live_session WHERE expires_at<?')
				.bind(now - 60000)
				.run()
		);
	},
	async revision(c, account, key) {
		const r = await c.env.db
			.prepare(
				'SELECT revision FROM mail_conversation_revision WHERE user_id=? AND account_id=? AND conversation_key=?'
			)
			.bind(account.user_id, account.account_id, key)
			.first();
		return r?.revision || 0;
	},
	async remove(c, account, params) {
		const peer = await this.resolve(c, account, params.key);
		if (!peer)
			fail(
				'Only internal one-to-one conversations support deleting for both / 仅支持站内一对一会话',
				403
			);
		const through = positive(params.through);
		const snapshot = await c.env.db
			.prepare(
				'SELECT create_time FROM email WHERE email_id=? AND user_id=? AND account_id=? AND conversation_key=?'
			)
			.bind(through, account.user_id, account.account_id, params.key)
			.first();
		if (!snapshot) fail('Invalid deletion cursor');
		const range = '(create_time<? OR (create_time=? AND email_id<=?))';
		const rangeArgs = [snapshot.create_time, snapshot.create_time, through];
		const pending = await c.env.db
			.prepare(
				`SELECT 1 FROM email WHERE user_id=? AND account_id=? AND conversation_key=? AND ${range} AND type=1 AND status IN (1,6) AND is_del=0 LIMIT 1`
			)
			.bind(account.user_id, account.account_id, params.key, ...rangeArgs)
			.first();
		if (pending) fail('Message delivery pending / 邮件仍在投递，请稍后再删除', 409);
		const messageId = params.emailId ? positive(params.emailId) : null;
		if (messageId) {
			const own = await c.env.db
				.prepare(
					'SELECT email_id,create_time FROM email WHERE email_id=? AND user_id=? AND account_id=? AND conversation_key=? AND is_del=0'
				)
				.bind(messageId, account.user_id, account.account_id, params.key)
				.first();
			if (!own) fail('Message unavailable', 404);
			if (
				own.create_time > snapshot.create_time ||
				(own.create_time === snapshot.create_time && messageId > through)
			)
				fail('Invalid deletion cursor');
		}
		const peerKey = await digest(account.email.toLowerCase());
		let source = `SELECT message_id FROM email WHERE user_id=? AND account_id=? AND conversation_key=? AND ${range} ${messageId ? 'AND email_id=?' : ''} AND coalesce(message_id,'')!=''`;
		const args = [
			account.user_id,
			account.account_id,
			params.key,
			...rangeArgs,
			...(messageId ? [messageId] : [])
		];
		const ownClause = `user_id=? AND account_id=? AND conversation_key=? AND ${messageId ? `(email_id=? OR (message_id!='' AND message_id IN (SELECT message_id FROM email WHERE email_id=? AND user_id=? AND account_id=? AND conversation_key=?)))` : range}`;
		const ownArgs = [
			account.user_id,
			account.account_id,
			params.key,
			...(messageId
				? [messageId, messageId, account.user_id, account.account_id, params.key]
				: rangeArgs)
		];
		const sourceArgs = [...args];
		let legacyCutoff = 0;
		if (
			!messageId &&
			peer.friendship_id &&
			peer.email.toLowerCase() === peer.primary_email.toLowerCase()
		) {
			const owner = await c.env.db
				.prepare('SELECT email FROM user WHERE user_id=?')
				.bind(account.user_id)
				.first();
			if (owner?.email.toLowerCase() === account.email.toLowerCase()) {
				legacyCutoff =
					(
						await c.env.db
							.prepare('SELECT max(id) AS cursor FROM chat_message WHERE friendship_id=?')
							.bind(peer.friendship_id)
							.first()
					)?.cursor || 0;
				if (legacyCutoff) {
					source += ` UNION SELECT '<legacy-chat-'||id||'@cloud-mail.internal>' FROM chat_message WHERE friendship_id=? AND id<=?`;
					sourceArgs.push(peer.friendship_id, legacyCutoff);
				}
			}
		}
		const statements = [
			c.env.db
				.prepare(
					`INSERT OR IGNORE INTO mail_removed_message(email_id) SELECT email_id FROM email WHERE (${ownClause}) OR (user_id=? AND account_id=? AND conversation_key=? AND message_id IN (${source}))`
				)
				.bind(...ownArgs, peer.user_id, peer.account_id, peerKey, ...sourceArgs),
			c.env.db
				.prepare(
					`UPDATE email SET is_del=1 WHERE user_id=? AND account_id=? AND conversation_key=? AND message_id IN (${source})`
				)
				.bind(peer.user_id, peer.account_id, peerKey, ...sourceArgs),
			c.env.db.prepare(`UPDATE email SET is_del=1 WHERE ${ownClause}`).bind(...ownArgs)
		];
		if (legacyCutoff)
			statements.unshift(
				c.env.db
					.prepare(
						`INSERT OR IGNORE INTO mail_removed_message(email_id) SELECT email_id FROM email WHERE user_id=? AND account_id=? AND conversation_key=? AND message_id IN (SELECT '<legacy-chat-'||id||'@cloud-mail.internal>' FROM chat_message WHERE friendship_id=? AND id<=?)`
					)
					.bind(account.user_id, account.account_id, params.key, peer.friendship_id, legacyCutoff)
			);
		if (legacyCutoff)
			statements.splice(
				3,
				0,
				c.env.db
					.prepare(
						`UPDATE email SET is_del=1 WHERE user_id=? AND account_id=? AND conversation_key=? AND message_id IN (SELECT '<legacy-chat-'||id||'@cloud-mail.internal>' FROM chat_message WHERE friendship_id=? AND id<=?)`
					)
					.bind(account.user_id, account.account_id, params.key, peer.friendship_id, legacyCutoff)
			);
		statements.splice(
			legacyCutoff ? 4 : 2,
			0,
			c.env.db
				.prepare(
					`DELETE FROM chat_message WHERE friendship_id=? AND '<legacy-chat-'||id||'@cloud-mail.internal>' IN (${source})`
				)
				.bind(peer.friendship_id || 0, ...sourceArgs)
		);
        // Deleting history never deletes the peer. Keep both entry points even after the last message.
        for (const [uid, aid, k, email] of [
            [account.user_id, account.account_id, params.key, peer.email],
            [peer.user_id, peer.account_id, peerKey, account.email]
        ]) statements.push(c.env.db.prepare(
            'INSERT OR IGNORE INTO mail_conversation_contact(user_id,account_id,conversation_key,peer_email) VALUES(?,?,?,?)'
        ).bind(uid,aid,k,email.toLowerCase()));
		// Record both revisions in the same transaction so reconnects discard cached deleted messages.
		for (const [uid, aid, k] of [
			[account.user_id, account.account_id, params.key],
			[peer.user_id, peer.account_id, peerKey]
		])
			statements.push(
				c.env.db
					.prepare(
						`INSERT INTO mail_conversation_revision(user_id,account_id,conversation_key,revision) VALUES(?,?,?,1) ON CONFLICT(user_id,account_id,conversation_key) DO UPDATE SET revision=revision+1`
					)
					.bind(uid, aid, k)
			);
		await c.env.db.batch(statements);
		await notifyMail(c.env, account.user_id, peer.user_id);
	},
	async importLegacy(c, account) {
		const { results } = await c.env.db
			.prepare(
				`SELECT m.*,s.email AS sender_email,r.email AS recipient_email,
      CASE WHEN m.sender_id=? THEN 1 ELSE 0 END AS mine,
      CASE WHEN f.low_user_id=? THEN f.low_read_id ELSE f.high_read_id END AS read_id
      FROM chat_message m JOIN chat_friendship f ON f.id=m.friendship_id
      JOIN user s ON s.user_id=m.sender_id JOIN user r ON r.user_id=CASE WHEN m.sender_id=f.low_user_id THEN f.high_user_id ELSE f.low_user_id END
      JOIN user owner ON owner.user_id=? AND lower(owner.email)=lower(?)
      WHERE (f.low_user_id=? OR f.high_user_id=?) AND NOT EXISTS(SELECT 1 FROM email e WHERE e.ingest_key='legacy-chat:'||m.id||':'||?) ORDER BY m.id LIMIT 100`
			)
			.bind(
				account.user_id,
				account.user_id,
				account.user_id,
				account.email,
				account.user_id,
				account.user_id,
				account.user_id
			)
			.all();
		if (!results.length) return false;
		const rows = [];
		for (const m of results) {
			const peer = m.mine ? m.recipient_email : m.sender_email;
			rows.push({
				legacyId: m.id,
				sender: m.sender_email,
				recipient: m.recipient_email,
				body: m.body,
				created: m.created_at,
				type: m.mine,
				status: m.mine ? 2 : 0,
				unread: m.mine || m.id <= m.read_id ? 1 : 0,
				key: await digest(peer.toLowerCase()),
				peers: JSON.stringify([peer.toLowerCase()]),
				identity: `legacy-chat:${m.id}:${account.user_id}`,
				messageId: `<legacy-chat-${m.id}@cloud-mail.internal>`
			});
		}
		await c.env.db
			.prepare(
				`INSERT OR IGNORE INTO email(user_id,account_id,send_email,to_email,recipient,text,subject,create_time,type,status,unread,conversation_key,conversation_peers,ingest_key,message_id)
      SELECT ?,?,json_extract(value,'$.sender'),json_extract(value,'$.recipient'),json_array(json_object('address',json_extract(value,'$.recipient'))),json_extract(value,'$.body'),'站内聊天',json_extract(value,'$.created'),json_extract(value,'$.type'),json_extract(value,'$.status'),json_extract(value,'$.unread'),json_extract(value,'$.key'),json_extract(value,'$.peers'),json_extract(value,'$.identity'),json_extract(value,'$.messageId') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM chat_message WHERE id=json_extract(value,'$.legacyId'))`
			)
			.bind(account.user_id, account.account_id, JSON.stringify(rows))
			.run();
		return results.length === 100;
	},
    async restoreContacts(c,account) {
        // Repair entry points lost by older releases, using only this mailbox's existing history.
        // Tombstoned messages stay deleted; inactive peers and multi-recipient mail are excluded.
        await c.env.db.prepare(`INSERT OR IGNORE INTO mail_conversation_contact(user_id,account_id,conversation_key,peer_email)
          SELECT r.user_id,r.account_id,r.conversation_key,lower(peer.email)
          FROM mail_conversation_revision r JOIN email e ON e.user_id=r.user_id AND e.account_id=r.account_id AND e.conversation_key=r.conversation_key
          JOIN account peer ON peer.email=json_extract(e.conversation_peers,'$[0]') COLLATE NOCASE
          JOIN user u ON u.user_id=peer.user_id
          WHERE r.user_id=? AND r.account_id=? AND json_array_length(e.conversation_peers)=1
          AND peer.user_id!=r.user_id AND peer.is_del=0 AND peer.status=0 AND u.is_del=0 AND u.status=0
          AND NOT EXISTS(SELECT 1 FROM mail_conversation_contact c WHERE c.user_id=r.user_id AND c.account_id=r.account_id AND c.conversation_key=r.conversation_key)
          AND e.email_id=(SELECT max(latest.email_id) FROM email latest WHERE latest.user_id=r.user_id AND latest.account_id=r.account_id AND latest.conversation_key=r.conversation_key)`)
          .bind(account.user_id,account.account_id).run();
    },
	async open(c, account, email) {
		if (typeof email !== 'string' || email.length > 254) fail('Invalid email');
		const peer = await c.env.db
			.prepare(
				`SELECT a.email FROM account a JOIN user u ON u.user_id=a.user_id WHERE a.email=? COLLATE NOCASE AND a.user_id!=? AND a.status=0 AND a.is_del=0 AND u.status=0 AND u.is_del=0`
			)
			.bind(email.trim(), account.user_id)
			.first();
		if (!peer) fail('Registered mailbox unavailable', 404);
		const key = await digest(peer.email.toLowerCase());
		await c.env.db
			.prepare(
				'INSERT OR IGNORE INTO mail_conversation_contact(user_id,account_id,conversation_key,peer_email) VALUES(?,?,?,?)'
			)
			.bind(account.user_id, account.account_id, key, peer.email.toLowerCase())
			.run();
		return {
			key,
      internal: true,
			peers: [peer.email.toLowerCase()],
			latestId: 0,
			unread: 0,
			subject: '站内聊天',
			preview: '',
			createTime: null,
			pinned: 0
		};
	},
	async deliver(c, account, peer, requestKey, body, html, parent, attachments, onCommit) {
		const mid = `<${crypto.randomUUID()}@cloud-mail.internal>`;
		const ownKey = await digest(peer.email.toLowerCase()),
			peerKey = await digest(account.email.toLowerCase());
		const atts = [];
		for (const att of attachments) {
			const bytes = Uint8Array.from(atob(att.content), (char) => char.charCodeAt(0));
			const key = `attachments/instant-${crypto.randomUUID()}`;
			await r2.putObj(c, key, bytes, {
				contentType: att.contentType || 'application/octet-stream'
			});
			atts.push({ ...att, key, size: bytes.length });
		}
		const statements = [
			c.env.db
				.prepare(
					`INSERT INTO email(user_id,account_id,send_email,recipient,text,content,subject,type,status,unread,message_id,in_reply_to,relation,conversation_key,conversation_peers,send_key)
      SELECT ?,?,?,?,?,?,'站内聊天',1,2,1,?,?,?,?,?,? FROM account sender JOIN account receiver ON receiver.account_id=? JOIN user a ON a.user_id=sender.user_id JOIN user b ON b.user_id=receiver.user_id
      WHERE sender.account_id=? AND a.status=0 AND a.is_del=0 AND b.status=0 AND b.is_del=0
      AND sender.user_id=? AND sender.status=0 AND sender.is_del=0 AND receiver.user_id=? AND receiver.status=0 AND receiver.is_del=0`
				)
				.bind(
					account.user_id,
					account.account_id,
					account.email,
					JSON.stringify([{ address: peer.email }]),
					body,
					html,
					mid,
					parent?.message_id || '',
                    [...new Set(`${parent?.relation || ''} ${parent?.message_id || ''}`.match(/<[^<>\s]+>/g) || [])].slice(-50).join(' '),
					ownKey,
					JSON.stringify([peer.email.toLowerCase()]),
					requestKey,
					peer.account_id,
					account.account_id,
					account.user_id,
					peer.user_id
				),
			c.env.db
				.prepare(
					`INSERT INTO email(user_id,account_id,send_email,to_email,recipient,text,content,subject,type,status,unread,message_id,in_reply_to,relation,conversation_key,conversation_peers,ingest_key)
      SELECT ?,?,send_email,?,recipient,text,content,subject,0,0,0,message_id,in_reply_to,relation,?,?,? FROM email WHERE send_key=? AND user_id=?`
				)
				.bind(
					peer.user_id,
					peer.account_id,
					peer.email,
					peerKey,
					JSON.stringify([account.email.toLowerCase()]),
					`instant:${requestKey}`,
					requestKey,
					account.user_id
				)
		];
		for (const att of atts)
			for (const [uid, aid, field, val] of [
				[account.user_id, account.account_id, 'send_key', requestKey],
				[peer.user_id, peer.account_id, 'ingest_key', `instant:${requestKey}`]
			])
				statements.push(
					c.env.db
						.prepare(
							`INSERT INTO attachments(user_id,account_id,email_id,key,filename,size,mime_type,type) SELECT ?,?,email_id,?,?,?,?,0 FROM email WHERE ${field}=? AND user_id=?`
						)
						.bind(
							uid,
							aid,
							att.key,
							att.filename,
							att.size,
							att.contentType || 'application/octet-stream',
							val,
							uid
						)
				);
		statements.push(
			c.env.db
				.prepare(
					`UPDATE mail_send_attempt SET state='completed',email_id=(SELECT email_id FROM email WHERE send_key=?) WHERE request_key=? AND EXISTS(SELECT 1 FROM email WHERE send_key=?)`
				)
				.bind(requestKey, requestKey, requestKey)
		);
		await c.env.db.batch(statements);
		onCommit();
		const saved = await c.env.db
			.prepare('SELECT email_id AS emailId FROM email WHERE send_key=?')
			.bind(requestKey)
			.first();
		if (!saved) fail('Account unavailable', 403);
		await notifyMail(c.env, account.user_id, peer.user_id);
		return [saved];
	}
};
