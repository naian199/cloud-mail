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
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(JSON.stringify({ type: 'refresh' })); }
      catch { socket.close(1011, 'Reconnect'); }
    }
    return new Response(null, { status: 204 });
  }

  async alarm() {
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
