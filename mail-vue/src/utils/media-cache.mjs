// This private cache is only addressed from currently authorized message metadata.
// Tokens and public attachment URLs are never used as cache keys.
export const MEDIA_CACHE_LIMITS = Object.freeze({age:7*86400000,bytes:96*1024*1024,entries:120,memory:32*1024*1024,original:20*1024*1024,poster:512*1024});
const DB='cloud-mail-private-media-v1',STORE='entries';
const memory=new Map(),pending=new Map();
let generation=0,dbPromise;
const aborted=()=>new DOMException('Cancelled','AbortError');
export function mediaCacheKey(userId,accountId,file){
  const ids=[userId,accountId,file?.attId].map(Number);
  if(!ids.every(id=>Number.isSafeInteger(id)&&id>0))return '';
  return 'video:v1:'+JSON.stringify([...ids,String(file.filename||''),Number(file.size)||0,String(file.mimeType||'')]);
}
function validKey(key,kind){return typeof key==='string'&&key.startsWith('video:v1:')&&key.length<1024&&['poster','original'].includes(kind);}
function validEntry(entry,kind){return entry?.blob instanceof Blob&&entry.size===entry.blob.size&&entry.size>0&&entry.size<=MEDIA_CACHE_LIMITS[kind]&&Number.isFinite(entry.savedAt)&&(kind!=='poster'||(Number.isFinite(entry.metadata?.width)&&entry.metadata.width>0&&Number.isFinite(entry.metadata?.height)&&entry.metadata.height>0));}
const entryKey=(key,kind)=>`${kind}:${key}`;
function remember(entry){
  memory.delete(entry.key);memory.set(entry.key,entry);
  let size=[...memory.values()].reduce((n,e)=>n+e.size,0);
  for(const [key,old] of memory){if(size<=MEDIA_CACHE_LIMITS.memory&&memory.size<=40)break;memory.delete(key);size-=old.size;}
}
function database(){
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  if(!dbPromise)dbPromise=new Promise(resolve=>{
    let finished=false;const finish=value=>{if(finished){value?.close();return;}finished=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(null),1000);
    try{
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'key'});};
      request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();dbPromise=null;};finish(db);};
    }catch{finish(null);}
  });
  return dbPromise;
}
export function peekMediaCache(key,kind){
  if(!validKey(key,kind))return null;
  const entry=memory.get(entryKey(key,kind));
  if(!entry)return null;
  if(!validEntry(entry,kind)||Date.now()-entry.savedAt>MEDIA_CACHE_LIMITS.age){memory.delete(entry.key);return null;}
  remember({...entry,usedAt:Date.now()});return entry;
}
export async function readMediaCache(key,kind){
  if(!validKey(key,kind))return null;
  const hit=peekMediaCache(key,kind);if(hit)return hit;
  const mine=generation,db=await database();if(!db||mine!==generation)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.get(entryKey(key,kind));
      request.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);
      request.onsuccess=()=>{
        const entry=request.result;
        if(mine!==generation){resolve(null);return;}
        if(!entry){resolve(null);return;}
        if(!validEntry(entry,kind)||Date.now()-entry.savedAt>MEDIA_CACHE_LIMITS.age){store.delete(entry.key);resolve(null);return;}
        entry.usedAt=Date.now();store.put(entry);remember(entry);resolve(entry);
      };
    }catch{resolve(null);}
  });
}
export async function writeMediaCache(key,kind,blob,metadata={}){
  if(!validKey(key,kind)||!(blob instanceof Blob)||!blob.size||blob.size>MEDIA_CACHE_LIMITS[kind])return false;
  const mine=generation,now=Date.now(),entry={key:entryKey(key,kind),blob,metadata,size:blob.size,savedAt:now,usedAt:now};
  remember(entry);
  const db=await database();if(!db||mine!==generation)return false;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),all=store.getAll();
      tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);tx.onerror=()=>resolve(false);
      all.onsuccess=()=>{
        if(mine!==generation){tx.abort();return;}
        let bytes=entry.size,count=1;
        const kept=[];
        for(const old of all.result){
          if(old.key===entry.key)continue;
          if(now-old.savedAt>MEDIA_CACHE_LIMITS.age){store.delete(old.key);memory.delete(old.key);continue;}
          old.usedAt=Math.max(old.usedAt,memory.get(old.key)?.usedAt||0);
          kept.push(old);bytes+=old.size;count++;
        }
        kept.sort((a,b)=>a.usedAt-b.usedAt);
        for(const old of kept){if(bytes<=MEDIA_CACHE_LIMITS.bytes&&count<=MEDIA_CACHE_LIMITS.entries)break;store.delete(old.key);memory.delete(old.key);bytes-=old.size;count--;}
        store.put(entry);
      };
    }catch{resolve(false);}
  });
}
export async function clearMediaCache(){
  generation++;memory.clear();for(const task of pending.values())task.controller.abort();pending.clear();
  const db=await database();if(!db)return;
  return new Promise(resolve=>{try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=tx.onabort=tx.onerror=()=>resolve();}catch{resolve();}});
}
function subscribe(task,signal){
  task.readers++;
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;signal?.removeEventListener('abort',cancel);task.readers--;if(!task.readers&&!task.settled)task.controller.abort();fn(value);};
    const cancel=()=>finish(reject,aborted());
    signal?.addEventListener('abort',cancel,{once:true});
    task.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
    if(signal?.aborted)cancel();
  });
}
export async function cachedMediaBlob(key,load,{signal}={}){
  const requestedGeneration=generation;
  if(signal?.aborted)throw aborted();
  if(!key)return load({signal});
  const entry=await readMediaCache(key,'original');
  if(signal?.aborted||requestedGeneration!==generation)throw aborted();
  if(entry)return entry.blob;
  let task=pending.get(key);
  if(task?.controller.signal.aborted){pending.delete(key);task=null;}
  if(!task){
    task={controller:new AbortController(),readers:0,settled:false};const mine=generation;
    const timer=setTimeout(()=>task.controller.abort(),45000);
    task.promise=Promise.resolve().then(()=>load({signal:task.controller.signal})).then(blob=>{
      if(task.controller.signal.aborted||mine!==generation)throw aborted();
      if(!(blob instanceof Blob)||blob.size>50*1024*1024)throw Error('videoLoadFailed');
      void writeMediaCache(key,'original',blob);return blob;
    }).finally(()=>{task.settled=true;clearTimeout(timer);if(pending.get(key)===task)pending.delete(key);});
    pending.set(key,task);
  }
  return subscribe(task,signal);
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key==='token'&&event.newValue!==event.oldValue)void clearMediaCache();});
