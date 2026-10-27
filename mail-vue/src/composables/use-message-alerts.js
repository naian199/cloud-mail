import {setTabUnread} from './use-tab-badge';
import {onMounted,onBeforeUnmount} from 'vue';
import {ElNotification} from 'element-plus';
import {useRouter} from 'vue-router';
import {useUserStore} from '@/store/user';
import {useMailSync} from './use-mail-sync';
import {applyPushPreferences,loadPushSettings,pollPush,setPushIdentity,pushRegistration} from './use-push-notifications';
import {claimNotification} from '@/utils/notification-store.mjs';
export function useMessageAlerts(){
 const router=useRouter(),user=useUserStore();let cursor,busy=false,stopped=false,pending=false;const notices=new Set();
 const activeContext=()=>document.querySelector('[data-notification-context]')?.dataset.notificationContext||'';
 function show(message){
  if(message.userId!==user.user.userId||document.hidden||!document.hasFocus())return false;
  if(localStorage.getItem('mail-alerts')==='off'||activeContext()===message.context)return true;
  const toast=ElNotification({title:message.title,message:message.body,duration:6000,onClick:()=>{router.push(message.url);toast.close();},onClose:()=>notices.delete(toast)});notices.add(toast);return true;
 }
 async function refresh(){
  if(stopped)return;if(busy){pending=true;return;}
  busy=true;try{const data=await pollPush(cursor);if(stopped)return;cursor=data.cursor;setTabUnread(data.unread);await applyPushPreferences(data.preferences,user.user.userId);
   if(document.hidden||!document.hasFocus())return;
   const registration=await pushRegistration();
   if(registration?.active){registration.active.postMessage({type:'CLOUD_MAIL_LOCAL_NOTIFICATIONS',messages:data.messages});}
   else for(const message of data.messages){let claimed=false;try{claimed=await claimNotification(`${message.userId}:${message.id}`);}catch{const key=`cloud-mail:notice:${message.userId}:${message.id}`;claimed=!localStorage.getItem(key);if(claimed)localStorage.setItem(key,String(Date.now()));}if(claimed)show(message);}
  }catch{}finally{busy=false;if(pending){pending=false;refresh();}}
 }
 function receive(event){if(stopped){event.ports[0]?.postMessage({handled:false});return;}if(event.data?.type==='CLOUD_MAIL_NOTIFICATION'){if(event.data.deadline&&Date.now()>event.data.deadline){event.ports[0]?.postMessage({handled:false});return;}const handled=show(event.data.message);event.ports[0]?.postMessage({handled});}}
 async function identity(){if(stopped)return;await setPushIdentity(user.user.userId);}
 function storage(event){if(event.key==='token'&&event.newValue!==event.oldValue){stopped=true;setTabUnread(0);for(const notice of notices)notice.close();setPushIdentity(null,user.user.userId);}}
 onMounted(()=>{window.addEventListener('storage',storage);navigator.serviceWorker?.addEventListener('message',receive);navigator.serviceWorker?.addEventListener('controllerchange',identity);identity();loadPushSettings().catch(()=>{});window.addEventListener('focus',refresh);refresh();});
 onBeforeUnmount(()=>{stopped=true;setTabUnread(0);window.removeEventListener('storage',storage);navigator.serviceWorker?.removeEventListener('message',receive);navigator.serviceWorker?.removeEventListener('controllerchange',identity);window.removeEventListener('focus',refresh);setPushIdentity(null,user.user.userId);for(const notice of notices)notice.close();});
 useMailSync(refresh,{background:true});
}
