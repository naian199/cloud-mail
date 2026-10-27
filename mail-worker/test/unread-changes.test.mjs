import test from 'node:test';
import assert from 'node:assert/strict';
import {afterUnreadChange,UNREAD_CHANGED} from '../../mail-vue/src/utils/unread-changes.mjs';

test('only successful reads trigger local and cross-tab reconciliation; storage failures do not fail a read',async()=>{
 const events=[],writes=[];globalThis.window=new EventTarget();globalThis.localStorage={setItem:(key,value)=>writes.push([key,value])};
 window.addEventListener(UNREAD_CHANGED,()=>events.push('refresh'));
 let complete;const pending=afterUnreadChange(new Promise(resolve=>complete=resolve));assert.equal(events.length,0);
 complete('read');assert.equal(await pending,'read');assert.equal(events.length,1);assert.equal(writes[0][0],UNREAD_CHANGED);
 await assert.rejects(afterUnreadChange(Promise.reject(Error('Read failed'))));assert.equal(events.length,1);assert.equal(writes.length,1);
 localStorage.setItem=()=>{throw Error('Storage disabled');};assert.equal(await afterUnreadChange(Promise.resolve('ok')),'ok');assert.equal(events.length,2);
 delete globalThis.window;delete globalThis.localStorage;
});
