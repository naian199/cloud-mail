import {computed,ref,shallowRef} from 'vue';
import {installPlatform,standaloneApp,promptAppInstall} from '@/utils/app-install.mjs';
const DISMISSED='cloud-mail:install-dismissed-until';
const platform=ref('desktop'),installed=ref(false),deferred=shallowRef(null),guide=ref(false),busy=ref(false),dismissed=ref(0),ready=ref(false),keyboard=ref(false);
let initialized=false;
function postpone(days=7){dismissed.value=Date.now()+days*86400000;try{localStorage.setItem(DISMISSED,String(dismissed.value));}catch{}}
export function initAppInstall(){
  if(initialized)return;initialized=true;platform.value=installPlatform(navigator);
  try{dismissed.value=Number(localStorage.getItem(DISMISSED))||0;}catch{}
  const display=window.matchMedia('(display-mode: standalone)');
  const sync=()=>{installed.value=standaloneApp(window,navigator);if(installed.value){deferred.value=null;guide.value=false;postpone(90);}};
  sync();display.addEventListener?.('change',sync);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred.value=event;});
  window.addEventListener('appinstalled',()=>{installed.value=true;deferred.value=null;guide.value=false;postpone(90);});
  const viewport=()=>{keyboard.value=!!document.activeElement?.matches('input,textarea,[contenteditable=true]')||(!!window.visualViewport&&innerHeight-window.visualViewport.height>120);};
  window.visualViewport?.addEventListener('resize',viewport);document.addEventListener('focusin',viewport);document.addEventListener('focusout',()=>queueMicrotask(viewport));viewport();
  setTimeout(()=>{ready.value=true;},4500);
}
async function install(){
  if(installed.value||busy.value)return;
  const event=deferred.value;
  if(!event){postpone();guide.value=true;return;}
  busy.value=true;deferred.value=null;
  try{const result=await promptAppInstall(event);postpone(result==='accepted'?90:7);}
  catch{guide.value=true;}
  finally{busy.value=false;}
}
export function useAppInstall(){return {platform,installed,guide,busy,install,dismiss:()=>postpone(),canPrompt:computed(()=>!!deferred.value),showCard:computed(()=>ready.value&&!installed.value&&!keyboard.value&&!guide.value&&Date.now()>dismissed.value&&(!!deferred.value||platform.value==='ios'))};}
