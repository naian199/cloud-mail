import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const root=new URL(process.env.MAIL_CHAT_TEST_URL||'http://127.0.0.1:8787/');
if(!['127.0.0.1','localhost','[::1]'].includes(root.hostname))throw Error('Local Worker required');
async function api(path,user,method='GET',body){return(await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:user.token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();}
async function user(){const credentials={email:'preview'+randomBytes(6).toString('hex')+'@example.com',password:randomBytes(12).toString('hex')};assert.equal((await api('register',null,'POST',credentials)).code,200);const login=await api('login',null,'POST',credentials),u={...credentials,token:login.data.token};const profile=await api('my/loginUserInfo',u);u.account=profile.data.account.accountId;u.username='preview'+randomBytes(5).toString('hex');assert.equal((await api('my/username',u,'PUT',{username:u.username})).code,200);return u;}
await test('previews require the exact visible link, active mailbox ownership and joined group membership; cached metadata never bypasses access',{timeout:60000},async()=>{
 const a=await user(),b=await user(),c=await user(),url='https://localhost/preview';
 const friend=await api('chat/friends',a,'POST',{email:b.email});assert.equal((await api('chat/friends/'+friend.data.id,b,'PUT',{accept:true})).code,200);
 const send=async(text,extra={})=>{const result=await api('mail-chat/instant',a,'POST',{accountId:a.account,clientId:randomUUID(),recipients:[b.email],subject:'Preview fixture',text,...extra});assert.equal(result.code,200);return result.data;};
 const original=await send(url),source={emailId:original.emailId,url};
 assert.equal((await api('mail-chat/link-preview',null,'POST',source)).code,401);
 assert.equal((await api('mail-chat/link-preview',c,'POST',source)).code,404);
 assert.equal((await api('mail-chat/link-preview',a,'POST',{...source,url:'https://example.org/not-in-message'})).code,403);
 assert.equal((await api('mail-chat/link-preview',a,'POST',{...source,url:'javascript:alert(1)'})).code,400);
 const own=await api('mail-chat/link-preview',a,'POST',source);assert.equal(own.code,200);assert.equal(own.data.title,'localhost');assert.equal(own.data.hasImage,false);assert(!('imageSource'in own.data));
 const image=await fetch(new URL('api/mail-chat/link-preview-image',root),{method:'POST',headers:{Authorization:a.token,'Content-Type':'application/json'},body:JSON.stringify(source)});assert.equal(image.status,404);
 const reply=await send('Own reply',{replyId:original.emailId,quote:true});assert.equal((await api('mail-chat/link-preview',a,'POST',{emailId:reply.emailId,url})).code,403);
 assert.equal((await api('mail-chat/delete',a,'POST',{accountId:a.account,key:reply.conversationKey,through:reply.emailId,emailId:original.emailId})).code,200);
 assert.equal((await api('mail-chat/link-preview',a,'POST',source)).code,404);
 const group=(await api('chat/rooms',a,'POST',{kind:'group',name:'Private preview'})).data,base='chat/rooms/'+group.id;
 const message=(await api(base+'/messages',a,'POST',{body:url,clientId:randomUUID()})).data,groupSource={roomId:group.id,messageId:message.id,url};
 assert.equal((await api('mail-chat/link-preview',c,'POST',groupSource)).code,403);
 await api(base+'/members',a,'POST',{username:b.username});assert.equal((await api('mail-chat/link-preview',b,'POST',groupSource)).code,403);
 await api(base+'/membership',b,'PUT',{accept:true});assert.equal((await api('mail-chat/link-preview',b,'POST',groupSource)).code,200);
 await api(base+'/membership',b,'DELETE');assert.equal((await api('mail-chat/link-preview',b,'POST',groupSource)).code,403);
});
