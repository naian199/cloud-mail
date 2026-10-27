// Ferdium exposes this narrow bridge in the page world, including Custom Website services.
// https://github.com/ferdium/ferdium-app/blob/develop/src/webview/recipe.ts
export function createFerdiumBadgeSync(getUnread,host=globalThis.window){
 let lastBridge,lastCount;
 function send(count,force=false){
  try{
   const bridge=host?.ferdium;
   if(typeof bridge?.setBadge!=='function')return false;
   if(!force&&bridge===lastBridge&&count===lastCount)return true;
   bridge.setBadge(count,0);lastBridge=bridge;lastCount=count;return true;
  }catch{return false;}
 }
 return {
  sync(force=false){const value=getUnread();return send(Number.isSafeInteger(value)&&value>0?value:0,force);},
  clear(){return send(0,true);}
 };
}
