import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {mediaCacheKey,writeMediaCache,readMediaCache,clearMediaCache,cachedMediaBlob,MEDIA_CACHE_LIMITS} from '../../mail-vue/src/utils/media-cache.mjs';
const file={attId:20,filename:'private.mp4',mimeType:'video/mp4',size:100};
const key=mediaCacheKey(1,10,file);
test('private cache identities isolate users, mailboxes and immutable attachment metadata',()=>{
 for(const other of [mediaCacheKey(2,10,file),mediaCacheKey(1,11,file),mediaCacheKey(1,10,{...file,attId:21}),mediaCacheKey(1,10,{...file,size:101})])assert.notEqual(key,other);
 assert.equal(mediaCacheKey(undefined,10,file),'');assert.equal(mediaCacheKey(1,10,{}),'');
});
test('cached media and covers survive component lifetimes but expire and clear explicitly',async()=>{
 await clearMediaCache();const blob=new Blob(['video']);await writeMediaCache(key,'original',blob);
 assert.equal(await (await readMediaCache(key,'original')).blob.text(),'video');assert.equal(await readMediaCache(mediaCacheKey(2,10,file),'original'),null);
 const now=Date.now;Date.now=()=>now()+MEDIA_CACHE_LIMITS.age+1;
 try{assert.equal(await readMediaCache(key,'original'),null);}finally{Date.now=now;}
 await writeMediaCache(key,'poster',new Blob(['cover']),{width:20,height:10});await clearMediaCache();assert.equal(await readMediaCache(key,'poster'),null);
});
test('duplicate consumers share one download and one cancellation does not abort other readers',async()=>{
 await clearMediaCache();let calls=0,release,signal;
 const load=options=>{calls++;signal=options.signal;return new Promise(resolve=>release=resolve);};
 const a=new AbortController(),b=new AbortController();const first=cachedMediaBlob(key,load,{signal:a.signal}),second=cachedMediaBlob(key,load,{signal:b.signal});
 const cancelled=assert.rejects(first,{name:'AbortError'});await setImmediate();assert.equal(calls,1);a.abort();await cancelled;assert.equal(signal.aborted,false);release(new Blob(['shared']));assert.equal(await (await second).text(),'shared');
 assert.equal(await (await cachedMediaBlob(key,()=>{throw Error('Must use cache');})).text(),'shared');
});
test('logout aborts in-flight reads and cannot repopulate the cache with a late response',async()=>{
 await clearMediaCache();let release;const request=cachedMediaBlob(key,()=>new Promise(resolve=>release=resolve));const cancelled=assert.rejects(request,{name:'AbortError'});
 await setImmediate();await clearMediaCache();release(new Blob(['late private bytes']));await cancelled;assert.equal(await readMediaCache(key,'original'),null);
});
