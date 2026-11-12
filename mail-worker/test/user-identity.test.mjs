import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {identityUsername} from '../../shared/user-identity.mjs';import {identityRegistrationStatements} from '../src/lib/identity-registration.mjs';
test('new handles normalize case, reserve service names and keep nicknames out of identity',()=>{
 assert.deepEqual(identityUsername(' @Alice_123 '),{name:'alice_123',error:null});
 for(const value of ['',null,{},'abc','1234','john.doe','名字','a'.repeat(25),'alice✅'])assert.equal(identityUsername(value).error,'identityUsernameRules');
 for(const value of ['ADMIN','@support','official','postmaster'])assert.equal(identityUsername(value).error,'identityUsernameReserved');
});
test('the exact registration batch rolls back users and handles on mailbox or handle conflict',()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE user(user_id INTEGER PRIMARY KEY,email TEXT,reg_key_id INTEGER,password TEXT,salt TEXT,type INTEGER);
 CREATE TABLE mail_user_handle(user_id INTEGER PRIMARY KEY REFERENCES user(user_id),username TEXT COLLATE NOCASE UNIQUE);
 CREATE TABLE account(user_id INTEGER,email TEXT COLLATE NOCASE UNIQUE,name TEXT);
 CREATE TABLE mail_user_profile(user_id INTEGER PRIMARY KEY,display_name TEXT);
 `);
 const adapter={prepare(text){return {bind(...values){return ()=>sql.prepare(text).run(...values);}}}};
 const add=(username,email)=>{
  const statements=identityRegistrationStatements(adapter,{email,username,nickname:'Same nickname',password:'hash',salt:'salt',type:1,regKeyId:0});
  sql.exec('BEGIN');try{for(const run of statements)run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
 };
 add('alice','alice@example.com');
 assert.throws(()=>add('ALICE','second@example.com'),/UNIQUE/);
 assert.throws(()=>add('other','ALICE@example.com'),/UNIQUE/);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM user').get().n,1);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM mail_user_handle').get().n,1);
 add('second','second@example.com');assert.equal(sql.prepare('SELECT count(*) AS n FROM mail_user_profile WHERE display_name=?').get('Same nickname').n,2);
 sql.close();
});
