<template>
  <section class="chat-page" :class="{ 'conversation-open': activeFriend }">
    <aside class="friends-panel">
      <div class="friends-heading">
        <h2>{{ t('chatFriends') }}</h2>
        <el-button type="primary" size="small" @click="addOpen = true">{{ t('chatAddFriend') }}</el-button>
      </div>
      <p class="connection" role="status">{{ connected ? t('chatConnected') : t('chatReconnecting') }}</p>
      <div class="friends-scroll" v-loading="friendsLoading">
        <div v-if="requests.length" class="requests">
          <h3>{{ t('chatRequests') }}</h3>
          <div v-for="friend in requests" :key="friend.id" class="request-card">
            <div class="friend-email">{{ friend.email }}</div>
            <div v-if="friend.requesterId !== userId" class="request-actions">
              <el-button size="small" type="primary" :loading="busyId === friend.id" @click="respond(friend, true)">{{ t('chatAccept') }}</el-button>
              <el-button size="small" :disabled="busyId === friend.id" @click="respond(friend, false)">{{ t('chatReject') }}</el-button>
            </div>
            <div v-else class="pending-request">
              <span>{{ t('chatPending') }}</span>
              <el-button text size="small" :loading="busyId === friend.id" @click="cancelRequest(friend)">{{ t('cancel') }}</el-button>
            </div>
          </div>
        </div>
        <button v-for="friend in friends" :key="friend.id" type="button" class="friend-row"
                :class="{ selected: activeId === friend.id }" @click="selectFriend(friend)">
          <span class="friend-avatar">{{ friend.email[0].toUpperCase() }}</span>
          <span class="friend-summary">
            <span class="friend-email">{{ friend.email }}</span>
            <span class="last-message">{{ friend.lastMessage || t('chatStartConversation') }}</span>
          </span>
          <span v-if="friend.unread" class="unread-badge" :aria-label="t('chatUnread')">{{ friend.unread > 99 ? '99+' : friend.unread }}</span>
        </button>
        <el-empty v-if="!friendsLoading && !friends.length" :description="t('chatNoFriends')" :image-size="72" />
        <el-button class="refresh-friends" text @click="sync">{{ t('chatRefresh') }}</el-button>
      </div>
    </aside>

    <main v-if="activeFriend" class="conversation">
      <header class="conversation-heading">
        <el-button class="back-friends" text :aria-label="t('chatBack')" @click="closeConversation">
          <Icon icon="material-symbols:arrow-back-rounded" width="24" />
        </el-button>
        <div class="conversation-email">
          <div class="friend-email">{{ activeFriend.email }}</div>
          <span class="conversation-status" role="status">{{ connected ? t('chatConnected') : t('chatReconnecting') }}</span>
        </div>
        <el-button text type="danger" @click="deleteFriend">{{ t('chatRemoveFriend') }}</el-button>
      </header>
      <div ref="messageList" class="messages" v-loading="messagesLoading" @scroll="updateAtBottom">
        <div class="history-action">
          <el-button v-if="hasOlder" text :loading="olderLoading" @click="loadOlder">{{ t('chatOlder') }}</el-button>
        </div>
        <p v-if="!messagesLoading && !messages.length" class="empty-conversation">{{ t('chatStartConversation') }}</p>
        <ol aria-live="polite" aria-relevant="additions" :aria-label="t('chatMessages')">
          <li v-for="message in messages" :key="message.id" class="message" :class="{ mine: message.senderId === userId }">
            <div class="message-body">{{ message.body }}</div>
            <time :datetime="message.createdAt">{{ messageTime(message.createdAt) }}</time>
          </li>
        </ol>
      </div>
      <button v-if="!atBottom" class="newest-button" type="button" @click="scrollBottom">{{ t('chatNewest') }}</button>
      <form class="composer" @submit.prevent="send">
        <el-input v-model="drafts[activeId]" type="textarea" :rows="2" resize="none" maxlength="2000"
                  :placeholder="t('chatMessagePlaceholder')" :aria-label="t('chatMessagePlaceholder')" @keydown="onComposerKey" />
        <div class="composer-actions">
          <span>{{ t('chatEnterHint') }}</span>
          <el-button type="primary" native-type="submit" :loading="sending" :disabled="!drafts[activeId]?.trim() || messagesLoading">{{ t('chatSend') }}</el-button>
        </div>
      </form>
    </main>
    <div v-else class="choose-conversation"><el-empty :description="t('chatChooseFriend')" /></div>

    <el-dialog v-model="addOpen" :title="t('chatAddFriend')" width="min(420px, calc(100% - 32px))">
      <form @submit.prevent="addFriend">
        <p class="add-hint">{{ t('chatSameSite') }}</p>
        <el-input v-model="friendEmail" type="email" autocomplete="off" maxlength="254" :placeholder="t('chatEmailPlaceholder')" :aria-label="t('chatEmailPlaceholder')" />
        <el-button class="add-submit" native-type="submit" type="primary" :loading="adding" :disabled="!friendEmail.trim()">{{ t('chatRequest') }}</el-button>
      </form>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/store/user';
import { listFriends, requestFriend, respondFriend, removeFriend, listMessages, sendMessage, readMessages, openChatSocket } from '@/request/chat';

const { t } = useI18n();
const userStore = useUserStore();
const userId = computed(() => userStore.user.userId);
const contacts = ref([]), activeId = ref(null), messages = ref([]);
const friends = computed(() => contacts.value.filter(f => f.status === 'accepted'));
const requests = computed(() => contacts.value.filter(f => f.status === 'pending'));
const activeFriend = computed(() => friends.value.find(f => f.id === activeId.value));
const drafts = reactive({});
const friendsLoading = ref(true), messagesLoading = ref(false), olderLoading = ref(false), hasOlder = ref(false);
const sending = ref(false), adding = ref(false), addOpen = ref(false), friendEmail = ref(''), busyId = ref(null);
const connected = ref(false), atBottom = ref(true), messageList = ref(null);
let stopped = false, generation = 0, socket, reconnectTimer, heartbeatTimer, reconcileTimer;
let reconnectDelay = 1000, lastPong = 0, syncing = false, resync = false, pendingSend;
const lastRead = new Map();

function messageTime(value) {
  const date = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
  return date.toLocaleString();
}
function merge(items) {
  const byId = new Map(messages.value.map(m => [m.id, m]));
  items.forEach(m => byId.set(m.id, m));
  messages.value = [...byId.values()].sort((a, b) => a.id - b.id);
}
function updateAtBottom() {
  const el = messageList.value;
  if (el) atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  if (activeId.value && atBottom.value) markRead(activeId.value).catch(() => {});
}
async function scrollBottom() {
  await nextTick();
  const el = messageList.value;
  if (el) { el.scrollTop = el.scrollHeight; atBottom.value = true; }
}
async function markRead(id) {
  if (id !== activeId.value || document.hidden || !atBottom.value) return;
  const latest = messages.value.at(-1)?.id;
  if (!latest || latest <= (lastRead.get(id) || 0)) return;
  await readMessages(id, latest);
  lastRead.set(id, latest);
  const friend = contacts.value.find(f => f.id === id);
  if (friend) friend.unread = 0;
}
function closeConversation() {
  generation++;
  activeId.value = null;
  messages.value = [];
  messagesLoading.value = false;
}
async function selectFriend(friend) {
  if (activeId.value === friend.id) return;
  const version = ++generation;
  activeId.value = friend.id;
  messages.value = [];
  hasOlder.value = false;
  messagesLoading.value = true;
  atBottom.value = true;
  try {
    const data = await listMessages(friend.id);
    if (stopped || version !== generation) return;
    merge(data.messages);
    hasOlder.value = data.hasMore;
    await scrollBottom();
    await markRead(friend.id);
  } catch { /* The shared API client displays errors. */ }
  finally {
    if (version === generation) { messagesLoading.value = false; sync(); }
  }
}
async function sync() {
  if (stopped || document.hidden) return;
  if (syncing) { resync = true; return; }
  syncing = true;
  try {
    do {
      resync = false;
      const list = await listFriends();
      if (stopped) return;
      contacts.value = list;
      if (activeId.value && !activeFriend.value) closeConversation();
      const id = activeId.value, version = generation;
      if (id && !messagesLoading.value) {
        const wasAtBottom = atBottom.value;
        let more;
        do {
          const after = messages.value.at(-1)?.id;
          const data = await listMessages(id, after ? { after } : {});
          if (stopped || version !== generation) break;
          merge(data.messages);
          if (!after) hasOlder.value = data.hasMore;
          more = !!after && data.hasMore;
        } while (more);
        if (!stopped && version === generation) {
          if (wasAtBottom) await scrollBottom();
          await markRead(id);
        }
      }
    } while (resync && !stopped);
  } catch { /* Retry on the next push, visibility change, or reconciliation. */ }
  finally { syncing = false; friendsLoading.value = false; }
}
async function loadOlder() {
  if (olderLoading.value || !messages.value.length) return;
  olderLoading.value = true;
  const id = activeId.value, version = generation;
  const el = messageList.value, previousHeight = el.scrollHeight, previousTop = el.scrollTop;
  try {
    const data = await listMessages(id, { before: messages.value[0].id });
    if (stopped || version !== generation) return;
    merge(data.messages); hasOlder.value = data.hasMore;
    await nextTick(); el.scrollTop = previousTop + el.scrollHeight - previousHeight;
    updateAtBottom();
  } catch { /* Shared API error. */ }
  finally { olderLoading.value = false; }
}
async function addFriend() {
  if (adding.value || !friendEmail.value.trim()) return;
  adding.value = true;
  try {
    await requestFriend(friendEmail.value.trim());
    addOpen.value = false; friendEmail.value = '';
    ElMessage.success(t('chatRequestSent')); await sync();
  } catch { /* Shared API error. */ }
  finally { adding.value = false; }
}
async function respond(friend, accept) {
  if (busyId.value) return;
  busyId.value = friend.id;
  try { await respondFriend(friend.id, accept); await sync(); }
  catch { /* Shared API error. */ }
  finally { busyId.value = null; }
}
async function cancelRequest(friend) {
  if (busyId.value) return;
  busyId.value = friend.id;
  try { await removeFriend(friend.id); await sync(); }
  catch { /* Shared API error. */ }
  finally { busyId.value = null; }
}
async function deleteFriend() {
  const friend = activeFriend.value;
  if (!friend) return;
  try {
    await ElMessageBox.confirm(t('chatRemoveConfirm', { email: friend.email }), t('chatRemoveFriend'), { type: 'warning', confirmButtonText: t('confirm'), cancelButtonText: t('cancel') });
    await removeFriend(friend.id);
    if (activeId.value === friend.id) closeConversation();
    delete drafts[friend.id]; await sync();
  } catch { /* Cancellation or shared API error. */ }
}
function onComposerKey(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault(); send();
  }
}
async function send() {
  const id = activeId.value, body = drafts[id]?.trim();
  if (!id || !body || sending.value || messagesLoading.value) return;
  if (!pendingSend || pendingSend.id !== id || pendingSend.body !== body) pendingSend = { id, body, clientId: crypto.randomUUID() };
  const attempt = pendingSend;
  sending.value = true;
  try {
    const message = await sendMessage(id, body, attempt.clientId);
    if (drafts[id]?.trim() === body) drafts[id] = '';
    pendingSend = null;
    if (!stopped && activeId.value === id) { merge([message]); await scrollBottom(); await markRead(id); }
    await sync();
  } catch { /* Preserve the draft and idempotency key for retry. */ }
  finally { sending.value = false; }
}
function connect() {
  if (stopped || !localStorage.getItem('token')) return;
  try { socket = openChatSocket(); }
  catch { scheduleReconnect(); return; }
  socket.onopen = () => {
    connected.value = true; reconnectDelay = 1000; lastPong = Date.now(); sync();
    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastPong > 60000) socket.close();
      else if (socket.readyState === WebSocket.OPEN) socket.send('ping');
    }, 25000);
  };
  socket.onmessage = event => {
    lastPong = Date.now();
    if (event.data === 'pong') return;
    try { if (JSON.parse(event.data).type === 'refresh') sync(); } catch { /* Ignore unknown frames. */ }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => { connected.value = false; clearInterval(heartbeatTimer); scheduleReconnect(); };
}
function scheduleReconnect() {
  if (stopped || !localStorage.getItem('token')) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}
function resume() { if (!document.hidden) sync(); }
onMounted(() => {
  sync(); connect();
  // Reconcile after lost notifications as well as after reconnecting.
  reconcileTimer = setInterval(sync, 15000);
  document.addEventListener('visibilitychange', resume);
});
onBeforeUnmount(() => {
  stopped = true; generation++;
  clearTimeout(reconnectTimer); clearInterval(heartbeatTimer); clearInterval(reconcileTimer);
  socket?.close(); document.removeEventListener('visibilitychange', resume);
});
</script>

<style scoped lang="scss">
.chat-page { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.friends-panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--el-border-color); }
.friends-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 16px 12px 8px; h2 { font-size: 16px; } }
.connection { padding: 0 12px 12px; font-size: 12px; color: var(--el-text-color-secondary); }
.friends-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.requests { padding: 0 12px 12px; h3 { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 8px; } }
.request-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.request-actions { display: flex; margin-top: 8px; }
.pending-request { display: flex; align-items: center; justify-content: space-between; color: var(--el-text-color-secondary); font-size: 12px; }
.friend-row { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: var(--el-text-color-primary); text-align: left; padding: 14px 12px; cursor: pointer; }
.friend-row:hover, .friend-row.selected { background: var(--el-fill-color-light); }
.friend-avatar { display: flex; align-items: center; justify-content: center; background: var(--el-color-primary-light-9); color: var(--el-color-primary); border-radius: 12px; width: 40px; height: 40px; flex-shrink: 0; }
.friend-summary { min-width: 0; flex: 1; display: grid; gap: 4px; }
.friend-email, .last-message { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.last-message { font-size: 12px; color: var(--el-text-color-secondary); }
.unread-badge { border-radius: 12px; background: var(--el-color-danger); color: white; padding: 1px 6px; font-size: 12px; }
.refresh-friends { display: block; margin: 12px auto; }
.choose-conversation { display: flex; align-items: center; justify-content: center; }
.conversation { display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; }
.conversation-heading { flex-shrink: 0; min-height: 58px; display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--el-border-color); }
.conversation-email { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: bold; }
.conversation-status { display: block; font-size: 11px; font-weight: normal; color: var(--el-text-color-secondary); }
.back-friends { display: none; }
.messages { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 20px 16px; }
.history-action { display: flex; justify-content: center; min-height: 28px; }
.empty-conversation { color: var(--el-text-color-secondary); text-align: center; padding: 20px; }
.message { display: flex; flex-direction: column; align-items: flex-start; margin: 12px 0; .message-body { max-width: 85%; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px 14px; border-radius: 12px 12px 12px 2px; background: var(--el-fill-color); } time { font-size: 11px; color: var(--el-text-color-secondary); margin-top: 4px; } }
.message.mine { align-items: flex-end; .message-body { background: var(--el-color-primary); color: white; border-radius: 12px 12px 2px 12px; } }
.composer { flex-shrink: 0; border-top: 1px solid var(--el-border-color); padding: 12px 16px; }
.composer-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; span { font-size: 12px; color: var(--el-text-color-secondary); } }
.newest-button { position: absolute; right: 20px; bottom: 150px; padding: 8px 12px; border: 1px solid var(--el-border-color); border-radius: 20px; background: var(--el-bg-color); color: var(--el-color-primary); cursor: pointer; }
.add-hint { margin-bottom: 16px; color: var(--el-text-color-secondary); }
.add-submit { width: 100%; margin-top: 16px; }
@media (max-width: 767px) {
  .chat-page { grid-template-columns: minmax(0, 1fr); }
  .choose-conversation, .conversation-open .friends-panel { display: none; }
  .friends-panel { border-right: 0; }
  .back-friends { display: inline-flex; padding: 8px; }
  .conversation-heading { padding: 8px; }
  .messages { padding: 0 12px 12px; }
  .composer { padding: 10px 12px; }
  .composer :deep(textarea) { font-size: 16px; }
  .composer-actions span { font-size: 11px; }
  .message .message-body { max-width: 92%; }
}
</style>
