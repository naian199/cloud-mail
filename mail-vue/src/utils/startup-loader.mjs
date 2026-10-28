// Called after the first successful route, never by a timer pretending initialization succeeded.
export async function finishStartupLoader(loader,{
 reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true,
 now=()=>performance.now(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 if(!loader||loader.dataset.finishing==='true')return;
 loader.dataset.finishing='true';
 const started=Number(loader.dataset.startedAt);
 if(!reducedMotion&&Number.isFinite(started))await wait(Math.max(0,560-(now()-started)));
 if(!loader.isConnected)return;
 if(!reducedMotion){
  for(const envelope of loader.querySelectorAll?.('.startup-envelope')||[])envelope.style.setProperty('--startup-from',getComputedStyle(envelope).transform);
  loader.classList.add('loading-locking');await wait(220);
  if(!loader.isConnected)return;
 }
 loader.classList.add('loading-complete');loader.setAttribute('aria-busy','false');
 await wait(reducedMotion?80:360);
 if(!loader.isConnected)return;
 loader.classList.add('loading-hide');
 if(!reducedMotion)await wait(160);
 loader.remove();
}
