// Best effort: browsers without the Badging API keep the existing tab and notification UI.
let pending=Promise.resolve();
export function updateAppBadge(count,target=globalThis.navigator){
 pending=pending.catch(()=>{}).then(async()=>{
  try{
   if(count>0&&typeof target?.setAppBadge==='function')await target.setAppBadge(count);
   else if(count===0&&typeof target?.clearAppBadge==='function')await target.clearAppBadge();
  }catch{/* Permission, installation and launcher support are controlled by the platform. */}
 });
 return pending;
}
