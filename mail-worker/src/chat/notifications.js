// One hibernating object per user. Only authenticated Worker routes can reach it.
// Push invalidations, never messages or credentials: every read rechecks access in D1.
import { consumeTranslationQuota } from '../lib/google-translation.js';
import { notifyMail } from './mail-notify.js';
export class ChatNotifications {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const path=new URL(request.url).pathname;
    if(request.method==='POST'&&path==='/push/keys'){
      const {generatePushKeys}=await import('../service/push-service');
      const keys=await this.ctx.blockConcurrencyWhile(async()=>{let keys=await this.ctx.storage.get('vapid-keys');if(!keys){keys=await generatePushKeys();await this.ctx.storage.put('vapid-keys',keys);}return keys;});
      return Response.json(keys);
    }
    if(request.method==='POST'&&path==='/push/disable'){await this.ctx.storage.put('push-enabled',false);return new Response(null,{status:204});}
    if(request.method==='POST'&&path==='/push/seed'){
      const userId=Number(request.headers.get('X-Notification-User'));if(!Number.isSafeInteger(userId)||userId<1)return new Response(null,{status:400});
      const wasEnabled=await this.ctx.storage.get('push-enabled');
      const {notificationCursor}=await import('../service/push-service');
      if(!wasEnabled||!await this.ctx.storage.get('push-cursor'))await this.ctx.storage.put('push-cursor',await notificationCursor(this.env,userId));
      if(!wasEnabled){await this.ctx.storage.delete('push-retries');await this.ctx.storage.delete('push-retry-start');}
      await this.ctx.storage.put('push-enabled',true);
      return new Response(null,{status:204});
    }
    if(request.method==='POST' && new URL(request.url).pathname==='/rooms/notify') {
      const {users}=await request.json();
      if(!Array.isArray(users)||users.length>101||!users.every(id=>Number.isSafeInteger(id)&&id>0))return new Response(null,{status:400});
      await this.ctx.storage.transaction(async txn=>{
        const pending=await txn.get('room-notify-users')||[];
        await txn.put('room-notify-users',[...new Set([...pending,...users])]);
        await txn.setAlarm(Date.now()+1);
      });
      return new Response(null,{status:204});
    }
    if (request.method === 'POST' && new URL(request.url).pathname === '/translation/permit') {
      try {
        const allowed = await consumeTranslationQuota(this.ctx.storage, await request.json());
        return new Response(null, { status: allowed ? 204 : 429 });
      } catch { return new Response(null, { status: 503 }); }
    }
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: 'refresh' }));
      return new Response(null, {
        status: 101, webSocket: client,
        headers: { 'Sec-WebSocket-Protocol': 'cloud-mail-chat' }
      });
    }
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const userId=Number(request.headers.get('X-Notification-User'));
    if(this.env.db&&Number.isSafeInteger(userId)&&userId>0&&await this.ctx.storage.get('push-enabled')){
      await this.ctx.storage.put('push-user',userId);
      const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>Date.now()+800)await this.ctx.storage.setAlarm(Date.now()+800);
    }
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(JSON.stringify({ type: 'refresh' })); }
      catch { socket.close(1011, 'Reconnect'); }
    }
    return new Response(null, { status: 204 });
  }

  async alarm() {
    const userId=await this.ctx.storage.get?.('push-user');
    if(userId&&this.env.db&&await this.ctx.storage.get('push-enabled')){
      const {sendUserPush,notificationCursor}=await import('../service/push-service');
      try{
        const cursor=await sendUserPush(this.env,userId,await this.ctx.storage.get('push-cursor'));
        await this.ctx.storage.put('push-cursor',cursor);
        await this.ctx.storage.delete('push-retries');
        await this.ctx.storage.delete('push-retry-start');
      }catch{
        const attempt=(await this.ctx.storage.get('push-retries')||0)+1;
        const start=await this.ctx.storage.get('push-retry-start')||Date.now();
        if(Date.now()-start<86400000){
          await this.ctx.storage.put('push-retry-start',start);
          await this.ctx.storage.put('push-retries',attempt);
          const delays=[15000,45000,120000,300000,900000,3600000];
          await this.ctx.storage.setAlarm(Date.now()+delays[Math.min(attempt-1,delays.length-1)]);
        }else{
          await this.ctx.storage.put('push-cursor',await notificationCursor(this.env,userId));
          await this.ctx.storage.delete('push-retries');
          await this.ctx.storage.delete('push-retry-start');
        }
        console.error('Web Push reconciliation unavailable');
      }
    }
    const batch=await this.ctx.storage.transaction(async txn=>{
      const pending=await txn.get('room-notify-users')||[];
      const selected=pending.slice(0,40),remaining=pending.slice(40);
      if(remaining.length){await txn.put('room-notify-users',remaining);await txn.setAlarm(Date.now()+50);}
      else await txn.delete('room-notify-users');
      return selected;
    });
    // Each alarm stays below the Free plan subrequest budget. Push only invalidations.
    if(batch.length)await notifyMail(this.env,...batch);
  }

  webSocketMessage() {} // Clients cannot publish events or messages through the socket.
  webSocketClose(socket) { socket.close(1000, 'Disconnected'); }
  webSocketError(socket) { socket.close(1011, 'Reconnect'); }
}
