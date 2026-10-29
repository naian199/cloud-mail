import { randomUUID } from '@/utils/uuid';
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { mailLive, mailPresence } from '@/request/mail-chat';

export function useMailLive(accountId, selected, connected) {
  const state = ref({ internal: false });
  const sessionId = randomUUID();
  let stopped = false,
    timer,
    typingTimer,
    expiryTimer,
    lastTyping = 0,
    choosing = false,
    selectionTimer,
    chain = Promise.resolve();
  function announce(typing = false) {
    if (stopped) return;
    const payload = {
      sessionId,
      accountId: accountId.value,
      key: selected.value?.key,
      active: !document.hidden && connected.value,
      typing: typing && !document.hidden && connected.value,
      selectingSticker: choosing && !document.hidden && connected.value
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
      if (data.typing || data.selectingSticker)
        expiryTimer = setTimeout(() => {
          state.value = { ...state.value, typing: false, selectingSticker: false };
        }, 6500);
    } catch {
      if (!stopped && a === accountId.value && k === selected.value?.key) state.value = { internal: state.value.internal, unknown: true };
    }
  }
  function input(value) {
    clearTimeout(typingTimer);
    if (!value?.trim()) {
      lastTyping = 0;
      announce(false);
      return;
    }
    if (Date.now() - lastTyping > 2000) {
      lastTyping = Date.now();
      announce(true);
    }
    typingTimer = setTimeout(() => { lastTyping = 0; announce(false); }, 3000);
  }
  function selectSticker(open) {
    choosing = !!open;
    lastTyping = 0;
    clearInterval(selectionTimer);
    clearTimeout(typingTimer);
    announce(false);
    if (choosing) selectionTimer = setInterval(() => {
      if (!document.hidden && connected.value) announce(false);
    }, 3000);
  }
  function visibility() {
    lastTyping = 0;
    announce(false);
    refresh();
  }
  watch([accountId, () => selected.value?.key], () => {
    state.value = { internal: false };
    choosing = false;
    lastTyping = 0;
    clearInterval(selectionTimer);
    clearTimeout(typingTimer);
    announce(false);
    refresh();
  });
  watch(connected, visibility);
  onMounted(() => {
    announce(false);
    timer = setInterval(() => {
      announce(Date.now() - lastTyping < 3000);
      refresh();
    }, 20000);
    document.addEventListener('visibilitychange', visibility);
  });
  onBeforeUnmount(() => {
    stopped = true;
    clearInterval(timer);
    clearInterval(selectionTimer);
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
    selectSticker,
    stopTyping: () => {
      lastTyping = 0;
      clearTimeout(typingTimer);
      announce(false);
    }
  };
}
