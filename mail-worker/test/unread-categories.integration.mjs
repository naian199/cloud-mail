import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {webcrypto} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root=new URL(process.env.MAIL_CHAT_TEST_URL||'http://127.0.0.1:8787/');
if(!['127.0.0.1','localhost','[::1]'].includes(root.hostname))throw Error('Local Worker required');
async function api(path,user,method='GET',body){return(await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:user.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();}
async function user(){const credentials={email:'room'+randomBytes(6).toString('hex')+'@example.com',password:randomBytes(12).toString('hex')};assert.equal((await api('register',null,'POST',credentials)).code,200);const login=await api('login',null,'POST',credentials);const token=login.data.token;const profile=await api('my/loginUserInfo',{token});const username='member'+randomBytes(5).toString('hex');assert.equal((await api('my/username',{token},'PUT',{username})).code,200);return{...credentials,token,username,id:profile.data.userId};}
const post=(id,user,body,clientId=randomUUID())=>api(`chat/rooms/${id}/messages`,user,'POST',{body,clientId});
await test('category unread counts follow mailbox, membership, mail identity and read state',{timeout:60000},async()=>{
 if(!process.env.MAIL_CHAT_TEST_SQLITE)throw Error('Local SQLite fixture required');
 const db=new DatabaseSync(process.env.MAIL_CHAT_TEST_SQLITE);db.exec('PRAGMA busy_timeout=5000');
 try{
  const [a,b,c]=await Promise.all([user(),user(),user()]);
  const account=(await api('my/loginUserInfo',b)).data.account.accountId;
  const aa=(await api('my/loginUserInfo',a)).data.account.accountId;
  assert.equal((await api('mail-chat/instant',a,'POST',{accountId:aa,clientId:randomUUID(),recipients:[b.email],subject:'Private',text:'Internal unread'})).code,200);
  db.prepare('UPDATE email SET conversation_peers=? WHERE user_id=? AND account_id=? AND type=0').run(JSON.stringify([a.email.toUpperCase()]),b.id,account);
  const alias=Number(db.prepare('INSERT INTO account(user_id,email) VALUES(?,?)').run(b.id,'alias'+randomBytes(6).toString('hex')+'@example.com').lastInsertRowid);
  const outside='sender@example.net',key=createHash('sha256').update(outside).digest('hex');
  const insert=db.prepare(`INSERT INTO email(user_id,account_id,send_email,text,subject,type,status,unread,is_del,message_id,conversation_key,conversation_peers,ingest_key) VALUES(?,?,?,'Category fixture','External',?,?,?,?,?,?,?,?)`);
  const add=(aid=account,options={})=>Number(insert.run(b.id,aid,outside,options.type??0,options.status??2,options.read??0,options.deleted??0,options.identity??'<'+randomUUID()+'@example.net>',options.key??key,JSON.stringify(options.peers??[outside]),options.ingest??null).lastInsertRowid);
  const identity='<duplicate-'+randomUUID()+'@example.net>';add(account,{identity});const extThrough=add(account,{identity});
  const mixedKey=createHash('sha256').update('mixed-'+randomUUID()).digest('hex');const mixed=add(account,{key:mixedKey,peers:[a.email,outside]});add(alias);
  add(account,{read:1});add(account,{deleted:1});add(account,{status:6});add(account,{type:1});add(account,{ingest:'legacy-chat:category-fixture-'+randomUUID()});
  const rooms={};
  for(const kind of ['group','channel']){
   const room=(await api('chat/rooms',a,'POST',{kind,name:'Unread '+kind})).data.id;rooms[kind]=room;
   await api(`chat/rooms/${room}/members`,a,'POST',{username:b.username});await api(`chat/rooms/${room}/membership`,b,'PUT',{accept:true});await api(`chat/rooms/${room}/members`,a,'POST',{username:c.username});
   rooms[kind+'Message']=(await post(room,a,'Unread '+kind)).data.id;
  }
  const poll=async u=>(await api('my/push/poll',u)).data;
  let data=await poll(b);assert.equal(data.unread,6);assert.deepEqual(data.unreadSummary.categories,{chat:1,external:3,group:1,channel:1});assert.deepEqual(data.unreadSummary.accounts[account],{chat:1,external:2});assert.deepEqual(data.unreadSummary.accounts[alias],{chat:0,external:1});
  assert.equal((await poll(a)).unread,0);assert.equal((await poll(c)).unread,0);assert.deepEqual((await poll(c)).unreadSummary.accounts,{});
  await api(`chat/rooms/${rooms.group}/read`,b,'PUT',{through:rooms.groupMessage});assert.equal((await poll(b)).unreadSummary.categories.group,0);
  await api(`chat/rooms/${rooms.channel}/membership`,b,'DELETE');assert.equal((await poll(b)).unreadSummary.categories.channel,0);
  const conversation=(await api('mail-chat/conversations?accountId='+account+'&category=internal',b)).data.conversations[0];await api('mail-chat/read',b,'PUT',{accountId:account,key:conversation.key,through:conversation.latestId});assert.equal((await poll(b)).unreadSummary.categories.chat,0);
  await api('mail-chat/read',b,'PUT',{accountId:account,key,through:extThrough});assert.equal((await poll(b)).unreadSummary.accounts[account].external,1);
  db.prepare('UPDATE account SET status=1 WHERE account_id=?').run(alias);assert.equal((await poll(b)).unread,1);
  await api('mail-chat/read',b,'PUT',{accountId:account,key:mixedKey,through:mixed});data=await poll(b);assert.equal(data.unread,0);assert.deepEqual(data.unreadSummary.categories,{chat:0,external:0,group:0,channel:0});
 }finally{db.close();}
});
