let database;
export function notificationDB(){
 if(!database)database=new Promise((resolve,reject)=>{const r=indexedDB.open('cloud-mail-notifications-v1',1);r.onupgradeneeded=()=>{for(const name of ['state','seen'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return database;
}
export async function notificationState(key,value){const db=await notificationDB();const plain=value&&typeof value==='object'?JSON.parse(JSON.stringify(value)):value;return new Promise((resolve,reject)=>{const tx=db.transaction('state',value===undefined?'readonly':'readwrite'),store=tx.objectStore('state');let result;
 if(key==='preferences'&&plain){const r=store.get(key);r.onsuccess=()=>{if(!r.result||(plain.revision||0)>=(r.result.revision||0))store.put(plain,key);result=plain;};}
 else {const r=value===undefined?store.get(key):store.put(plain,key);r.onsuccess=()=>{result=r.result;};}
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}

export async function claimNotification(id){const db=await notificationDB();return new Promise((resolve,reject)=>{const tx=db.transaction('seen','readwrite'),s=tx.objectStore('seen'),r=s.get(id);let claimed=false;r.onsuccess=()=>{if(!r.result||Date.now()-r.result>86400000){claimed=true;s.put(Date.now(),id);}};tx.oncomplete=()=>resolve(claimed);tx.onerror=()=>reject(tx.error);});}
export async function pruneNotifications(){const db=await notificationDB();return new Promise(resolve=>{const tx=db.transaction('seen','readwrite'),r=tx.objectStore('seen').openCursor();r.onsuccess=()=>{const cursor=r.result;if(cursor){if(Date.now()-cursor.value>86400000)cursor.delete();cursor.continue();}};tx.oncomplete=tx.onerror=()=>resolve();});}
export async function releaseNotification(id){const db=await notificationDB();return new Promise(resolve=>{const tx=db.transaction('seen','readwrite');tx.objectStore('seen').delete(id);tx.oncomplete=tx.onerror=()=>resolve();});}

// Atomically reject another account or an older delayed push before changing the app icon.
export async function acceptAppBadge(userId,badge){
 if(!Number.isSafeInteger(userId)||!Number.isSafeInteger(badge?.count)||badge.count<0||!Number.isSafeInteger(badge?.updatedAt)||badge.updatedAt<1||badge.updatedAt>Date.now()+60000)return null;
 const db=await notificationDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),identity=store.get('user');let accepted=null;
  identity.onsuccess=()=>{if(identity.result!==userId)return;const previous=store.get('badge');previous.onsuccess=()=>{
   if(previous.result?.userId===userId&&previous.result.updatedAt>badge.updatedAt)return;
   accepted={userId,count:badge.count,updatedAt:badge.updatedAt};store.put(accepted,'badge');
  };};tx.oncomplete=()=>resolve(accepted);tx.onerror=()=>reject(tx.error);
 });
}
