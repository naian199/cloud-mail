import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import dayjs from 'dayjs';
import verifyRecord from '../src/entity/verify-record.js';
test('the first registration returns its actual counter row and reaches the verification threshold',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE verify_record(vr_id INTEGER PRIMARY KEY,ip TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 1,type INTEGER NOT NULL DEFAULT 0,update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
 const client={prepare(query){return {bind(...params){return {
  async all(){return {results:db.prepare(query).all(...params)};},
  async raw(){return db.prepare(query).all(...params).map(row=>Object.values(row));},
  async run(){db.prepare(query).run(...params);return {success:true,results:[]};}
 };}};}};
 const source=readFileSync(new URL('../src/service/verify-record-service.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export default verifyRecordService;','verifyRecordService;');
 const service=vm.runInNewContext(source,{orm:()=>drizzle(client),verifyRecord,eq,and,sql,dayjs,reqUtils:{getIp:c=>c.ip},verifyRecordType:{REG:0,ADD:1}});
 try{
  const c={ip:'192.0.2.10'};
  assert.equal(await service.isOpenRegVerify(c,1),false);
  assert.equal((await service.increaseRegCount(c)).count,1);
  assert.equal(await service.isOpenRegVerify(c,1),true);
  assert.equal((await service.increaseRegCount(c)).count,2);
  assert.equal(await service.isOpenRegVerify(c,3),false);
  assert.equal((await service.increaseRegCount(c)).count,3);
  assert.equal(await service.isOpenRegVerify(c,3),true);
  assert.equal(await service.isOpenRegVerify({ip:'192.0.2.11'},1),false);
 }finally{db.close();}
});
