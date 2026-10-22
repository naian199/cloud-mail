import BizError from '../error/biz-error';
import userContext from '../security/user-context';

const fail = (message, code = 400) => { throw new BizError(message, code); };
const positiveId = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail('无效的编号 / Invalid ID');
  return id;
};

const chatService = {
  async user(c) {
    const id = userContext.getUserId(c);
    const user = await c.env.db.prepare('SELECT user_id, email FROM user WHERE user_id = ? AND status = 0 AND is_del = 0').bind(id).first();
    if (!user) fail('账号不可用 / Account unavailable', 403);
    return user;
  },

  notify(c, ...users) {
    if (!c.env.CHAT_NOTIFICATIONS) return;
    c.executionCtx.waitUntil(Promise.all([...new Set(users)].map(async id => {
      const stub = c.env.CHAT_NOTIFICATIONS.get(c.env.CHAT_NOTIFICATIONS.idFromName(String(id)));
      const response = await stub.fetch('https://chat.internal/notify', { method: 'POST' });
      if (!response.ok) throw new Error('Chat notification unavailable');
    })).catch(() => console.error('Chat notification delivery failed; reconnect to refresh')));
  },

  async friendship(c, rawId, userId, accepted = true) {
    const id = positiveId(rawId);
    const row = await c.env.db.prepare(`SELECT f.* FROM chat_friendship f
      JOIN user peer ON peer.user_id = CASE WHEN f.low_user_id = ? THEN f.high_user_id ELSE f.low_user_id END
      WHERE f.id = ? AND (f.low_user_id = ? OR f.high_user_id = ?)
      AND peer.status = 0 AND peer.is_del = 0`).bind(userId, id, userId, userId).first();
    if (!row || (accepted && row.status !== 'accepted')) fail('好友关系不存在 / Friendship unavailable', 403);
    return row;
  },

  async list(c) {
    const user = await this.user(c);
    const { results } = await c.env.db.prepare(`SELECT f.id, f.status, f.requester_id AS requesterId,
      peer.user_id AS userId, peer.email,
      (SELECT COUNT(*) FROM chat_message m WHERE m.friendship_id = f.id AND m.sender_id != ?
       AND m.id > CASE WHEN f.low_user_id = ? THEN f.low_read_id ELSE f.high_read_id END) AS unread,
      (SELECT body FROM chat_message m WHERE m.friendship_id = f.id ORDER BY m.id DESC LIMIT 1) AS lastMessage
      FROM chat_friendship f
      JOIN user peer ON peer.user_id = CASE WHEN f.low_user_id = ? THEN f.high_user_id ELSE f.low_user_id END
      WHERE (f.low_user_id = ? OR f.high_user_id = ?) AND peer.status = 0 AND peer.is_del = 0
      ORDER BY f.id DESC`).bind(user.user_id, user.user_id, user.user_id, user.user_id, user.user_id).all();
    return results;
  },

  async request(c, params) {
    const user = await this.user(c);
    const email = typeof params?.email === 'string' ? params.email.trim() : '';
    if (!email || email.length > 254) fail('请输入注册邮箱 / Enter a registered email');
    const peer = await c.env.db.prepare('SELECT user_id FROM user WHERE email = ? COLLATE NOCASE AND status = 0 AND is_del = 0').bind(email).first();
    if (!peer) fail('未找到该注册邮箱 / Registered email not found', 404);
    if (peer.user_id === user.user_id) fail('不能添加自己 / Cannot add yourself');
    const low = Math.min(user.user_id, peer.user_id), high = Math.max(user.user_id, peer.user_id);
    await c.env.db.prepare(`INSERT INTO chat_friendship (low_user_id, high_user_id, requester_id)
      VALUES (?, ?, ?) ON CONFLICT(low_user_id, high_user_id) DO NOTHING`).bind(low, high, user.user_id).run();
    this.notify(c, user.user_id, peer.user_id);
    return { id: (await c.env.db.prepare('SELECT id FROM chat_friendship WHERE low_user_id = ? AND high_user_id = ?').bind(low, high).first()).id };
  },

  async respond(c, rawId, params) {
    const user = await this.user(c);
    const f = await this.friendship(c, rawId, user.user_id, false);
    if (typeof params?.accept !== 'boolean') fail('无效的操作 / Invalid action');
    if (f.status !== 'pending' || f.requester_id === user.user_id) fail('只有接收方可处理申请 / Only the recipient can respond', 403);
    const sql = params.accept
      ? "UPDATE chat_friendship SET status = 'accepted' WHERE id = ? AND status = 'pending' AND requester_id != ?"
      : "DELETE FROM chat_friendship WHERE id = ? AND status = 'pending' AND requester_id != ?";
    await c.env.db.prepare(sql).bind(f.id, user.user_id).run();
    this.notify(c, f.low_user_id, f.high_user_id);
  },

  async remove(c, rawId) {
    const user = await this.user(c);
    const f = await this.friendship(c, rawId, user.user_id, false);
    await c.env.db.prepare('DELETE FROM chat_friendship WHERE id = ?').bind(f.id).run();
    this.notify(c, f.low_user_id, f.high_user_id);
  },

  async messages(c, rawId, query) {
    const user = await this.user(c);
    const f = await this.friendship(c, rawId, user.user_id);
    if (query.before && query.after) fail('无效的分页 / Invalid pagination');
    const after = query.after ? positiveId(query.after) : null;
    const before = query.before ? positiveId(query.before) : null;
    const comparison = after ? 'AND id > ?' : before ? 'AND id < ?' : '';
    let stmt = c.env.db.prepare(`SELECT id, sender_id AS senderId, client_id AS clientId, body, created_at AS createdAt
      FROM chat_message WHERE friendship_id = ? ${comparison} ORDER BY id ${after ? 'ASC' : 'DESC'} LIMIT 51`);
    stmt = after || before ? stmt.bind(f.id, after || before) : stmt.bind(f.id);
    const { results } = await stmt.all();
    const hasMore = results.length > 50;
    const messages = results.slice(0, 50);
    if (!after) messages.reverse();
    return { messages, hasMore };
  },

  async send(c, rawId, params) {
    const user = await this.user(c);
    const f = await this.friendship(c, rawId, user.user_id);
    const body = typeof params?.body === 'string' ? params.body.trim() : '';
    const clientId = params?.clientId;
    if (!body || body.length > 2000) fail('消息长度需为 1–2000 字符 / Message must be 1–2000 characters');
    if (typeof clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)) fail('无效的消息标识 / Invalid message ID');
    // Check membership and active accounts again inside the write to close remove/send races.
    await c.env.db.prepare(`INSERT INTO chat_message (friendship_id, sender_id, client_id, body)
      SELECT f.id, ?, ?, ? FROM chat_friendship f
      JOIN user a ON a.user_id = f.low_user_id JOIN user b ON b.user_id = f.high_user_id
      WHERE f.id = ? AND f.status = 'accepted' AND (f.low_user_id = ? OR f.high_user_id = ?)
      AND a.status = 0 AND a.is_del = 0 AND b.status = 0 AND b.is_del = 0
      ON CONFLICT(sender_id, client_id) DO NOTHING`).bind(user.user_id, clientId, body, f.id, user.user_id, user.user_id).run();
    const message = await c.env.db.prepare(`SELECT id, friendship_id AS friendshipId, sender_id AS senderId,
      client_id AS clientId, body, created_at AS createdAt FROM chat_message WHERE sender_id = ? AND client_id = ?`).bind(user.user_id, clientId).first();
    if (!message) fail('好友关系已变更 / Friendship changed', 403);
    if (message.friendshipId !== f.id || message.body !== body) fail('消息标识已使用 / Message ID already used', 409);
    this.notify(c, f.low_user_id, f.high_user_id);
    return message;
  },

  async read(c, rawId, params) {
    const user = await this.user(c);
    const f = await this.friendship(c, rawId, user.user_id);
    const messageId = positiveId(params?.messageId);
    const column = f.low_user_id === user.user_id ? 'low_read_id' : 'high_read_id';
    const update = await c.env.db.prepare(`UPDATE chat_friendship SET ${column} = ?
      WHERE id = ? AND ${column} < ? AND EXISTS (SELECT 1 FROM chat_message WHERE id = ? AND friendship_id = ?)`)
      .bind(messageId, f.id, messageId, messageId, f.id).run();
    if (update.meta.changes) this.notify(c, user.user_id);
  },

  async socket(c) {
    const user = await this.user(c);
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.text('WebSocket required', 426);
    if (!c.env.CHAT_NOTIFICATIONS) return c.text('Chat notifications binding is not configured', 503);
    const stub = c.env.CHAT_NOTIFICATIONS.get(c.env.CHAT_NOTIFICATIONS.idFromName(String(user.user_id)));
    return stub.fetch('https://chat.internal/socket', {
      headers: { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'cloud-mail-chat' }
    });
  }
};
export default chatService;
