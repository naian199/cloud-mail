import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import verify from '../utils/verify-utils';
import { notifyMail } from '../chat/mail-notify';

export function normalizeUsername(value) {
  if (typeof value !== 'string') throw new BizError('invalidInput', 400);
  const name = value.trim().replace(/^@/, '').toLowerCase();
  if (!name && value.trim()) throw new BizError('invalidInput', 400);
  if (name && !/^[a-z][a-z0-9_]{2,23}$/.test(name)) throw new BizError('invalidInput', 400);
  return name;
}

export default {
  async username(c, params) {
    const username = normalizeUsername(params?.username);
    const userId = userContext.getUserId(c);
    try {
      if (username) {
        await c.env.db.prepare(`INSERT INTO mail_user_handle(user_id, username) VALUES(?, ?)
          ON CONFLICT(user_id) DO UPDATE SET username=excluded.username`).bind(userId, username).run();
      } else {
        await c.env.db.prepare('DELETE FROM mail_user_handle WHERE user_id=?').bind(userId).run();
      }
    } catch (error) {
      if (/UNIQUE constraint failed: mail_user_handle.username/i.test(error.message)) throw new BizError('contactUsernameTaken', 409);
      throw error;
    }
    return { username };
  },
  async search(c, query) {
    const username = normalizeUsername(query.username);
    if (!username) return [];
    const { results } = await c.env.db.prepare(`SELECT h.username, p.display_name AS displayName, p.avatar
      FROM mail_user_handle h JOIN user u ON u.user_id=h.user_id
      LEFT JOIN mail_user_profile p ON p.user_id=h.user_id
      WHERE u.is_del=0 AND u.status=0 AND u.user_id!=?
      AND substr(h.username,1,length(?))=?
      ORDER BY (h.username=?) DESC, h.username LIMIT 10`)
      .bind(userContext.getUserId(c), username, username, username).all();
    return results;
  },
  async note(c, params) {
    const email = typeof params?.email === 'string' ? params.email.trim().toLowerCase() : '';
    const remark = typeof params?.remark === 'string' ? params.remark.trim() : null;
    if (!verify.isEmail(email) || email.length > 254 || remark === null || Array.from(remark).length > 50) throw new BizError('invalidInput', 400);
    const userId = userContext.getUserId(c);
    if (remark) {
      await c.env.db.prepare(`INSERT INTO mail_contact_note(user_id,email,remark) VALUES(?,?,?)
        ON CONFLICT(user_id,email) DO UPDATE SET remark=excluded.remark`).bind(userId,email,remark).run();
    } else {
      await c.env.db.prepare('DELETE FROM mail_contact_note WHERE user_id=? AND email=?').bind(userId,email).run();
    }
    c.executionCtx.waitUntil(notifyMail(c.env,userId));
    return { email, remark };
  }
};
