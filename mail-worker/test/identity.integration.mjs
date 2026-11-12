import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
const root=new URL(process.env.MAIL_CHAT_TEST_URL||'http://127.0.0.1:8787/');if(!['localhost','127.0.0.1','[::1]'].includes(root.hostname))throw Error('Local Worker required');
const api=async(path,token,method='GET',body)=>(await fetch(new URL('api/'+path,root),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:body===undefined?undefined:JSON.stringify(body)})).json();
await test('registration reserves one permanent handle and one mailbox; normal users cannot grant official status',async()=>{
 const name='identity'+randomBytes(5).toString('hex'),password=randomBytes(12).toString('hex');
 const available=await api(`register/availability?username=${name}&domain=example.com`);assert.equal(available.data.available,true);
 const results=await Promise.all([api('register',null,'POST',{username:name.toUpperCase(),domain:'example.com',nickname:'Same display',password,officialVerified:true}),api('register',null,'POST',{username:name,domain:'example.com',password})]);
 assert.equal(results.filter(r=>r.code===200).length,1,JSON.stringify(results));assert.equal(results.filter(r=>r.code!==200).length,1);
 const login=await api('login',null,'POST',{email:name,password});assert.equal(login.code,200);const token=login.data.token;
 const info=(await api('my/loginUserInfo',token)).data;assert.equal(info.profile.username,name);assert.equal(info.email,name+'@example.com');assert.equal(info.profile.officialVerified,0);
 assert.equal((await api('login',null,'POST',{email:info.email,password})).code,200);
 assert.equal((await api('my/username',token,'PUT',{username:name+'new'})).code,409);
 assert.equal((await api('my/username',token,'PUT',{username:''})).code,400);
 assert.equal((await api('user/official',token,'PUT',{userId:info.userId,active:true,subject:'Fake',description:'Fake'})).code,403);
 assert.equal((await api('user/official/history?userId='+info.userId,token)).code,403);
 const save=await api('my/profile',token,'PUT',{displayName:'Same display',bio:'',avatar:'',officialVerified:true});assert.equal(save.code,200);assert.equal(save.data.officialVerified,0);
 assert.equal((await api(`register/availability?username=${name}&domain=example.com`)).data.available,false);
 assert.equal((await api('register',null,'POST',{username:'admin',domain:'example.com',password})).code,400);
});
