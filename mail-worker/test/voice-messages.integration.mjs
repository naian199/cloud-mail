import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root=new URL(process.env.MAIL_CHAT_TEST_URL||'http://127.0.0.1:8787/');
if(!['127.0.0.1','localhost','[::1]'].includes(root.hostname))throw Error('Local Worker required');
async function api(path,user,method='GET',body){return(await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:user.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();}
async function user(){const credentials={email:'room'+randomBytes(6).toString('hex')+'@example.com',password:randomBytes(12).toString('hex')};assert.equal((await api('register',null,'POST',credentials)).code,200);const login=await api('login',null,'POST',credentials);const token=login.data.token;const profile=await api('my/loginUserInfo',{token});const username='member'+randomBytes(5).toString('hex');assert.equal((await api('my/username',{token},'PUT',{username})).code,200);return{...credentials,token,username,id:profile.data.userId};}
const post=(id,user,body,clientId=randomUUID())=>api(`chat/rooms/${id}/messages`,user,'POST',{body,clientId});
await test('voice messages enforce membership, channel posting, retry identity and protected transcription', {timeout:60000},async()=>{
 const [a,b,c]=await Promise.all([user(),user(),user()]);
 const audio={filename:'voice-test.webm',contentType:'audio/webm',content:Buffer.from([26,69,223,163,...new Array(32).fill(0)]).toString('base64')};
 const group=(await api('chat/rooms',a,'POST',{kind:'group',name:'Voice group'})).data.id;
 const base=`chat/rooms/${group}`,clientId=randomUUID();
 const sent=await api(base+'/messages',a,'POST',{body:'',voice:audio,clientId});assert.equal(sent.code,200);
 assert.equal((await api(base+'/messages',a,'POST',{body:'',voice:audio,clientId})).data.id,sent.data.id);
 assert.equal((await api(base+'/messages',a,'POST',{body:'different',voice:audio,clientId})).code,409);
 const history=(await api(base+'/messages',a)).data.messages;assert.equal(history.length,1);assert.equal(history[0].body,'');assert.equal(history[0].voice.mimeType,'audio/webm');assert.equal(history[0].voice.key,undefined);
 const voicePath=base+`/messages/${sent.data.id}/voice`;
 assert.equal((await api(voicePath,c)).code,403);
 assert.equal((await api('mail-chat/transcribe',c,'POST',{roomId:group,messageId:sent.data.id})).code,403);
 assert.equal((await api(base+'/members',a,'POST',{username:b.username})).code,200);
 assert.equal((await api(voicePath,b)).code,403);
 assert.equal((await api(base+'/membership',b,'PUT',{accept:true})).code,200);
 const response=await fetch(new URL('api/'+voicePath,root),{headers:{Authorization:b.token}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(audio.content,'base64'));
 assert.equal((await api('mail-chat/transcribe',b,'POST',{roomId:group,messageId:sent.data.id})).code,503);
 assert.equal((await api('mail-chat/transcribe',b,'POST',{audio:{...audio,content:'<html>'}})).code,400);
 assert.equal((await api(base+'/members/'+b.id,a,'DELETE')).code,200);
 assert.equal((await api(voicePath,b)).code,403);
 const channel=(await api('chat/rooms',a,'POST',{kind:'channel',name:'Voice channel'})).data.id;
 await api(`chat/rooms/${channel}/members`,a,'POST',{username:b.username});await api(`chat/rooms/${channel}/membership`,b,'PUT',{accept:true});
 assert.equal((await api(`chat/rooms/${channel}/messages`,b,'POST',{body:'',voice:audio,clientId:randomUUID()})).code,403);
 assert.equal((await api(`chat/rooms/${channel}/messages`,a,'POST',{body:'',voice:audio,clientId:randomUUID()})).code,200);
 assert.equal((await api(base,a,'DELETE')).code,200);assert.equal((await api(voicePath,a)).code,403);
});

await test('private voice attachments are playable by sender and recipient and never by outsiders',{timeout:60000},async()=>{
 const [a,b,c]=await Promise.all([user(),user(),user()]);
 const accountA=(await api('my/loginUserInfo',a)).data.account.accountId,accountB=(await api('my/loginUserInfo',b)).data.account.accountId;
 const content=Buffer.from([26,69,223,163,...new Array(32).fill(0)]).toString('base64');
 const sent=await api('mail-chat/instant',a,'POST',{accountId:accountA,recipients:[b.email],subject:'Voice',text:'',clientId:randomUUID(),attachments:[{filename:'voice-private.webm',contentType:'audio/webm',content,size:36}]});assert.equal(sent.code,200);
 const conversations=(await api(`mail-chat/conversations?accountId=${accountB}`,b)).data.conversations;
 assert.equal(conversations.length,1);
 const history=(await api(`mail-chat/messages?accountId=${accountB}&key=${conversations[0].key}`,b)).data.messages;
 const attachment=history.flatMap(row=>row.attachments||[])[0];assert(attachment);assert.equal(attachment.mimeType,'audio/webm');
 const downloaded=await fetch(new URL(`api/mail-chat/attachment/${attachment.attId}`,root),{headers:{Authorization:b.token}});assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),Buffer.from(content,'base64'));
 assert.equal((await api('mail-chat/transcribe',c,'POST',{attId:attachment.attId})).code,404);
 assert.equal((await api('mail-chat/transcribe',b,'POST',{attId:attachment.attId})).code,503);
});
