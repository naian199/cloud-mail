import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { mailLive, mailPresence } from '@/request/mail-chat';

export function useMailLive(accountId, selected, connected) {
  const state = ref({ internal: false });
  const sessionId = crypto.randomUUID();
  let stopped = false,
    timer,
    typingTimer,
    expiryTimer,
    lastTyping = 0,
    chain = Promise.resolve();
  function announce(typing = false) {
    if (stopped) return;
    const payload = {
      sessionId,
      accountId: accountId.value,
      key: selected.value?.key,
      active: !document.hidden && connected.value,
      typing: typing && !document.hidden && connected.value
    };
    chain = chain
      .catch(() => {})
      .then(() => (stopped ? null : mailPresence(payload)))
      .catch(() => {});
  }
  async function refresh() {
    const a = accountId.value,
      k = selected.value?.key;
    if (!k) {
      state.value = { internal: false };
      return;
    }
    try {
      const data = await mailLive({ accountId: a, key: k });
      if (stopped || a !== accountId.value || k !== selected.value?.key) return;
      state.value = data;
      clearTimeout(expiryTimer);
      if (data.typing)
        expiryTimer = setTimeout(() => {
          state.value = { ...state.value, typing: false };
        }, 6500);
    } catch {
      if (!stopped) state.value = { internal: false };
    }
  }
  function input(value) {
    clearTimeout(typingTimer);
    if (!value?.trim()) {
      announce(false);
      return;
    }
    if (Date.now() - lastTyping > 2000) {
      lastTyping = Date.now();
      announce(true);
    }
    typingTimer = setTimeout(() => announce(false), 3000);
  }
  function visibility() {
    announce(false);
    refresh();
  }
  watch([accountId, () => selected.value?.key, connected], () => {
    state.value = { internal: false };
    announce(false);
    refresh();
  });
  onMounted(() => {
    announce(false);
    timer = setInterval(() => {
      announce(false);
      refresh();
    }, 20000);
    document.addEventListener('visibilitychange', visibility);
  });
  onBeforeUnmount(() => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(typingTimer);
    clearTimeout(expiryTimer);
    document.removeEventListener('visibilitychange', visibility);
    const url = new URL(`${import.meta.env.VITE_BASE_URL}/mail-chat/presence`, location.origin);
    const offline = () =>
      fetch(url, {
        method: 'PUT',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: localStorage.getItem('token') || ''
        },
        body: JSON.stringify({
          sessionId,
          accountId: accountId.value,
          active: false,
          typing: false
        })
      }).catch(() => {});
    offline();
    chain.finally(offline);
  });
  return {
    live: state,
    refreshLive: refresh,
    liveInput: input,
    stopTyping: () => {
      clearTimeout(typingTimer);
      announce(false);
    }
  };
}
