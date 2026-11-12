import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import permService from './perm-service';
import {notifyMail,notifyRoomUsers} from '../chat/mail-notify';
export const officialFields = alias => `EXISTS(SELECT 1 FROM mail_official_identity oi WHERE oi.user_id=${alias}.user_id AND oi.active=1) AS officialVerified, (SELECT subject FROM mail_official_identity oi WHERE oi.user_id=${alias}.user_id AND oi.active=1) AS officialSubject, (SELECT description FROM mail_official_identity oi WHERE oi.user_id=${alias}.user_id AND oi.active=1) AS officialDescription`;
export default {
 async authorize(c){
  const actor=await c.env.db.prepare('SELECT user_id,email FROM user WHERE user_id=? AND status=0 AND is_del=0').bind(userContext.getUserId(c)).first();
  if(!actor||!(actor.email===c.env.admin||(await permService.userPermKeys(c,actor.user_id)).includes('user:verify')))throw new BizError('unauthorized',403);
  return actor.user_id;
 },
 async history(c,params){await this.authorize(c);const id=Number(params.userId);if(!Number.isSafeInteger(id)||id<1)throw new BizError('invalidInput',400);return (await c.env.db.prepare('SELECT active,subject,description,actor_id AS actorId,created_at AS createdAt FROM mail_official_audit WHERE user_id=? ORDER BY id DESC LIMIT 50').bind(id).all()).results;},
 async save(c,params){
  const actor=await this.authorize(c),id=Number(params?.userId),active=params?.active;
  if(!Number.isSafeInteger(id)||id<1||typeof active!=='boolean')throw new BizError('invalidInput',400);
  const subject=typeof params.subject==='string'?params.subject.trim():'',description=typeof params.description==='string'?params.description.trim():'';
  if(subject.length>80||description.length>240||active&&(!subject||!description))throw new BizError('invalidInput',400);
  const target=await c.env.db.prepare(`SELECT 1 FROM user WHERE user_id=? ${active?'AND is_del=0 AND status=0':''}`).bind(id).first();if(!target)throw new BizError('invalidInput',404);
  await c.env.db.batch([
   c.env.db.prepare(`INSERT INTO mail_official_identity(user_id,active,subject,description,actor_id) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,subject=excluded.subject,description=excluded.description,actor_id=excluded.actor_id,updated_at=CURRENT_TIMESTAMP`).bind(id,active?1:0,active?subject:'',active?description:'',actor),
   c.env.db.prepare('INSERT INTO mail_official_audit(user_id,active,subject,description,actor_id) VALUES(?,?,?,?,?)').bind(id,active?1:0,subject,description,actor)
  ]);
  const {results:peers}=await c.env.db.prepare(`SELECT DISTINCT user_id FROM email WHERE send_email IN(SELECT email FROM account WHERE user_id=?) UNION SELECT low_user_id FROM chat_friendship WHERE high_user_id=? UNION SELECT high_user_id FROM chat_friendship WHERE low_user_id=?`).bind(id,id,id).all();
  const {results:rooms}=await c.env.db.prepare('SELECT DISTINCT m.room_id,m.user_id FROM mail_room_member m WHERE m.room_id IN(SELECT room_id FROM mail_room_member WHERE user_id=?)').bind(id).all();
  c.executionCtx.waitUntil(Promise.all([notifyMail(c.env,id,...peers.map(p=>p.user_id)),...Array.from(new Set(rooms.map(r=>r.room_id))).map(room=>notifyRoomUsers(c.env,room,rooms.filter(r=>r.room_id===room).map(r=>r.user_id)))]));
  return {officialVerified:active,officialSubject:active?subject:null,officialDescription:active?description:null};
 }
};
