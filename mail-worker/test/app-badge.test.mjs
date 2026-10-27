import test from 'node:test';
import assert from 'node:assert/strict';
import {updateAppBadge} from '../../mail-vue/src/utils/app-badge.mjs';

test('app icon badge updates are ordered, zero clears and unavailable APIs do not interrupt messaging',async()=>{
 const calls=[],device={setAppBadge:async count=>{await new Promise(r=>setTimeout(r,5));calls.push(count);},clearAppBadge:async()=>calls.push('clear')};
 await Promise.all([updateAppBadge(8,device),updateAppBadge(0,device)]);
 assert.deepEqual(calls,[8,'clear']);
 await updateAppBadge(2,{});await updateAppBadge(0,{});
 await updateAppBadge(2,{setAppBadge:async()=>{throw Error('Not installed');}});
 await updateAppBadge(3,device);assert.equal(calls.at(-1),3);
});
