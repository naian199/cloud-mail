import settingService from './setting-service';
import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import {identityUsername} from '../../../shared/user-identity.mjs';
export function requiredUsername(value){const result=identityUsername(value);if(result.error)throw new BizError(result.error,400);return result.name;}
export function identityConflict(error){
 const text=String(error?.message||'')+' '+String(error?.cause?.message||'');
 if(/mail_user_handle.*(?:username|user_id)|UNIQUE constraint failed: mail_user_handle/i.test(text))throw new BizError('contactUsernameTaken',409);
 if(/identity_mailbox_taken/i.test(text))throw new BizError('identityMailboxTaken',409);
 throw error;
}
export default {
 async availability(c,params){
  const ip=c.req.header('CF-Connecting-IP')||'local';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
  const key=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const window=Math.floor(Date.now()/60000);
  const row=await c.env.db.prepare(`INSERT INTO mail_identity_rate(ip,window,count) VALUES(?,?,1) ON CONFLICT(ip) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END RETURNING count`).bind(key,window).first();
  if(row.count>30)throw new BizError('identityTooManyChecks',429);
  await c.env.db.prepare('DELETE FROM mail_identity_rate WHERE window<?').bind(window-10).run();
  const username=requiredUsername(params.username);
  const domain=typeof params.domain==='string'?params.domain.replace(/^@/,'').toLowerCase():'';
  const domains=typeof c.env.domain==='string'?JSON.parse(c.env.domain):c.env.domain;
  if(!domains.includes(domain))throw new BizError('invalidInput',400);
  const email=username+'@'+domain;
  const settings=await settingService.query(c);
  if(settings.register!==0 || username.length<settings.minEmailPrefix || settings.emailPrefixFilter.some(part=>username.includes(part)))return {username,email,available:false,reason:'identityNamePolicy'};
  const handle=await c.env.db.prepare('SELECT 1 FROM mail_user_handle WHERE username=? COLLATE NOCASE').bind(username).first();
  const mailbox=await c.env.db.prepare('SELECT 1 FROM account WHERE email=? COLLATE NOCASE UNION ALL SELECT 1 FROM user WHERE email=? COLLATE NOCASE LIMIT 1').bind(email,email).first();
  return {username,email,available:!handle&&!mailbox,reason:handle?'contactUsernameTaken':mailbox?'identityMailboxTaken':null};
 },
 async claim(c,params){
  const username=requiredUsername(params?.username),userId=userContext.getUserId(c);
  const existing=await c.env.db.prepare('SELECT username FROM mail_user_handle WHERE user_id=?').bind(userId).first();
  if(existing){if(existing.username.toLowerCase()===username)return existing;throw new BizError('identityUsernameLocked',409);}
  try{await c.env.db.prepare('INSERT INTO mail_user_handle(user_id,username) VALUES(?,?)').bind(userId,username).run();}catch(error){identityConflict(error);}
  return {username};
 }
};
