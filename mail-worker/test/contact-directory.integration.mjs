import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
const root = new URL(process.env.MAIL_CHAT_TEST_URL || 'http://127.0.0.1:8787/');
if (!['localhost','127.0.0.1','[::1]'].includes(root.hostname)) throw Error('Local Worker required');
async function api(path, user, method='GET', body) {
 return (await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:user.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();
}
async function user() {
 const credentials={email:'directory'+randomBytes(6).toString('hex')+'@example.com',password:randomBytes(12).toString('hex')};
 assert.equal((await api('register',null,'POST',credentials)).code,200);
 const login=await api('login',null,'POST',credentials);
 const token=login.data.token;
 const profile=await api('my/loginUserInfo',{token});
 return {...credentials,token,account:profile.data.account.accountId};
}
await test('unique usernames support friend discovery and private searchable contact notes',async t=>{
 const [a,b,c]=await Promise.all([user(),user(),user()]);
 const handle='person'+randomBytes(5).toString('hex');
 const claims=await Promise.all([api('my/username',a,'PUT',{username:handle.toUpperCase()}),api('my/username',b,'PUT',{username:'@'+handle})]);
 assert.deepEqual(claims.map(r=>r.code).sort(),[200,409]);
 assert.equal(claims.find(r=>r.code===409).errorKey,'contactUsernameTaken');
 const owner=claims[0].code===200?a:b;
 const peer=owner===a?b:a;
 assert.equal((await api('my/profile',owner)).data.username,handle);
 assert.equal((await api('my/username',peer,'PUT',{username:'@'})).code,400);
 assert.equal((await api('my/username',peer,'PUT',{username:'ab'})).code,400);
 assert.equal((await api('my/username',null,'PUT',{username:handle})).code,401);
 assert.equal((await api('chat/users?username='+handle,null)).code,401);
 const found=(await api('chat/users?username=@'+handle.toUpperCase(),c)).data;
 assert.equal(found.length,1);assert.equal(found[0].username,handle);
 assert.equal('email' in found[0],false);
 const request=await api('chat/friends',peer,'POST',{username:'@'+handle});
 assert.equal(request.code,200);
 const friends=(await api('chat/friends',owner)).data;
 assert.equal(friends[0].id,request.data.id);
 assert.equal((await api('chat/friends/'+request.data.id,owner,'PUT',{accept:true})).code,200);
 assert.equal((await api('chat/contacts/note',peer,'PUT',{email:owner.email,remark:'我的好友备注'})).code,200);
 assert.equal((await api('chat/friends',peer)).data.find(f=>f.id===request.data.id).remark,'我的好友备注');
 assert.equal((await api('chat/friends',owner)).data.find(f=>f.id===request.data.id).remark,null);
 assert.equal((await api('chat/contacts/note',c,'PUT',{email:owner.email,remark:'另一个人的备注'})).code,200);
 assert.equal((await api('chat/friends',peer)).data.find(f=>f.id===request.data.id).remark,'我的好友备注');
 assert.equal((await api('chat/contacts/note',peer,'PUT',{email:owner.email,remark:'x'.repeat(51)})).code,400);
 const opened=await api('mail-chat/open',peer,'POST',{accountId:peer.account,email:owner.email});
 assert.equal(opened.code,200);
 assert.equal((await api('mail-chat/instant',peer,'POST',{accountId:peer.account,recipients:[owner.email],text:'Note search check',subject:'Contact notes',clientId:randomUUID()})).code,200);
 const contacts=await api('mail-chat/conversations?accountId='+peer.account+'&search='+encodeURIComponent('我的好友备注'),peer);
 assert(contacts.data.contacts.some(row=>row.profile?.remark==='我的好友备注'));
 assert(contacts.data.conversations.some(row=>row.profile?.remark==='我的好友备注'));
 const opposite=await api('mail-chat/conversations?accountId='+owner.account,owner);
 assert(!JSON.stringify(opposite).includes('我的好友备注'));
 assert.equal((await api('chat/contacts/note',peer,'PUT',{email:owner.email,remark:''})).code,200);
 assert.equal((await api('chat/friends',peer)).data.find(f=>f.id===request.data.id).remark,null);
 assert.equal((await api('my/username',owner,'PUT',{username:''})).code,200);
 assert.deepEqual((await api('chat/users?username='+handle,c)).data,[]);
 assert.equal((await api('my/username',peer,'PUT',{username:handle})).code,200);
});
