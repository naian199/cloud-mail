import { ref, onMounted, onBeforeUnmount } from 'vue';
import { openChatSocket } from '@/request/chat';

export function useMailSync(refresh) {
  const connected = ref(false);
  let stopped = false,
    socket,
    reconnect,
    heartbeat,
    reconcile,
    delay = 1000,
    pong = 0;
  const sync = () => {
    if (!stopped && !document.hidden) Promise.resolve(refresh()).catch(() => {});
  };
  function connect() {
    if (stopped || !localStorage.getItem('token')) return;
    try {
      socket = openChatSocket();
    } catch {
      retry();
      return;
    }
    socket.onopen = () => {
      connected.value = true;
      delay = 1000;
      pong = Date.now();
      sync();
      heartbeat = setInterval(() => {
        if (Date.now() - pong > 60000) socket.close();
        else if (socket.readyState === WebSocket.OPEN) socket.send('ping');
      }, 25000);
    };
    socket.onmessage = (event) => {
      pong = Date.now();
      if (event.data !== 'pong') sync();
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      connected.value = false;
      clearInterval(heartbeat);
      retry();
    };
  }
  function retry() {
    if (stopped || !localStorage.getItem('token')) return;
    clearTimeout(reconnect);
    reconnect = setTimeout(connect, delay);
    delay = Math.min(delay * 2, 30000);
  }
  onMounted(() => {
    connect();
    reconcile = setInterval(sync, 15000);
    document.addEventListener('visibilitychange', sync);
  });
  onBeforeUnmount(() => {
    stopped = true;
    clearTimeout(reconnect);
    clearInterval(heartbeat);
    clearInterval(reconcile);
    socket?.close();
    document.removeEventListener('visibilitychange', sync);
  });
  return { connected };
}
