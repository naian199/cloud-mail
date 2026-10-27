import {acceptAppBadge} from '@/utils/notification-store.mjs';
import {updateAppBadge} from '@/utils/app-badge.mjs';

export async function syncAppBadge(userId,badge){
 try{
  const registration=await navigator.serviceWorker?.getRegistration('/');
  if(registration?.active){registration.active.postMessage({type:'CLOUD_MAIL_BADGE',userId,badge});return;}
  const accepted=await acceptAppBadge(userId,badge);if(accepted)await updateAppBadge(accepted.count);
 }catch{/* Tab badges and notifications remain available if app badging is unavailable. */}
}
