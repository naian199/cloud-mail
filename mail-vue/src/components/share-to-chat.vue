<template>
  <!-- Share an app inside the site. Groups and channels you can post in get the link as a message
       after a preview and confirmation; a direct chat opens with the link in its draft, and you
       press Send yourself. -->
  <el-dialog :model-value="modelValue" :title="t('appShareToChat')" width="min(460px, calc(100vw - 24px))" append-to-body @update:model-value="$emit('update:modelValue', $event)" @open="load">
    <div v-if="!picked" class="share-pick" v-loading="loading">
      <ListState :state="error" @retry="load" />
      <template v-for="group in groups" :key="group.id">
        <h3 v-if="group.items.length">{{ t(group.label) }}</h3>
        <button v-for="item in group.items" :key="item.id" type="button" class="share-target" :data-share-target="item.id" @click="picked = item">
          <span class="share-avatar" aria-hidden="true">{{ initial(item.name) }}</span>
          <span class="share-name">{{ item.name }}</span>
        </button>
      </template>
      <p v-if="loaded && !error && !groups.some((g) => g.items.length)" class="muted">{{ t('appShareNoTargets') }}</p>
    </div>
    <div v-else class="share-confirm">
      <p class="muted">{{ picked.kind === 'direct' ? t('appShareDraftHint') : t('appShareSendHint') }}</p>
      <div class="share-to"><span class="share-avatar" aria-hidden="true">{{ initial(picked.name) }}</span><strong>{{ picked.name }}</strong></div>
      <div class="share-preview"><p>{{ message }}</p><AppCard :app-id="appId" /></div>
    </div>
    <template #footer>
      <el-button v-if="picked" @click="picked = null">{{ t('navBack') }}</el-button>
      <el-button v-else @click="copy">{{ t('appCopyLink') }}</el-button>
      <el-button v-if="picked" type="primary" :loading="sending" data-share-confirm @click="confirm">{{ picked.kind === 'direct' ? t('appShareOpenChat') : t('appShareSend') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import AppCard from '@/components/app-card.vue';
import ListState from '@/components/list-state.vue';
import { listRooms, sendRoomMessage } from '@/request/rooms';
import { mailConversations } from '@/request/mail-chat';
import { appLink } from '@/request/apps';
import { useAccountStore } from '@/store/account';
import { useUserStore } from '@/store/user';
import { randomUUID } from '@/utils/uuid';

const props = defineProps({ modelValue: Boolean, appId: { type: Number, required: true }, appName: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();
const router = useRouter();
const accounts = useAccountStore(), user = useUserStore();
const direct = ref([]), rooms = ref([]), loading = ref(false), loaded = ref(false), error = ref(''), picked = ref(null), sending = ref(false);
const link = computed(() => appLink(props.appId));
const message = computed(() => `${props.appName} ${link.value}`.trim());
const accountId = () => accounts.currentAccountId || user.user.account?.accountId;
const groups = computed(() => [
  { id: 'direct', label: 'navDirect', items: direct.value },
  { id: 'group', label: 'roomGroup', items: rooms.value.filter((r) => r.kind === 'group') },
  { id: 'channel', label: 'roomChannel', items: rooms.value.filter((r) => r.kind === 'channel') }
]);
const initial = (name) => Array.from(name || '#')[0].toUpperCase();

async function load() {
  picked.value = null; loading.value = true;
  try {
    const [roomList, chats] = await Promise.all([listRooms(), mailConversations({ accountId: accountId(), category: 'internal' })]);
    // Only places the user can post to: joined groups, and channels they own or manage.
    rooms.value = roomList.filter((r) => r.status === 'joined' && (r.kind === 'group' || ['owner', 'admin'].includes(r.role)))
      .map((r) => ({ id: r.id, kind: r.kind, name: r.name }));
    direct.value = (chats.conversations || []).filter((c) => c.category !== 'external').slice(0, 30)
      .map((c) => ({ id: c.key, kind: 'direct', name: c.profile?.remark || c.profile?.displayName || (c.peers || []).join(', ') || c.subject }));
    loaded.value = true; error.value = '';
  } catch { error.value = loaded.value ? 'stale' : 'failed'; } finally { loading.value = false; }
}
async function confirm() {
  const target = picked.value;
  if (target.kind === 'direct') {
    emit('update:modelValue', false);
    await router.push({ path: '/mail-chat', query: { accountId: String(accountId()), conversation: target.id, draft: link.value } });
    return;
  }
  sending.value = true;
  try {
    await sendRoomMessage(target.id, message.value, randomUUID());
    ElMessage.success(t('appShareSent', { name: target.name }));
    emit('update:modelValue', false);
  } catch {} finally { sending.value = false; }
}
async function copy() {
  try { await navigator.clipboard.writeText(link.value); ElMessage.success(t('appLinkCopied')); } catch { ElMessage.info(link.value); }
}
</script>

<style scoped>
.share-pick { display:flex; flex-direction:column; gap:4px; min-height:120px; max-height:min(60vh, 420px); overflow-y:auto; }
.share-pick h3 { margin:10px 4px 4px; font-size:12px; color:var(--el-text-color-secondary); font-weight:600; }
.share-target { display:flex; align-items:center; gap:10px; padding:8px; border:0; border-radius:10px; background:none; color:inherit; font:inherit; text-align:start; cursor:pointer; }
.share-target:hover { background:var(--el-fill-color-light); }
.share-target:focus-visible { outline:2px solid var(--el-color-primary); }
.share-avatar { display:grid; place-items:center; flex-shrink:0; width:34px; height:34px; border-radius:50%; background:var(--el-color-primary-light-8); color:var(--el-color-primary); font-weight:600; }
.share-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.share-to { display:flex; align-items:center; gap:10px; margin:8px 0; }
.share-preview { padding:12px; border-radius:12px; background:var(--el-fill-color-lighter); }
.share-preview p { margin:0 0 6px; word-break:break-all; font-size:13px; }
.muted { color:var(--el-text-color-secondary); font-size:13px; margin:0; }
</style>
