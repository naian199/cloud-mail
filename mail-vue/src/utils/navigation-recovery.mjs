const KEY='cloud-mail:navigation-recovery';
export function isNavigationChunkError(error){return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed|Unable to preload CSS/i.test(String(error?.message||error||''));}
export function recoverNavigation(error,path,{location,storage,now=Date.now(),online=true}={}){
 if(!online||!isNavigationChunkError(error)||typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))return false;
 try{
  const target=new URL(path,location.origin);if(target.origin!==location.origin)return false;
  const previous=JSON.parse(storage.getItem(KEY)||'null');
  if(previous&&now-previous.at<60000)return false;
  storage.setItem(KEY,JSON.stringify({path:target.pathname+target.search+target.hash,at:now}));
  location.assign(target.href);return true;
 }catch{return false;}
}
export function clearNavigationRecovery(path,storage){try{const value=JSON.parse(storage.getItem(KEY)||'null');if(value?.path===path)storage.removeItem(KEY);}catch{}}
