<template>
  <div class="chat-all">
    <aside class="all-list">
      <ConversationCategories kind="all" :account-id="accountId" />
      <div class="all-mailbox" :title="mailbox">{{ mailbox }}</div>
      <div class="all-entries" v-loading="loading && !loaded">
        <ListState :state="error" :retrying="loading" @retry="load(true)" />
        <button v-for="item in view.invites" :key="'i' + item.id" type="button" class="all-entry all-invite" :data-all="item.id" @click="openItem(item)">
          <span class="all-avatar">{{ symbol(item) }}</span>
          <span class="all-copy"><strong>{{ item.source.name }}</strong><small>{{ t('roomInvited') }}</small></span>
        </button>
        <button v-for="item in view.items" :key="item.type + item.id" type="button" class="all-entry" :data-all="item.id" :data-type="item.type" @click="openItem(item)">
          <span class="all-avatar" :class="'kind-' + item.type">{{ symbol(item) }}</span>
          <span class="all-copy">
            <strong>{{ title(item) }}</strong>
            <small>{{ item.type === 'direct' ? (item.source.preview || item.source.subject) : (item.source.preview || t(item.type === 'channel' ? 'roomChannel' : 'roomGroup')) }}</small>
          </span>
          <span class="all-meta"><span>{{ shortTime(item.time) }}</span>
            <span v-if="unread(item)" class="all-badge">{{ unread(item) > 99 ? n(99) + '+' : n(unread(item)) }}</span></span>
        </button>
        <el-empty v-if="loaded && !error && !view.items.length && !view.invites.length" :description="t('chatAllEmpty')" :image-size="70" />
        <el-button v-if="hasMore" class="all-more" text :loading="loading" @click="more">{{ t('mailChatMoreConversations') }}</el-button>
      </div>
    </aside>
    <div class="all-pane"><el-empty :description="t('mailChatChoose')" /></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ConversationCategories from '@/components/conversation-categories.vue';
import ListState from '@/components/list-state.vue';
import { mailConversations } from '@/request/mail-chat';
import { listRooms } from '@/request/rooms';
import { useAccountStore } from '@/store/account';
import { useUserStore } from '@/store/user';
import { mergeChats } from '../../../../shared/chat-all.mjs';

// A read-only view: it lists and opens conversations. Sending, permissions and actions stay in the
// direct-chat and room views it opens.
defineOptions({ name: 'chat-all' });
const { t, n, locale } = useI18n();
const router = useRouter();
const accounts = useAccountStore(), user = useUserStore();
const accountId = computed(() => accounts.currentAccountId || user.user.account?.accountId);
const mailbox = computed(() => accounts.currentAccount?.email || user.user.account?.email || '');
const direct = ref([]), rooms = ref([]), hasMore = ref(false), loading = ref(false), loaded = ref(false), error = ref('');
const view = computed(() => mergeChats({ direct: direct.value, directHasMore: hasMore.value, rooms: rooms.value }));
let generation = 0;

async function load() {
  const mine = ++generation, account = accountId.value;
  loading.value = true;
  try {
    const [chats, roomList] = await Promise.all([mailConversations({ accountId: account, category: 'internal' }), listRooms()]);
    if (mine !== generation) return;
    direct.value = (chats.conversations || []).filter((c) => c.category !== 'external');
    hasMore.value = !!chats.hasMore;
    rooms.value = roomList;
    loaded.value = true; error.value = '';
  } catch {
    if (mine === generation) error.value = loaded.value ? 'stale' : 'failed';
  } finally {
    if (mine === generation) loading.value = false;
  }
}
async function more() {
  const mine = generation, account = accountId.value;
  const oldest = [...direct.value].filter((c) => c.latestId > 0).sort((a, b) => String(a.createTime).localeCompare(String(b.createTime)) || a.latestId - b.latestId)[0];
  if (!oldest) return;
  loading.value = true;
  try {
    const page = await mailConversations({ accountId: account, category: 'internal', before: oldest.latestId });
    if (mine !== generation || account !== accountId.value) return;
    const map = new Map(direct.value.map((c) => [c.key, c]));
    (page.conversations || []).filter((c) => c.category !== 'external').forEach((c) => map.set(c.key, c));
    direct.value = [...map.values()];
    hasMore.value = !!page.hasMore;
  } catch {} finally { loading.value = false; }
}
function openItem(item) {
  if (item.type === 'direct') router.push({ path: '/mail-chat', query: { accountId: String(accountId.value), conversation: item.id } });
  else router.push({ path: '/rooms', query: { kind: item.type, room: item.id } });
}
const title = (item) => item.type === 'direct'
  ? item.source.profile?.remark || item.source.profile?.displayName || (item.source.peers || []).join(', ')
  : item.source.name;
const symbol = (item) => item.type === 'channel' ? '#' : item.type === 'group' ? '☷' : (Array.from(title(item) || '?')[0] || '?').toUpperCase();
const unread = (item) => Number(item.source.unread) || 0;
function shortTime(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T') + 'Z');
  const today = new Date().toDateString() === date.toDateString();
  return today ? date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString(locale.value);
}
load();
</script>

<style scoped>
.chat-all { display:flex; height:100%; min-height:0; }
.all-list { display:flex; flex-direction:column; width:var(--conversation-width, 300px); min-width:0; flex-shrink:0; border-inline-end:1px solid var(--el-border-color); background:var(--el-bg-color); }
.all-mailbox { padding:8px 14px 2px; font-size:11px; color:var(--el-text-color-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.all-entries { flex:1; min-height:0; overflow-y:auto; padding:4px 6px 12px; }
.all-entry { display:flex; align-items:center; gap:10px; width:100%; padding:9px 10px; border:0; border-radius:12px; background:none; color:inherit; font:inherit; text-align:start; cursor:pointer; }
.all-entry:hover { background:var(--el-fill-color-light); }
.all-entry:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.all-avatar { display:grid; place-items:center; flex-shrink:0; width:40px; height:40px; border-radius:50%; background:var(--el-color-primary-light-8); color:var(--el-color-primary); font-weight:600; }
.all-avatar.kind-group, .all-avatar.kind-channel { border-radius:12px; }
.all-copy { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
.all-copy strong, .all-copy small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.all-copy small { color:var(--el-text-color-secondary); font-size:12px; }
.all-meta { display:flex; flex-direction:column; align-items:flex-end; gap:4px; font-size:11px; color:var(--el-text-color-secondary); flex-shrink:0; }
.all-badge { min-width:18px; height:18px; padding:0 5px; box-sizing:border-box; border-radius:9px; background:#ef4444; color:#fff; font-size:10px; line-height:18px; text-align:center; }
.all-invite { background:var(--el-color-warning-light-9); }
.all-more { display:block; margin:8px auto 0; }
.all-pane { flex:1; display:grid; place-items:center; background:var(--chat-canvas, var(--el-fill-color-lighter)); }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .all-list { width:100%; border:0; }
  .all-pane { display:none; }
}
</style>
