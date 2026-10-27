import {watch,onMounted,onBeforeUnmount} from 'vue';
import {createFerdiumBadgeSync} from '@/utils/ferdium-badge.mjs';

export function useFerdiumBadge(unread){
 const bridge=createFerdiumBadgeSync(()=>unread.value);
 const sync=()=>bridge.sync(),resume=()=>bridge.sync(true);
 const stop=watch(unread,sync,{immediate:true});let retry;
 onMounted(()=>{
  // Retry an injected/replaced bridge even when the unread number has not changed.
  retry=setInterval(sync,5000);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
 });
 onBeforeUnmount(()=>{stop();clearInterval(retry);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);bridge.clear();});
}
