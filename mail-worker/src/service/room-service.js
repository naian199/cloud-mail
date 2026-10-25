import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import { normalizeUsername } from './contact-service';
import { notifyRoomUsers } from '../chat/mail-notify';
import { v4 as uuid } from 'uuid';
import translation from './translation-service';

const fail = (key='invalidInput', code=400) => { throw new BizError(key,code); };
const positive = value => {
  const n=Number(value);
  if (!Number.isSafeInteger(n) || n<1) fail();
  return n;
};
const forbidden = () => fail('unauthorized',403);
const privileged = room => ['owner','admin'].includes(room.role);
const personFields = `u.user_id AS userId, h.username,
  coalesce(nullif(n.remark,''),nullif(p.display_name,''),h.username,'') AS displayName, p.avatar`;
const personJoins = `LEFT JOIN mail_user_profile p ON p.user_id=u.user_id
  LEFT JOIN mail_user_handle h ON h.user_id=u.user_id
  LEFT JOIN mail_contact_note n ON n.user_id=? AND n.email=u.email COLLATE NOCASE`;

export default {
  async access(c,id,invited=false) {
    if (typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id)) fail();
    const row=await c.env.db.prepare(`SELECT r.id,r.kind,r.name,r.owner_id AS ownerId,m.role,m.status,m.read_id AS readId
      FROM mail_room r JOIN mail_room_member m ON m.room_id=r.id
      JOIN user u ON u.user_id=m.user_id JOIN user owner ON owner.user_id=r.owner_id
      WHERE r.id=? AND m.user_id=? AND u.status=0 AND u.is_del=0 AND owner.status=0 AND owner.is_del=0`)
      .bind(id,userContext.getUserId(c)).first();
    if (!row || (!invited && row.status!=='joined')) forbidden();
    return row;
  },
  async notify(c,id,extra=[]) {
    const {results}=await c.env.db.prepare('SELECT user_id FROM mail_room_member WHERE room_id=?').bind(id).all();
    c.executionCtx.waitUntil(notifyRoomUsers(c.env,id,[...extra,...results.map(r=>r.user_id)]));
  },
  async list(c) {
    const {results}=await c.env.db.prepare(`SELECT r.id,r.kind,r.name,r.owner_id AS ownerId,m.role,m.status,
      coalesce(nullif(op.display_name,''),oh.username,'') AS ownerName,oh.username AS ownerUsername,
      CASE WHEN m.status='joined' THEN (SELECT substr(body,1,150) FROM mail_room_message WHERE room_id=r.id ORDER BY id DESC LIMIT 1) ELSE '' END AS preview,
      CASE WHEN m.status='joined' THEN (SELECT count(*) FROM (SELECT id FROM mail_room_message WHERE room_id=r.id AND id>m.read_id AND sender_id!=m.user_id LIMIT 100)) ELSE 0 END AS unread,
      CASE WHEN m.status='joined' THEN (SELECT coalesce(max(id),0) FROM mail_room_message WHERE room_id=r.id) ELSE 0 END AS latestId
      FROM mail_room_member m JOIN mail_room r ON r.id=m.room_id
      JOIN user actor ON actor.user_id=m.user_id AND actor.status=0 AND actor.is_del=0
      JOIN user owner ON owner.user_id=r.owner_id
      LEFT JOIN mail_user_profile op ON op.user_id=owner.user_id LEFT JOIN mail_user_handle oh ON oh.user_id=owner.user_id
      WHERE m.user_id=? AND owner.status=0 AND owner.is_del=0
      ORDER BY (m.status='invited') DESC,latestId DESC,r.created_at DESC,r.id LIMIT 200`).bind(userContext.getUserId(c)).all();
    return results;
  },
  async create(c,params) {
    const name=typeof params?.name==='string'?params.name.trim():'';
    if (!name || name.length>80 || !['group','channel'].includes(params?.kind)) fail();
    const id=uuid(), userId=userContext.getUserId(c);
    const results=await c.env.db.batch([
      c.env.db.prepare(`INSERT INTO mail_room(id,kind,name,owner_id) SELECT ?,?,?,user_id FROM user WHERE user_id=? AND is_del=0 AND status=0
        AND (SELECT count(*) FROM mail_room WHERE owner_id=?)<20
        AND (SELECT count(*) FROM mail_room_member WHERE user_id=?)<200`).bind(id,params.kind,name,userId,userId,userId),
      c.env.db.prepare(`INSERT INTO mail_room_member(room_id,user_id,role,status)
        SELECT id,owner_id,'owner','joined' FROM mail_room WHERE id=? AND owner_id=?`).bind(id,userId)
    ]);
    if (!results[0].meta.changes) fail('roomLimit',409);
    await this.notify(c,id);
    return this.access(c,id);
  },
  async rename(c,id,params) {
    const room=await this.access(c,id);
    if (!privileged(room)) forbidden();
    const name=typeof params?.name==='string'?params.name.trim():'';
    if (!name || name.length>80) fail();
    await c.env.db.prepare(`UPDATE mail_room SET name=? WHERE id=? AND EXISTS (
      SELECT 1 FROM mail_room_member WHERE room_id=? AND user_id=? AND status='joined' AND role IN ('owner','admin'))`)
      .bind(name,id,id,userContext.getUserId(c)).run();
    await this.notify(c,id);
  },
  async members(c,id) {
    await this.access(c,id);
    const {results}=await c.env.db.prepare(`SELECT ${personFields},m.role,m.status FROM mail_room_member m
      JOIN user u ON u.user_id=m.user_id ${personJoins}
      WHERE m.room_id=? AND u.is_del=0 AND u.status=0
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,m.user_id`)
      .bind(userContext.getUserId(c),id).all();
    return results;
  },
  async invite(c,id,params) {
    const room=await this.access(c,id);
    if (!privileged(room)) forbidden();
    const username=normalizeUsername(params?.username);
    if (!username) fail();
    const user=await c.env.db.prepare(`SELECT u.user_id FROM mail_user_handle h JOIN user u ON u.user_id=h.user_id
      WHERE h.username=? AND u.is_del=0 AND u.status=0`).bind(username).first();
    if (!user) fail('contactNotFound',404);
    const result=await c.env.db.prepare(`INSERT INTO mail_room_member(room_id,user_id,role,status)
      SELECT ?,?,'member','invited' WHERE (SELECT count(*) FROM mail_room_member WHERE room_id=?)<100
      AND (SELECT count(*) FROM mail_room_member WHERE user_id=?)<200
      AND EXISTS(SELECT 1 FROM mail_room_member WHERE room_id=? AND user_id=? AND status='joined' AND role IN ('owner','admin'))
      ON CONFLICT(room_id,user_id) DO NOTHING`).bind(id,user.user_id,id,user.user_id,id,userContext.getUserId(c)).run();
    if (!result.meta.changes && !await c.env.db.prepare('SELECT 1 FROM mail_room_member WHERE room_id=? AND user_id=?').bind(id,user.user_id).first()) fail('roomLimit',409);
    await this.notify(c,id);
  },
  async respond(c,id,params) {
    const room=await this.access(c,id,true), userId=userContext.getUserId(c);
    if (typeof params?.accept!=='boolean') fail();
    if (room.status!=='invited') fail('invalidInput',409);
    if (params.accept) await c.env.db.prepare("UPDATE mail_room_member SET status='joined',read_id=coalesce((SELECT max(id) FROM mail_room_message WHERE room_id=?),0) WHERE room_id=? AND user_id=? AND status='invited'").bind(id,id,userId).run();
    else await c.env.db.prepare("DELETE FROM mail_room_member WHERE room_id=? AND user_id=? AND status='invited'").bind(id,userId).run();
    await this.notify(c,id,[userId]);
  },
  async leave(c,id) {
    const room=await this.access(c,id,true), userId=userContext.getUserId(c);
    if (room.role==='owner') fail('roomOwnerLeave',409);
    await c.env.db.prepare("DELETE FROM mail_room_member WHERE room_id=? AND user_id=? AND role!='owner'").bind(id,userId).run();
    await this.notify(c,id,[userId]);
  },
  async updateMember(c,id,rawUserId,params) {
    const room=await this.access(c,id), target=positive(rawUserId);
    if (room.role!=='owner' || target===room.ownerId) forbidden();
    if (!['admin','member'].includes(params?.role)) fail();
    await c.env.db.prepare("UPDATE mail_room_member SET role=? WHERE room_id=? AND user_id=? AND status='joined' AND role!='owner'").bind(params.role,id,target).run();
    await this.notify(c,id);
  },
  async removeMember(c,id,rawUserId) {
    const room=await this.access(c,id), target=positive(rawUserId);
    if (!privileged(room) || target===room.ownerId) forbidden();
    const result=await c.env.db.prepare(`DELETE FROM mail_room_member WHERE room_id=? AND user_id=? AND role!='owner'
      AND (?='owner' OR role='member') AND EXISTS (
        SELECT 1 FROM mail_room_member actor WHERE actor.room_id=? AND actor.user_id=? AND actor.status='joined' AND actor.role IN ('owner','admin'))`)
      .bind(id,target,room.role,id,userContext.getUserId(c)).run();
    if (!result.meta.changes) forbidden();
    await this.notify(c,id,[target]);
  },
  async remove(c,id) {
    const room=await this.access(c,id);
    if (room.role!=='owner') forbidden();
    const members=await c.env.db.prepare('SELECT user_id FROM mail_room_member WHERE room_id=?').bind(id).all();
    await c.env.db.prepare('DELETE FROM mail_room WHERE id=? AND owner_id=?').bind(id,userContext.getUserId(c)).run();
    c.executionCtx.waitUntil(notifyRoomUsers(c.env,id,members.results.map(r=>r.user_id)));
  },
  async messages(c,id,query) {
    await this.access(c,id);
    if (query.before && query.after) fail();
    const cursor=query.before?positive(query.before):query.after?positive(query.after):null;
    const after=!!query.after;
    const {results}=await c.env.db.prepare(`SELECT m.id,m.sender_id AS senderId,m.body,m.created_at AS createdAt,
      ${personFields} FROM mail_room_message m JOIN user u ON u.user_id=m.sender_id ${personJoins}
      WHERE m.room_id=? ${cursor?`AND m.id ${after?'>':'<'} ?`:''} ORDER BY m.id ${after?'ASC':'DESC'} LIMIT 51`)
      .bind(userContext.getUserId(c),id,...(cursor?[cursor]:[])).all();
    const rows=results.slice(0,50), senders={};
    for (const row of rows) senders[row.senderId]={userId:row.userId,displayName:row.displayName,username:row.username,avatar:row.avatar};
    const messages=rows.map(({id:messageId,senderId,body,createdAt})=>({id:messageId,roomId:id,senderId,body,createdAt}));
    return {messages:after?messages:messages.reverse(),senders,hasMore:results.length>50};
  },
  async send(c,id,params) {
    const room=await this.access(c,id), userId=userContext.getUserId(c);
    if (room.kind==='channel' && !privileged(room)) forbidden();
    const body=typeof params?.body==='string'?params.body.trim():'';
    if (!body || body.length>20000 || typeof params?.clientId!=='string' || !/^[A-Za-z0-9_-]{16,80}$/.test(params.clientId)) fail();
    await c.env.db.prepare(`INSERT INTO mail_room_message(room_id,sender_id,client_id,body)
      SELECT r.id,m.user_id,?,? FROM mail_room r JOIN mail_room_member m ON m.room_id=r.id JOIN user u ON u.user_id=m.user_id
      WHERE r.id=? AND m.user_id=? AND m.status='joined' AND u.status=0 AND u.is_del=0 AND (r.kind='group' OR m.role IN ('owner','admin'))
      ON CONFLICT(sender_id,client_id) DO NOTHING`).bind(params.clientId,body,id,userId).run();
    const message=await c.env.db.prepare(`SELECT id,room_id AS roomId,body FROM mail_room_message WHERE sender_id=? AND client_id=?`).bind(userId,params.clientId).first();
    if (!message) forbidden();
    if (message.roomId!==id || message.body!==body) fail('invalidInput',409);
    await this.notify(c,id);
    return {id:message.id};
  },
  async read(c,id,params) {
    await this.access(c,id);
    const through=positive(params?.through);
    await c.env.db.prepare(`UPDATE mail_room_member SET read_id=max(read_id,?) WHERE room_id=? AND user_id=? AND status='joined'
      AND EXISTS(SELECT 1 FROM mail_room_message WHERE room_id=? AND id=?)`).bind(through,id,userContext.getUserId(c),id,through).run();
  },
  async translate(c,id,rawMessageId,params) {
    await this.access(c,id);
    const message=await c.env.db.prepare('SELECT body FROM mail_room_message WHERE room_id=? AND id=?').bind(id,positive(rawMessageId)).first();
    if (!message) fail('translateErrorUnavailable',404);
    return translation.translateText(c,message.body,params?.target);
  }
};
