import { watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useAccountStore } from '@/store/account';
import { mailPresence } from '@/request/mail-chat';
import { randomUUID } from '@/utils/uuid';

export function useUserPresence() {
  const account = useAccountStore(), route = useRoute(), sessionId = randomUUID();
  let timer, previous, chain = Promise.resolve();
  function send(active = !document.hidden) {
    const token = localStorage.getItem('token'), accountId = account.currentAccountId;
    const next = token && accountId ? { token, accountId } : null;
    const old = previous;
    previous = next;
    chain = chain.catch(() => {}).then(async () => {
      if (old && (!next || old.token !== next.token || old.accountId !== next.accountId || !active)) {
        const url = new URL(`${import.meta.env.VITE_BASE_URL}/mail-chat/presence`, location.origin);
        await fetch(url, { method: 'PUT', keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: old.token },
          body: JSON.stringify({sessionId, accountId: old.accountId, active: false, typing: false}) }).catch(() => {});
      }
      if (next && active && localStorage.getItem('token') === next.token)
        await mailPresence({sessionId, accountId: next.accountId, active: true, typing: false});
    }).catch(() => {});
  }
  const visibility = () => send();
  const leave = () => send(false);
  watch([() => account.currentAccountId, () => route.fullPath], visibility);
  onMounted(() => {
    send(); timer = setInterval(visibility, 20000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', visibility);
    window.addEventListener('storage', visibility);
  });
  onBeforeUnmount(() => {
    clearInterval(timer); leave();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', leave);
    window.removeEventListener('pageshow', visibility);
    window.removeEventListener('storage', visibility);
  });
}
