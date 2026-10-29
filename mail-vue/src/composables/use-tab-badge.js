import {ref,watch,onBeforeUnmount} from 'vue';

export const tabUnread=ref(0);
export function setTabUnread(value){tabUnread.value=Number.isSafeInteger(value)&&value>0?value:0;}

// Replace the icon node as well as its URL: Chromium/Electron can retain a previous favicon.
export function useTabBadge(){
 let icon=document.querySelector('link[rel="icon"]');
 if(!icon)return;
 const original={href:icon.getAttribute('href'),type:icon.getAttribute('type'),sizes:icon.getAttribute('sizes')};
 let version=0,image,badged=false,restored=false;
 function replace(attributes){
  const next=icon.cloneNode(false);
  for(const [key,value] of Object.entries(attributes))if(value===null)next.removeAttribute(key);else next.setAttribute(key,value);
  icon.replaceWith(next);icon=next;
 }
 function restore(){
  if(!badged&&restored)return;
  let href=original.href;
  try{const url=new URL(href,document.baseURI);if(['http:','https:'].includes(url.protocol)){url.searchParams.set('cloud-mail-icon',`${Date.now()}-${version}`);href=url.href;}}catch{}
  replace({...original,href});badged=false;restored=true;
 }
 const stop=watch(tabUnread,async count=>{
  const current=++version;
  if(!count){restore();return;}
  try{
   image||=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=original.href||'/mail-brand-192.png';});
   const img=await image;if(current!==version)return;
   const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
   const context=canvas.getContext('2d');if(!context)return;
   context.drawImage(img,0,0,64,64);context.beginPath();context.arc(51,13,12,0,Math.PI*2);
   context.fillStyle='#f04452';context.fill();context.lineWidth=3;context.strokeStyle='#fff';context.stroke();
   replace({href:canvas.toDataURL('image/png'),type:'image/png',sizes:'64x64'});badged=true;
  }catch{/* Leave the original icon if this browser cannot render a dynamic favicon. */}
 },{immediate:true});
 onBeforeUnmount(()=>{version++;stop();restore();});
}
