<template>
  <div class="review-mail" :class="{ 'has-thread': threadId }">
    <aside class="review-list" :aria-label="t('mailChatTitle')">
      <form class="review-search" @submit.prevent="search = input.trim()">
        <input v-model="input" type="search" :aria-label="t('searchByContent')" :placeholder="t('searchByContent')" />
        <button type="submit" :aria-label="t('searchByContent')"><Icon icon="cloud-mail:search" width="19" /></button>
        <button type="button" :aria-label="t('chatRefresh')" @click="loadList(true)"><Icon icon="ion:reload" width="17" /></button>
      </form>
      <div class="review-list-scroll" :aria-busy="listLoading">
        <ListState :state="listError" :retrying="listLoading" @retry="loadList(retryListReset)" />
        <p v-if="!listLoading && !listError && !threads.length" class="review-empty">{{ t('mailChatEmpty') }}</p>
        <RouterLink v-for="thread of threads" :key="thread.emailId" :to="{ query: { thread: thread.emailId } }"
                    class="review-item" :class="{ selected: selected(thread) }" :aria-current="selected(thread) ? 'true' : undefined">
          <span class="review-avatar" aria-hidden="true">{{ (title(thread)[0] || '?').toUpperCase() }}</span>
          <span class="review-item-copy">
            <strong dir="auto">{{ title(thread) }}</strong>
            <small dir="auto">{{ address(thread) }}</small>
            <span dir="auto">{{ thread.preview?.trim() || thread.subject || t('noSubject') }}</span>
          </span>
          <time>{{ fromNow(thread.createTime) }}</time>
        </RouterLink>
        <button v-if="listBefore && !listError" type="button" class="review-more" :disabled="listLoading" @click="loadList(false)">{{ t('mailChatMoreConversations') }}</button>
      </div>
    </aside>
    <section class="review-thread" :aria-label="t('chatMessages')">
      <header v-if="threadId" class="review-heading">
        <RouterLink class="review-back" :to="{ query: {} }" :aria-label="t('navBack')"><Icon icon="cloud-mail:back" width="22" /></RouterLink>
        <div v-if="latest" class="review-heading-copy">
          <strong dir="auto">{{ title(latest) }}</strong>
          <small dir="auto">{{ address(latest) }}</small>
        </div>
      </header>
      <div v-if="threadId" ref="timeline" class="review-timeline" :aria-busy="messageLoading">
        <ListState :state="messageError" :retrying="messageLoading" @retry="loadThread(false)" />
        <p v-if="!messageLoading && !messageError && !messages.length" class="review-empty">{{ t('mailUnavailable') }}</p>
        <button v-if="messageBefore && !messageError" type="button" class="review-more" :disabled="messageLoading" @click="loadThread(false)">{{ t('chatOlder') }}</button>
        <article v-for="message in messages" :key="message.emailId" class="review-bubble" :class="{ outgoing: message.type === 1 }">
          <div class="review-meta">
            <strong dir="auto">{{ message.sendEmail || address(message) || t('unknown') }}</strong>
            <time>{{ formatDetailDate(message.createTime) }}</time>
          </div>
          <p v-if="message.subject" class="review-subject" dir="auto">{{ message.subject }}</p>
          <p v-if="message.text" class="review-body" dir="auto">{{ message.text }}</p>
        </article>
      </div>
      <p v-else class="review-empty review-pick">{{ t('allMailChooseConversation') }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import ListState from '@/components/list-state.vue';
import { allMailConversations, allMailConversationMessages } from '@/request/all-email.js';
import { formatDetailDate, fromNow } from '@/utils/day.js';

defineOptions({ name: 'all-email' });

const { t } = useI18n();
const route = useRoute();
const threadId = computed(() => {
  const value = route.query.thread;
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
});
const input = ref(''), search = ref('');
const threads = ref([]), messages = ref([]), timeline = ref(null);
const listBefore = ref(null), messageBefore = ref(null);
const listLoading = ref(false), listError = ref('');
const retryListReset = ref(true);
const messageLoading = ref(false), messageError = ref('');
const latest = computed(() => messages.value.at(-1));
let listRequest = 0, messageRequest = 0;

const address = (row) => row.mailbox || row.owner || '';
const title = (row) => row.peers?.join(', ') || row.subject || t('noSubject');
const selected = (row) => row.emailId === threadId.value ||
  !!latest.value && row.accountId === latest.value.accountId && row.userId === latest.value.userId &&
  title(row) === title(latest.value);

async function loadList(reset) {
  const request = ++listRequest;
  const before = reset ? null : listBefore.value;
  retryListReset.value = reset;
  listLoading.value = true;
  try {
    const page = await allMailConversations({ q: search.value, before });
    if (request !== listRequest) return;
    threads.value = before ? [...threads.value, ...page.items] : page.items;
    listBefore.value = page.before;
    listError.value = '';
  } catch {
    if (request === listRequest) listError.value = threads.value.length ? 'stale' : 'failed';
  } finally {
    if (request === listRequest) listLoading.value = false;
  }
}

async function loadThread(reset) {
  const request = ++messageRequest;
  const before = reset ? null : messageBefore.value;
  if (!threadId.value) return;
  messageLoading.value = true;
  try {
    const page = await allMailConversationMessages(threadId.value, before);
    if (request !== messageRequest) return;
    const previousHeight = timeline.value?.scrollHeight || 0;
    messages.value = [...page.items.reverse(), ...(before ? messages.value : [])];
    messageBefore.value = page.before;
    messageError.value = '';
    await nextTick();
    if (request === messageRequest && timeline.value) {
      timeline.value.scrollTop = before
        ? timeline.value.scrollTop + timeline.value.scrollHeight - previousHeight
        : timeline.value.scrollHeight;
    }
  } catch {
    if (request === messageRequest) messageError.value = messages.value.length ? 'stale' : 'failed';
  } finally {
    if (request === messageRequest) messageLoading.value = false;
  }
}

watch(search, () => {
  threads.value = [];
  listError.value = '';
  listBefore.value = null;
  loadList(true);
}, { immediate: true });
watch(threadId, () => {
  messages.value = [];
  messageError.value = '';
  messageBefore.value = null;
  messageLoading.value = false;
  loadThread(true);
}, { immediate: true });
</script>

<style scoped>
.review-mail { display:grid; grid-template-columns:minmax(235px, 325px) minmax(0, 1fr); min-height:0; flex:1; background:var(--el-bg-color-page); }
.review-list,.review-thread { min-width:0; min-height:0; display:flex; flex-direction:column; }
.review-list { background:var(--el-bg-color); border-inline-end:1px solid var(--el-border-color-lighter); }
.review-search,.review-heading { display:flex; align-items:center; gap:7px; padding:8px 12px; min-height:56px; background:var(--el-bg-color); border-bottom:1px solid var(--el-border-color-lighter); }
.review-search input { flex:1; min-width:0; border:1px solid var(--el-border-color); border-radius:10px; padding:8px; background:var(--el-fill-color-lighter); color:var(--el-text-color-primary); font:inherit; }
.review-search button,.review-back { display:grid; place-items:center; flex:none; width:36px; height:40px; border:0; border-radius:8px; background:none; color:var(--el-text-color-primary); }
.review-search button:hover,.review-back:hover { background:var(--el-fill-color); }
.review-list-scroll,.review-timeline { min-height:0; overflow:auto; flex:1; }
.review-item { display:flex; gap:8px; align-items:center; padding:10px 8px; min-width:0; border-radius:10px; text-decoration:none; color:inherit; margin:3px 6px; }
.review-item:hover,.review-item.selected { background:var(--el-color-primary-light-9); }
.review-avatar { border-radius:50%; width:34px; height:34px; display:grid; place-items:center; flex:none; background:var(--el-color-primary-light-8); color:var(--el-color-primary); font-weight:650; }
.review-item-copy,.review-heading-copy { display:grid; min-width:0; flex:1; gap:2px; }
.review-item-copy > *, .review-heading-copy > * { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.review-item-copy > span,.review-item-copy small,.review-heading small,time { font-size:12px; color:var(--el-text-color-secondary); }
.review-item time { align-self:flex-start; font-size:11px; }
.review-timeline { display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:16px clamp(12px, 4vw, 64px); }
.review-bubble { flex:none; width:fit-content; max-width:min(720px, 93%); border:1px solid var(--el-border-color-lighter); border-radius:14px; background:var(--el-bg-color); padding:10px 14px; overflow-wrap:anywhere; }
.review-bubble.outgoing { align-self:flex-end; background:var(--el-color-primary-light-9); }
.review-meta { display:flex; align-items:baseline; gap:4px 12px; flex-wrap:wrap; font-size:12px; }
.review-meta strong { color:var(--el-color-primary); }
.review-body,.review-subject { margin:6px 0; white-space:pre-wrap; }
.review-subject { font-weight:600; }
.review-more { background:none; color:var(--el-color-primary); border:0; font:inherit; padding:7px 0; }
.review-more { display:block; margin:5px auto; }
.review-empty { color:var(--el-text-color-secondary); padding:16px; text-align:center; margin:auto; }
.review-back { display:none; }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .review-mail { display:flex; flex-direction:column; }
  .review-list,.review-thread { flex:1; }
  .review-thread,.has-thread .review-list { display:none; }
  .has-thread .review-thread { display:flex; }
  .review-back { display:grid; }
  .review-search input { font-size:16px; }
}
</style>
