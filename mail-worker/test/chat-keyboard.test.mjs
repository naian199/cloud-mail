import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendOnEnter } from '../../mail-vue/src/utils/chat-keyboard.mjs';
const enter = { key:'Enter', keyCode:13, shiftKey:false, ctrlKey:false, metaKey:false, isComposing:false };
test('touch Enter creates a line break unless the user explicitly requests sending',()=>{
 assert.equal(shouldSendOnEnter(enter,true),false);
 assert.equal(shouldSendOnEnter({...enter,ctrlKey:true},true),true);
 assert.equal(shouldSendOnEnter({...enter,metaKey:true},true),true);
 assert.equal(shouldSendOnEnter({...enter,shiftKey:true,ctrlKey:true},true),false);
});
test('desktop Enter sends while multiline and IME composition stay untouched',()=>{
 assert.equal(shouldSendOnEnter(enter,false),true);
 for(const compact of [true,false]) {
  assert.equal(shouldSendOnEnter({...enter,isComposing:true},compact),false);
  assert.equal(shouldSendOnEnter({...enter,keyCode:229},compact),false);
  assert.equal(shouldSendOnEnter({...enter,shiftKey:true},compact),false);
  assert.equal(shouldSendOnEnter({...enter,key:'a'},compact),false);
 }
});
