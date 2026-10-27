import {ref,watch,onBeforeUnmount} from 'vue';

export const tabUnread=ref(0);
export function setTabUnread(value){tabUnread.value=Number.isSafeInteger(value)&&value>0?value:0;}

// Keep the site's original icon; only add a small dot while there are unread messages.
export function useTabBadge(){
 const icon=document.querySelector('link[rel="icon"]');
 if(!icon)return;
 const original={href:icon.getAttribute('href'),type:icon.getAttribute('type'),sizes:icon.getAttribute('sizes')};
 let version=0,image;
 const restore=()=>{for(const [key,value] of Object.entries(original))if(value===null)icon.removeAttribute(key);else icon.setAttribute(key,value);};
 const stop=watch(tabUnread,async count=>{
  const current=++version;
  if(!count){restore();return;}
  try{
   image||=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=original.href||'/mail-pwa.png';});
   const img=await image;if(current!==version)return;
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
   const context=canvas.getContext('2d');if(!context)return;
   context.drawImage(img,0,0,64,64);context.beginPath();context.arc(51,13,12,0,Math.PI*2);
   context.fillStyle='#f04452';context.fill();context.lineWidth=3;context.strokeStyle='#fff';context.stroke();
   icon.setAttribute('href',canvas.toDataURL('image/png'));icon.setAttribute('type','image/png');icon.setAttribute('sizes','64x64');
  }catch{/* Leave the original icon if this browser cannot render a dynamic favicon. */}
 },{immediate:true});
 onBeforeUnmount(()=>{version++;stop();restore();});
}
