import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {DatabaseSync} from 'node:sqlite';
test('official grants require a fresh active administrator or explicit permission, and revocations retain audit history',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`
 CREATE TABLE user(user_id INTEGER PRIMARY KEY,email TEXT,status INTEGER DEFAULT 0,is_del INTEGER DEFAULT 0);
 INSERT INTO user(user_id,email) VALUES(1,'admin@example.com'),(2,'member@example.com'),(3,'delegate@example.com');
 CREATE TABLE mail_official_identity(user_id INTEGER PRIMARY KEY,active INTEGER,subject TEXT,description TEXT,actor_id INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE mail_official_audit(id INTEGER PRIMARY KEY,user_id INTEGER,active INTEGER,subject TEXT,description TEXT,actor_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE email(user_id INTEGER,send_email TEXT);CREATE TABLE account(user_id INTEGER,email TEXT);CREATE TABLE chat_friendship(low_user_id INTEGER,high_user_id INTEGER);CREATE TABLE mail_room_member(room_id TEXT,user_id INTEGER);
 `);
 const client={prepare(sql){return {bind(...params){return {first:async()=>db.prepare(sql).get(...params)||null,all:async()=>({results:db.prepare(sql).all(...params)}),run:async()=>db.prepare(sql).run(...params)};}};},async batch(statements){db.exec('BEGIN');try{for(const statement of statements)await statement.run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
 class BizError extends Error{constructor(message,code){super(message);this.code=code;}}
 const source=readFileSync(new URL('../src/service/official-service.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export const officialFields','const officialFields').replace('export default {','const service={')+'\nservice;';
 const service=vm.runInNewContext(source,{BizError,userContext:{getUserId:c=>c.userId},permService:{userPermKeys:async c=>c.permissions||[]},notifyMail:async()=>{},notifyRoomUsers:async()=>{},Promise,Number,Set,Array});
 const ctx=(userId,permissions=[])=>({userId,permissions,env:{db:client,admin:'admin@example.com'},executionCtx:{waitUntil(){}}});
 const data={userId:2,active:true,subject:'Support',description:'Site support account'};
 try{
  await assert.rejects(service.save(ctx(2),data),e=>e.code===403);
  await assert.rejects(service.history(ctx(2),{userId:2}),e=>e.code===403);
  assert.equal((await service.save(ctx(1),data)).officialVerified,true);
  assert.equal(db.prepare('SELECT actor_id FROM mail_official_identity').get().actor_id,1);
  await assert.rejects(service.save(ctx(2),{userId:2,active:false}),e=>e.code===403);
  db.exec('UPDATE user SET status=1 WHERE user_id=2');
  await service.save(ctx(3,['user:verify']),{userId:2,active:false});
  assert.equal(db.prepare('SELECT active FROM mail_official_identity').get().active,0);
  const history=await service.history(ctx(1),{userId:2});assert.deepEqual(Array.from(history,r=>r.active),[0,1]);
  await assert.rejects(service.save(ctx(1),{...data,active:'true'}),e=>e.code===400);
  db.exec('UPDATE user SET status=1 WHERE user_id=1');await assert.rejects(service.save(ctx(1),data),e=>e.code===403);
 }finally{db.close();}
});
