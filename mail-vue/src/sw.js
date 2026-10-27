import {updateAppBadge} from './utils/app-badge.mjs';
import {acceptAppBadge,notificationState,claimNotification,pruneNotifications,releaseNotification} from './utils/notification-store.mjs';
const assets=self.__WB_MANIFEST;
const CACHE='cloud-mail-install-icons-v2';
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(assets.map(item=>item.url).filter(url=>/mail-(?:pwa\.png|app\.svg)$/.test(url)));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE&&(key.startsWith('workbox-precache')||key.startsWith('cloud-mail-install-icons')))await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method==='GET'&&url.origin===self.location.origin&&['/mail-pwa.png','/mail-app.svg'].includes(url.pathname))event.respondWith(fetch(event.request).catch(async()=>{const cached=await caches.match(event.request);return cached||Response.error();}));});
function ask(client,message){return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},500);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.handled===true);};client.postMessage({...message,deadline:Date.now()+400},[channel.port2]);});}
async function notify(message,localOnly=false){
 if(!message||typeof message.id!=='string'||typeof message.context!=='string'||!Number.isSafeInteger(message.userId)||message.created<Date.now()-86400000)return;
 if(await notificationState('user')!==message.userId)return;
 if(!localOnly&&!await notificationState('pushEnabled'))return;
 await applyBadge(message.userId,message.badge);
 const preferences=await notificationState('preferences');
 if(preferences&&(preferences.revision||0)>=(message.preferenceRevision||0)){if(!preferences.enabled||preferences.muted?.[message.context]||preferences[message.kind]===false)return;const generic=/^zh/.test(preferences.locale)?'收到新消息':'New message';if(preferences.preview==='none'){message={...message,title:'Cloud Mail',body:generic,icon:'/mail-pwa.png'};}else if(preferences.preview==='sender')message={...message,body:generic};}
 const url=new URL(message.url,self.location.origin);if(url.origin!==self.location.origin||!['/mail-chat','/external-mail','/rooms'].includes(url.pathname))return;
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const active=clients.find(client=>client.focused&&client.visibilityState==='visible');
 if(localOnly&&!active)return;
 if(!await claimNotification(`${message.userId}:${message.id}`))return;
 if(active&&await ask(active,{type:'CLOUD_MAIL_NOTIFICATION',message}))return;
 if(localOnly){await releaseNotification(`${message.userId}:${message.id}`);return;}
 if(await notificationState('user')!==message.userId)return;
 await self.registration.showNotification(message.title,{body:message.body,icon:message.icon||'/mail-pwa.png',badge:'/mail-pwa.png',tag:message.tag,renotify:false,data:{url:url.pathname+url.search,userId:message.userId,id:message.id}});
}
async function applyBadge(userId,badge){const accepted=await acceptAppBadge(userId,badge);if(accepted&&await notificationState('user')===userId)await updateAppBadge(accepted.count);}
let notificationQueue=Promise.resolve();
function queueBadge(userId,badge){const job=notificationQueue.then(()=>applyBadge(userId,badge));notificationQueue=job.catch(()=>{});return job;}

function queueNotify(message,localOnly=false){const job=notificationQueue.then(()=>notify(message,localOnly));notificationQueue=job.catch(()=>{});return job;}
self.addEventListener('push',event=>{let message;try{message=event.data?.json();}catch{return;}event.waitUntil(queueNotify(message).catch(()=>{}));});
self.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='CLOUD_MAIL_IDENTITY')event.waitUntil((async()=>{if(await notificationState('user')!==(Number.isSafeInteger(data.userId)?data.userId:null)){event.ports[0]?.postMessage({ok:false});return;}const badge=await notificationState('badge');if(!badge||badge.userId!==data.userId)await updateAppBadge(0);if(!data.userId){for(const notice of await self.registration.getNotifications())notice.close();}event.ports[0]?.postMessage({ok:true});await pruneNotifications();})());
 if(data.type==='CLOUD_MAIL_BADGE')event.waitUntil(queueBadge(data.userId,data.badge).catch(()=>{}));
 if(data.type==='CLOUD_MAIL_LOCAL_NOTIFICATIONS')event.waitUntil(Promise.all((Array.isArray(data.messages)?data.messages:[]).slice(0,5).map(message=>queueNotify(message,true))).catch(()=>{}));
 if(data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const data=event.notification.data;if(!data||await notificationState('user')!==data.userId)return;const url=new URL(data.url,self.location.origin);if(url.origin!==self.location.origin||!['/mail-chat','/external-mail','/rooms'].includes(url.pathname))return;const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=clients.find(client=>new URL(client.url).origin===url.origin);if(client){await client.navigate(url.href);await client.focus();}else await self.clients.openWindow(url.href);})());});
