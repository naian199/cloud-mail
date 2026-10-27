export function installPlatform(navigator) {
  const ua=navigator.userAgent||'';
  if(/iPad|iPhone|iPod/.test(ua)||(/Mac/.test(navigator.platform||'')&&navigator.maxTouchPoints>1))return 'ios';
  if(/Android/i.test(ua))return 'android';
  if(/Macintosh/.test(ua)&&/Safari/.test(ua)&&!/Chrome|Chromium|Edg/.test(ua))return 'macos';
  return 'desktop';
}
export function standaloneApp(window,navigator){return !!navigator.standalone||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: minimal-ui)').matches;}
export async function promptAppInstall(event){
  // Invoke the browser while still in the original click gesture.
  await event.prompt();
  const choice=await event.userChoice;
  return choice?.outcome==='accepted'?'accepted':'dismissed';
}
