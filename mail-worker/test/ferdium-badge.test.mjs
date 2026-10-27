import test from 'node:test';
import assert from 'node:assert/strict';
import {createFerdiumBadgeSync} from '../../mail-vue/src/utils/ferdium-badge.mjs';

test('Ferdium service badge receives total unread, deduplicates updates and clears after reads/logout',()=>{
 let count=3;const calls=[],host={ferdium:{setBadge(direct,indirect){assert.equal(this,host.ferdium);calls.push([direct,indirect]);}}};
 const badge=createFerdiumBadgeSync(()=>count,host);
 assert.equal(badge.sync(),true);badge.sync();assert.deepEqual(calls,[[3,0]]);
 count=135;badge.sync();assert.deepEqual(calls.at(-1),[135,0]);
 count=0;badge.sync();assert.deepEqual(calls.at(-1),[0,0]);
 count=2;badge.sync();badge.clear();assert.deepEqual(calls.at(-1),[0,0]);
});
test('normal browsers, delayed/replaced bridges and bridge failures preserve the web experience',()=>{
 const host={},calls=[];let count=4;const badge=createFerdiumBadgeSync(()=>count,host);
 assert.equal(badge.sync(),false);
 host.ferdium={setBadge(){throw Error('Bridge temporarily unavailable');}};assert.equal(badge.sync(),false);
 host.ferdium={setBadge:(...args)=>calls.push(args)};assert.equal(badge.sync(),true);assert.deepEqual(calls,[[4,0]]);
 badge.sync(true);assert.equal(calls.length,2);
 host.ferdium={setBadge:(...args)=>calls.push(args)};badge.sync();assert.equal(calls.length,3);
 count=NaN;badge.sync();assert.deepEqual(calls.at(-1),[0,0]);
});
