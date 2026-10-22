// One hibernating object per user. Only authenticated Worker routes can reach it.
// Push invalidations, never messages or credentials: every read rechecks access in D1.
export class ChatNotifications {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
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

  webSocketMessage() {} // Clients cannot publish events or messages through the socket.
  webSocketClose(socket) { socket.close(1000, 'Disconnected'); }
  webSocketError(socket) { socket.close(1011, 'Reconnect'); }
}
