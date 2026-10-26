import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const root=new URL(process.env.MAIL_CHAT_TEST_URL||'http://127.0.0.1:8787/');
if(!['127.0.0.1','localhost','[::1]'].includes(root.hostname)||!process.env.MAIL_CHAT_TEST_SQLITE)throw Error('Initialized local Worker and SQLite required');
const db=new DatabaseSync(process.env.MAIL_CHAT_TEST_SQLITE);db.exec('PRAGMA busy_timeout=5000');
let role=db.prepare('SELECT role_id FROM role WHERE name=?').get('mail-chat-local-test');
if(!role){const inserted=db.prepare("INSERT INTO role(name,key,send_type,send_count,account_count,is_default,ban_email,avail_domain) VALUES(?,?,'internal',0,10,0,'','')").run('mail-chat-local-test','mail-chat-local-test');role={role_id:Number(inserted.lastInsertRowid)};db.prepare('INSERT INTO role_perm(role_id,perm_id) SELECT ?,perm_id FROM perm WHERE type=2 AND perm_key IN (?,?,?)').run(role.role_id,'email:send','account:query','account:add');}
async function api(path,user,method='GET',body){return(await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:user.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();}
async function user(){const name='omni'+randomBytes(5).toString('hex'),email=name+'@example.com',password=randomBytes(12).toString('hex');assert.equal((await api('register',null,'POST',{email,password})).code,200);db.prepare("UPDATE user SET type=(SELECT role_id FROM role WHERE name='mail-chat-local-test') WHERE email=?").run(email);const login=await api('login',null,'POST',{email,password});const u={email,token:login.data.token,username:name};const profile=await api('my/loginUserInfo',u);u.account=profile.data.account.accountId;assert.equal((await api('my/username',u,'PUT',{username:name})).code,200);return u;}
const search=(u,term,extra={})=>api('mail-chat/search?'+new URLSearchParams({accountId:u.account,search:term,...extra}),u);
async function send(a,b,text,extra={}){const result=await api('mail-chat/send',a,'POST',{accountId:a.account,clientId:randomUUID(),recipients:[b.email],subject:'全局搜索',text,...extra});assert.equal(result.code,200);return result.data;}
await test('universal search scopes mail, users, filenames and private group history; paginates and respects deletion',{timeout:90000},async()=>{
 const a=await user(),b=await user(),c=await user(),term='find'+randomBytes(5).toString('hex');
 assert.equal((await api('mail-chat/search?accountId='+a.account+'&search=x',null)).code,401);
 assert.equal((await search(b,term,{accountId:a.account})).code,403);
 for(const extra of [{search:''},{search:'x'.repeat(101)},{section:'unknown'},{beforeMail:'-1'},{beforeRoom:'1 OR 1=1'}])assert.equal((await search(a,term,extra)).code,400);
 const sent=[];for(let i=0;i<25;i++)sent.push(await send(a,b,term+' message '+i));
 await send(a,b,'long '.repeat(400)+term);
 let found=await search(a,term);assert.equal(found.code,200);assert.equal(found.data.messages.length,20);assert(found.data.moreMail);assert(found.data.messages.some(row=>row.text.includes(term)&&row.text.startsWith('…')));
 const next=await search(a,term,{section:'mail',beforeMail:found.data.beforeMail});assert.equal(next.code,200);assert.equal(next.data.messages.length,6);assert.equal(next.data.moreMail,false);assert.equal(new Set([...found.data.messages,...next.data.messages].map(row=>row.emailId)).size,26);
 assert.equal((await search(c,term)).data.messages.length,0);
 const filename='report-'+term+'.pdf';await send(a,b,'attachment only',{attachments:[{filename,contentType:'application/pdf',content:'c2FmZSBmaXh0dXJl'}]});found=await search(a,filename);assert.equal(found.data.messages.length,1);assert(found.data.messages[0].files.includes(filename));assert(!JSON.stringify(found.data).includes('htmlPreview'));
 const person=await search(a,'@'+c.username);assert(person.data.users.some(row=>row.username===c.username));assert(!person.data.users.some(row=>'email' in row));
 await api('chat/friends',a,'POST',{username:b.username});const invitations=await api('chat/friends',b);assert.equal((await api('chat/friends/'+invitations.data[0].id,b,'PUT',{accept:true})).code,200);
 const remark='客户备注'+term;assert.equal((await api('chat/contacts/note',a,'PUT',{email:b.email,remark})).code,200);assert((await search(a,remark)).data.friends.some(row=>row.email===b.email));assert(!(await search(b,remark)).data.friends.length);
 const group=(await api('chat/rooms',a,'POST',{kind:'group',name:'私人群'+term})).data,base='chat/rooms/'+group.id;
 for(let i=0;i<23;i++)assert.equal((await api(base+'/messages',a,'POST',{body:term+' group '+i,clientId:randomUUID()})).code,200);
 assert.equal((await api(base+'/members',a,'POST',{username:b.username})).code,200);
 assert.equal((await search(c,term)).data.rooms.length,0);assert.equal((await search(c,term)).data.roomMessages.length,0);
 const invited=await search(b,term);assert(invited.data.rooms.some(row=>row.id===group.id&&row.status==='invited'));assert.equal(invited.data.roomMessages.length,0);
 assert.equal((await api(base+'/membership',b,'PUT',{accept:true})).code,200);const joined=await search(b,term);assert.equal(joined.data.roomMessages.length,20);assert(joined.data.moreRoom);const older=await search(b,term,{section:'room',beforeRoom:joined.data.beforeRoom});assert.equal(older.data.roomMessages.length,3);
 const target=older.data.roomMessages.at(-1).id;const around=await api(base+'/messages?around='+target,b);assert.equal(around.code,200);assert(around.data.messages.some(row=>row.id===target));assert.equal((await api(base+'/messages?around='+target,c)).code,403);assert.equal((await api(base+'/messages?around='+target+'&before=1',b)).code,400);
 const secret='removed'+term,victim=await send(a,b,secret),reply=await send(a,b,'surviving reply',{replyId:victim.emailId,quote:true});
 assert.equal((await api('mail-chat/delete',a,'POST',{accountId:a.account,key:reply.conversationKey,emailId:victim.emailId,through:reply.emailId})).code,200);
 const removed=await search(a,secret);assert.equal(removed.code,200);assert.equal(removed.data.messages.length,0);assert.equal(removed.data.conversations.length,0);assert(!JSON.stringify(removed.data).includes(secret));
 await api(base+'/membership',b,'DELETE');assert.equal((await search(b,term)).data.roomMessages.length,0);
 db.prepare('UPDATE account SET status=1 WHERE account_id=?').run(a.account);try{assert.equal((await search(a,term)).code,403);}finally{db.prepare('UPDATE account SET status=0 WHERE account_id=?').run(a.account);}
});
