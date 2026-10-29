export const notificationDefaults={revision:0,enabled:true,preview:'full',private:true,external:true,group:true,channel:true,locale:'en',muted:{}};
export function pushEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.href.length<2048&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))?u.href:null;}catch{return null;}}
export function notificationContext(value){return typeof value==='string'&&/^(?:mail:[1-9]\d*:[a-f0-9]{64}|room:[a-f0-9-]{36})$/.test(value);}
export function notificationPayload(message,prefs,userId){
 const zh=/^zh/.test(prefs.locale),generic=zh?'收到新消息':'New message';
 let title=message.name||'Cloud Mail',body=message.body?.replace(/\s+/g,' ').trim().slice(0,180)||({image:zh?'发来一张图片':'Sent a photo',video:zh?'发来一个视频':'Sent a video',audio:zh?'发来一条语音':'Sent a voice message',file:zh?'发来一个文件':'Sent a file'}[message.attachment]||generic);
 if(prefs.preview==='sender')body=generic;if(prefs.preview==='none'){title='Cloud Mail';body=generic;}
 const icon=prefs.preview!=='none'&&/^data:image\/(png|jpeg|webp);base64,/.test(message.avatar||'')&&message.avatar.length<1200?message.avatar:'/mail-brand-192.png';
 return {id:message.id,userId,preferenceRevision:prefs.revision||0,kind:message.kind,context:message.context,title:title.slice(0,100),body,icon,tag:`cloud-mail:${userId}:${message.context}`,url:message.url,created:Date.now()};
}
