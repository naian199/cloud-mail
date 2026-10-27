import {ref} from 'vue';
import {notificationDefaults} from '../../../shared/notification-previews.mjs';
import {notificationState} from '@/utils/notification-store.mjs';
export const pushSettings=ref({...notificationDefaults}),pushActive=ref(false),pushBusy=ref(false);
export const pushPermission=ref('Notification'in window?Notification.permission:'unsupported');
const KEY='cloud-mail:push-device-enabled';
let identityVersion=0,settingsUser;
async function api(path,method='GET',body){const token=localStorage.getItem('token')||'';const response=await fetch(`${import.meta.env.VITE_BASE_URL}/my/push/${path}`,{method,signal:AbortSignal.timeout(10000),headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(token!==(localStorage.getItem('token')||''))throw Error('pushSessionChanged');if(data.code!==200)throw Error(data.message||'pushError');return data.data;}
const bytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export async function pushRegistration(){if(!('serviceWorker'in navigator))return null;return navigator.serviceWorker.getRegistration('/');}
export async function setPushIdentity(userId,expectedUser){const version=++identityVersion;try{const next=Number.isSafeInteger(userId)?userId:null,old=await notificationState('user');if(version!==identityVersion||(expectedUser!==undefined&&old!==expectedUser))return;if(old!==next){await notificationState('preferences',null);if(version!==identityVersion)return;await notificationState('pushEnabled',false);}if(version!==identityVersion)return;await notificationState('user',next);const registration=await pushRegistration();if(version===identityVersion)registration?.active?.postMessage({type:'CLOUD_MAIL_IDENTITY',userId});}catch{}}

export async function applyPushPreferences(preferences,userId){if(userId!==undefined&&userId!==settingsUser){settingsUser=userId;pushSettings.value={...notificationDefaults};}if((preferences.revision||0)<(pushSettings.value.revision||0))return pushSettings.value;pushSettings.value=preferences;try{await notificationState('preferences',preferences);}catch{}return preferences;}
export async function loadPushSettings(){const data=await api('config');await setPushIdentity(data.userId);await applyPushPreferences(data.preferences,data.userId);const registration=await pushRegistration(),subscription=await registration?.pushManager.getSubscription();let id='';if(subscription){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint));id=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}const matchesKey=!subscription?.options?.applicationServerKey||btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')===data.publicKey;const active=!!subscription&&matchesKey&&data.devices.includes(id)&&localStorage.getItem(KEY)!=='off';await notificationState('pushEnabled',active);pushActive.value=active;return data;}
export async function savePushSettings(patch){const preferences=await api('preferences','PUT',patch);await applyPushPreferences(preferences);if('enabled'in patch)try{localStorage.setItem('mail-alerts',patch.enabled?'on':'off');}catch{}return pushSettings.value;}
export async function mutePush(context,muted){await applyPushPreferences(await api('mute','PUT',{context,muted}));}
export async function enablePush(locale){
 if(pushBusy.value)return;pushBusy.value=true;const token=localStorage.getItem('token');const check=()=>{if(token!==localStorage.getItem('token'))throw Error('pushSessionChanged');};
 try{
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('pushUnsupported');
  // Ask permission immediately within the user gesture (required by iOS).
  const permission=await Notification.requestPermission();pushPermission.value=permission;check();if(permission!=='granted')throw Error('pushDenied');
  const data=await loadPushSettings(),registration=await navigator.serviceWorker.ready;check();
  let subscription=await registration.pushManager.getSubscription();
  if(subscription&&(!pushActive.value||(subscription.options.applicationServerKey&&btoa(String.fromCharCode(...new Uint8Array(subscription.options.applicationServerKey))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')!==data.publicKey))){await subscription.unsubscribe();subscription=null;}
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(data.publicKey)});
  check();await api('subscription','POST',{subscription:subscription.toJSON()});await savePushSettings({enabled:true,locale});
  check();await notificationState('pushEnabled',true);pushActive.value=true;localStorage.setItem(KEY,'yes');localStorage.setItem('mail-alerts','on');
 }finally{pushBusy.value=false;}
}
export async function disablePush(){
 localStorage.setItem(KEY,'off');try{await notificationState('pushEnabled',false);}catch{}
 try{const registration=await pushRegistration(),subscription=await registration?.pushManager.getSubscription();if(subscription){try{await api('subscription','DELETE',{endpoint:subscription.endpoint});}finally{await subscription.unsubscribe();}}}
 finally{pushActive.value=false;}
}
export async function logoutPush(){await setPushIdentity(null);try{await disablePush();}catch{}}
export const pollPush=cursor=>api('poll'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
