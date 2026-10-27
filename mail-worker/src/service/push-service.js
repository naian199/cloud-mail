import {buildPushPayload} from '@block65/webcrypto-web-push';
import {notificationDefaults,pushEndpoint,notificationContext,notificationPayload} from '../../../shared/notification-previews.mjs';
import userContext from '../security/user-context';
import BizError from '../error/biz-error';
import {profilesFor} from './profile-service';
import {chatBody} from '../lib/mail-conversations';
const fail=(key='pushError',code=400)=>{throw new BizError(key,code);};
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function generatePushKeys(){const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {publicKey:b64(await crypto.subtle.exportKey('raw',keys.publicKey)),privateKey:(await crypto.subtle.exportKey('jwk',keys.privateKey)).d,subject:'https://e.naian.edu.kg'};}
export async function pushKeys(env){if(!env.CHAT_NOTIFICATIONS)fail('pushUnavailable',503);const response=await env.CHAT_NOTIFICATIONS.get(env.CHAT_NOTIFICATIONS.idFromName('web-push-keys')).fetch('https://chat.internal/push/keys',{method:'POST'});if(!response.ok)fail('pushUnavailable',503);return response.json();}
export async function pushPreferences(env,userId){const row=await env.db.prepare('SELECT config FROM mail_push_preference WHERE user_id=?').bind(userId).first();return {...notificationDefaults,...(row?JSON.parse(row.config):{})};}
export async function notificationCursor(env,userId){const mail=await env.db.prepare('SELECT coalesce(max(email_id),0) AS id FROM email WHERE user_id=? AND type=0').bind(userId).first();const room=await env.db.prepare(`SELECT coalesce(max(id),0) AS id FROM mail_room_message WHERE room_id IN (SELECT room_id FROM mail_room_member WHERE user_id=? AND status='joined')`).bind(userId).first();return {mail:mail.id,room:room.id};}
// Count independently of push preferences and delivery cursors: a read in any tab must clear the badge.
export async function unreadMessages(env,userId){
 const rows=await env.db.batch([
  env.db.prepare(`SELECT count(DISTINCT e.account_id||':'||CASE WHEN coalesce(e.message_id,'')!='' THEN 'm:'||e.message_id ELSE 'i:'||e.email_id END) AS count
   FROM email e JOIN account a ON a.account_id=e.account_id JOIN user u ON u.user_id=e.user_id
   WHERE e.user_id=? AND e.type=0 AND e.is_del=0 AND e.unread=0 AND e.status!=6
   AND coalesce(e.ingest_key,'') NOT LIKE 'legacy-chat:%' AND a.is_del=0 AND a.status=0 AND u.is_del=0 AND u.status=0`).bind(userId),
  env.db.prepare(`SELECT count(*) AS count FROM mail_room_message m
   JOIN mail_room_member member ON member.room_id=m.room_id AND member.user_id=? AND member.status='joined'
   JOIN mail_room r ON r.id=m.room_id JOIN user owner ON owner.user_id=r.owner_id AND owner.is_del=0 AND owner.status=0
   JOIN user actor ON actor.user_id=member.user_id AND actor.is_del=0 AND actor.status=0
   WHERE m.id>member.read_id AND m.sender_id!=member.user_id`).bind(userId)
 ]);
 return rows.reduce((sum,row)=>sum+Number(row.results[0].count),0);
}
export async function collectNotifications(env,userId,cursor){
 const prefs=await pushPreferences(env,userId),current=await notificationCursor(env,userId);if(cursor&&cursor.mail===current.mail&&cursor.room===current.room)return {cursor:current,messages:[],preferences:prefs};if(!cursor)return {cursor:current,messages:[],preferences:prefs};
 const mail=await env.db.prepare(`SELECT e.email_id AS id,e.account_id AS accountId,e.send_email AS email,e.conversation_key AS key,substr(e.text,1,1500) AS text,substr(e.content,1,16000) AS content,
 (SELECT mime_type FROM attachments WHERE email_id=e.email_id LIMIT 1) AS mime
 FROM email e JOIN account a ON a.account_id=e.account_id JOIN user u ON u.user_id=e.user_id
 WHERE e.user_id=? AND e.type=0 AND e.is_del=0 AND e.unread=0 AND e.status!=6 AND e.email_id>? AND e.email_id<=? AND coalesce(e.ingest_key,'') NOT LIKE 'legacy-chat:%'
 AND a.is_del=0 AND a.status=0 AND u.is_del=0 AND u.status=0 AND e.create_time>=datetime('now','-1 day') ORDER BY e.email_id DESC LIMIT 100`).bind(userId,cursor.mail,current.mail).all();
 const room=await env.db.prepare(`SELECT m.id,m.room_id AS roomId,substr(m.body,1,1500) AS text,r.name,r.kind,
 coalesce(nullif(p.display_name,''),h.username,'') AS sender,p.avatar,EXISTS(SELECT 1 FROM mail_room_voice WHERE message_id=m.id) AS voice
 FROM mail_room_message m JOIN mail_room r ON r.id=m.room_id JOIN mail_room_member member ON member.room_id=r.id AND member.user_id=? AND member.status='joined'
 JOIN user actor ON actor.user_id=member.user_id AND actor.is_del=0 AND actor.status=0 JOIN user owner ON owner.user_id=r.owner_id AND owner.is_del=0 AND owner.status=0
 LEFT JOIN mail_user_profile p ON p.user_id=m.sender_id LEFT JOIN mail_user_handle h ON h.user_id=m.sender_id
 WHERE m.id>? AND m.id<=? AND m.sender_id!=? AND m.id>member.read_id AND m.created_at>=datetime('now','-1 day') ORDER BY m.id DESC LIMIT 100`).bind(userId,cursor.room,current.room,userId).all();
 const profiles=await profilesFor({env,get:()=>({userId})},mail.results.map(row=>row.email));
 const candidates=[];
 for(const row of mail.results){if(!/^[a-f0-9]{64}$/.test(row.key||''))continue;const profile=profiles.get(row.email.toLowerCase()),kind=profile?.email?'private':'external';const context=`mail:${row.accountId}:${row.key}`;
 candidates.push({id:`mail:${row.id}`,context,kind,name:profile?.remark||profile?.displayName||row.email,avatar:profile?.avatar,body:chatBody(row.text,row.content).replyText,attachment:/^image\//.test(row.mime)?'image':/^video\//.test(row.mime)?'video':/^audio\//.test(row.mime)?'audio':row.mime?'file':null,url:`/${kind==='external'?'external-mail':'mail-chat'}?accountId=${row.accountId}&conversation=${row.key}&message=${row.id}`});}
 for(const row of room.results)candidates.push({id:`room:${row.id}`,context:`room:${row.roomId}`,kind:row.kind,name:`${row.sender?row.sender+' · ':''}${row.name}`,avatar:row.avatar,body:row.voice&&row.text==='🎤'?'':row.text,attachment:row.voice?'audio':null,url:`/rooms?room=${row.roomId}&message=${row.id}`});
 const grouped=new Map();for(const m of candidates){if(prefs.enabled&&prefs[m.kind]&&!prefs.muted?.[m.context]&&!grouped.has(m.context))grouped.set(m.context,notificationPayload(m,prefs,userId));}
 const messages=[...grouped.values()];if(messages.length>5){messages.splice(4);messages.push(notificationPayload({id:`summary:${current.mail}-${current.room}`,kind:'summary',context:'summary',name:'Cloud Mail',body:/^zh/.test(prefs.locale)?'还有其他会话的新消息，点击查看。':'More conversations have new messages. Open to view.',url:'/mail-chat'},prefs,userId));}
 return {cursor:current,messages,preferences:prefs};
}
export async function sendUserPush(env,userId,cursor){
 const subscriptions=(await env.db.prepare('SELECT id,endpoint,p256dh,auth FROM mail_push_subscription WHERE user_id=?').bind(userId).all()).results;
 if(!subscriptions.length)return notificationCursor(env,userId);
 const collected=await collectNotifications(env,userId,cursor);
 if(!collected.messages.length)return collected.cursor;
 const keys=await pushKeys(env);let failed=false;
 for(const subscription of subscriptions){if(!pushEndpoint(subscription.endpoint))continue;
  for(const message of collected.messages){try{
   const topic=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${userId}:${message.context}`))).slice(0,32);
   const payload=await buildPushPayload({data:JSON.stringify(message),options:{ttl:86400,urgency:'high',topic}},{endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},keys);
   const response=await fetch(subscription.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(10000)});
   if([404,410].includes(response.status)){await env.db.prepare('DELETE FROM mail_push_subscription WHERE id=? AND user_id=?').bind(subscription.id,userId).run();break;}
   if(!response.ok)failed=true;
  }catch{failed=true;console.error('Web Push delivery unavailable');}}
 }
 if(failed)throw Error('Web Push retry required');
 return collected.cursor;
}
export default {
 async config(c){const keys=await pushKeys(c.env);const userId=userContext.getUserId(c),devices=(await c.env.db.prepare('SELECT id FROM mail_push_subscription WHERE user_id=?').bind(userId).all()).results.map(row=>row.id);return {userId,devices,publicKey:keys.publicKey,preferences:await pushPreferences(c.env,userId)};},
 async save(c,params){if(!params||typeof params!=='object'||Array.isArray(params))fail();const patch={};for(const key of ['enabled','private','external','group','channel'])if(key in params){if(typeof params[key]!=='boolean')fail();patch[key]=params[key];}if('preview'in params){if(!['full','sender','none'].includes(params.preview))fail();patch.preview=params.preview;}if('locale'in params){if(typeof params.locale!=='string'||!/^[a-zA-Z-]{2,16}$/.test(params.locale))fail();patch.locale=params.locale;}
 const userId=userContext.getUserId(c),value=JSON.stringify(patch);await c.env.db.prepare(`INSERT INTO mail_push_preference(user_id,config) VALUES(?,json_set(json_patch(?,?),'$.revision',1)) ON CONFLICT(user_id) DO UPDATE SET config=json_set(json_patch(config,?),'$.revision',coalesce(json_extract(config,'$.revision'),0)+1)`).bind(userId,JSON.stringify(notificationDefaults),value,value).run();return pushPreferences(c.env,userId);},
 async mute(c,params){if(!notificationContext(params?.context)||typeof params.muted!=='boolean')fail();const userId=userContext.getUserId(c),prefs=await pushPreferences(c.env,userId),path='$.muted.'+JSON.stringify(params.context);if(params.muted&&Object.keys(prefs.muted||{}).length>=200&&!Object.hasOwn(prefs.muted,params.context))fail();
 if(!params.muted){await c.env.db.prepare(`UPDATE mail_push_preference SET config=json_set(json_remove(config,?),'$.revision',coalesce(json_extract(config,'$.revision'),0)+1) WHERE user_id=?`).bind(path,userId).run();}
 else await c.env.db.prepare(`INSERT INTO mail_push_preference(user_id,config) VALUES(?,json_set(?,?,json('true'),'$.revision',1)) ON CONFLICT(user_id) DO UPDATE SET config=json_set(config,?,json('true'),'$.revision',coalesce(json_extract(config,'$.revision'),0)+1)`).bind(userId,JSON.stringify(notificationDefaults),path,path).run();return pushPreferences(c.env,userId);},
 async subscribe(c,params){const subscription=params?.subscription;const endpoint=pushEndpoint(subscription?.endpoint);if(!endpoint||!/^[-\w]{87}$/.test(subscription?.keys?.p256dh||'')||!/^[-\w]{22}$/.test(subscription?.keys?.auth||''))fail();
 try{const publicKey=Uint8Array.from(atob(subscription.keys.p256dh.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));await crypto.subtle.importKey('raw',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);}catch{fail();}
 const userId=userContext.getUserId(c),id=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint)));
 const count=await c.env.db.prepare('SELECT count(*) AS count FROM mail_push_subscription WHERE user_id=? AND id!=?').bind(userId,id).first();if(count.count>=5)fail('pushDeviceLimit');
 await c.env.db.prepare(`INSERT INTO mail_push_subscription(id,user_id,endpoint,p256dh,auth) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM mail_push_subscription WHERE user_id=? AND id!=?)<5 ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth=excluded.auth`).bind(id,userId,endpoint,subscription.keys.p256dh,subscription.keys.auth,userId,id).run();const stored=await c.env.db.prepare('SELECT user_id AS userId FROM mail_push_subscription WHERE id=?').bind(id).first();if(stored?.userId!==userId)fail('pushDeviceLimit');
 await c.env.CHAT_NOTIFICATIONS.get(c.env.CHAT_NOTIFICATIONS.idFromName(String(userId))).fetch('https://chat.internal/push/seed',{method:'POST',headers:{'X-Notification-User':String(userId)}});return {subscribed:true};},
 async unsubscribe(c,params){if(typeof params?.endpoint!=='string')fail();await c.env.db.prepare('DELETE FROM mail_push_subscription WHERE endpoint=? AND user_id=?').bind(params.endpoint,userContext.getUserId(c)).run();const userId=userContext.getUserId(c),row=await c.env.db.prepare('SELECT count(*) AS count FROM mail_push_subscription WHERE user_id=?').bind(userId).first();if(!row.count)await c.env.CHAT_NOTIFICATIONS.get(c.env.CHAT_NOTIFICATIONS.idFromName(String(userId))).fetch('https://chat.internal/push/disable',{method:'POST'});},
 async poll(c,query){let cursor;if(query.cursor){if(!/^\d+-\d+$/.test(query.cursor))fail();const [mail,room]=query.cursor.split('-').map(Number);if(!Number.isSafeInteger(mail)||!Number.isSafeInteger(room))fail();cursor={mail,room};}const data=await collectNotifications(c.env,userContext.getUserId(c),cursor);return {...data,unread:await unreadMessages(c.env,userContext.getUserId(c)),cursor:`${data.cursor.mail}-${data.cursor.room}`};}
};
