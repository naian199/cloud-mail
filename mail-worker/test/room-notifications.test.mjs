import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatNotifications } from '../src/chat/notifications.js';

test('room invalidations persist, deduplicate and fan out in batches below the Free plan budget',async()=>{
 const original=globalThis.WebSocketRequestResponsePair;
 globalThis.WebSocketRequestResponsePair=class {};
 try {
  const values=new Map(),alarms=[],delivered=[];
  const txn={get:async key=>values.get(key),put:async(key,value)=>values.set(key,value),delete:async key=>values.delete(key),setAlarm:async value=>alarms.push(value)};
  let sequence=Promise.resolve();
  const storage={transaction:fn=>{const result=sequence.then(()=>fn(txn));sequence=result.catch(()=>{});return result;}};
  const env={CHAT_NOTIFICATIONS:{idFromName:id=>id,get:id=>({fetch:async(url,options)=>{assert.equal(url,'https://chat.internal/notify');assert.equal(options.body,undefined);delivered.push(id);return new Response(null,{status:204});}})}};
  const object=new ChatNotifications({storage,setWebSocketAutoResponse(){}},env);
  const enqueue=users=>object.fetch(new Request('https://chat.internal/rooms/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({users})}));
  await Promise.all([enqueue(Array.from({length:60},(_,i)=>i+1)),enqueue(Array.from({length:60},(_,i)=>i+41))]);
  assert.equal(values.get('room-notify-users').length,100);
  await object.alarm();assert.equal(delivered.length,40);
  await object.alarm();assert.equal(delivered.length,80);
  await object.alarm();assert.equal(delivered.length,100);
  assert.equal(new Set(delivered).size,100);assert.equal(values.has('room-notify-users'),false);assert(alarms.length>=3);
  assert.equal((await enqueue([0])).status,400);
  assert.equal((await enqueue(Array(102).fill(1))).status,400);
 }finally{globalThis.WebSocketRequestResponsePair=original;}
});
