<template>
  <section class="mail-chat" :class="{ 'conversation-open': active }">
    <aside class="conversations">
      <div class="list-title">
        <h2>{{ t('mailChatTitle') }}</h2>
        <el-button v-perm="'email:send'" type="primary" size="small" @click="newOpen = true">{{
          t('mailChatNew')
        }}</el-button>
      </div>
      <el-select
        class="mailbox-select"
        :model-value="accountId"
        :aria-label="t('mailChatMailbox')"
        @change="switchMailbox"
      >
        <el-option v-for="a in accounts" :key="a.accountId" :label="a.email" :value="a.accountId" />
      </el-select>
      <el-input
        class="search"
        v-model="search"
        clearable
        :placeholder="t('mailChatSearch')"
        :aria-label="t('mailChatSearch')"
      />
      <p class="connection" role="status">
        {{ connected ? t('mailChatLive') : t('chatReconnecting') }}
      </p>
      <p v-if="indexing" class="indexing">{{ t('mailChatIndexing') }}</p>
      <div class="conversation-list" v-loading="listLoading">
        <button
          v-for="c in sortedConversations"
          :key="c.key"
          class="contact"
          :class="{ selected: selected?.key === c.key }"
          @click="select(c)"
        >
          <span class="avatar">{{ c.peers[0]?.[0]?.toUpperCase() || '@' }}</span>
          <span class="contact-summary"
            ><span class="peers">{{ c.peers.join(', ') }}</span
            ><span class="preview">{{ c.preview || c.subject }}</span></span
          >
          <span class="contact-meta"
            ><span>{{ shortTime(c.createTime) }}</span
            ><span v-if="c.pinned">★</span
            ><span v-if="c.unread" class="badge">{{ c.unread > 99 ? '99+' : c.unread }}</span></span
          >
        </button>
        <el-empty
          v-if="!listLoading && !conversations.length"
          :description="t('mailChatEmpty')"
          :image-size="70"
        />
        <el-button
          v-if="listHasMore"
          class="load-more"
          text
          :loading="listLoading"
          @click="moreConversations"
          >{{ t('mailChatMoreConversations') }}</el-button
        >
      </div>
    </aside>
    <main v-if="active" class="thread">
      <header class="thread-header">
        <el-button class="back" text :aria-label="t('chatBack')" @click="closeThread"
          ><Icon icon="material-symbols:arrow-back-rounded" width="24"
        /></el-button>
        <div class="thread-title">
          <strong>{{ selected.peers.join(', ') }}</strong
          ><span>{{ connected ? t('mailChatLive') : t('chatReconnecting') }}</span>
        </div>
        <el-button text :aria-label="t('mailChatPin')" @click="togglePin">{{
          selected.pinned ? '★' : '☆'
        }}</el-button>
      </header>
      <div ref="scroll" class="messages" v-loading="messageLoading" @scroll="onScroll">
        <el-button v-if="hasOlder" class="load-more" text :loading="olderLoading" @click="older">{{
          t('chatOlder')
        }}</el-button>
        <template v-for="(m, index) in messages" :key="m.emailId">
          <p
            v-if="index === 0 || date(m.createTime) !== date(messages[index - 1].createTime)"
            class="date-divider"
          >
            {{ date(m.createTime) }}
          </p>
          <article class="mail-message" :class="{ mine: m.type === 1 }">
            <span class="sender">{{ m.name || m.sendEmail }}</span>
            <div class="bubble">
              <p class="subject">{{ m.subject }}</p>
              <p v-if="m.type === 1 && m.message" class="delivery-error">
                {{ deliveryError(m.message) }}
              </p>
              <p class="body-text" :class="{ collapsed: !expanded[m.emailId] }">
                {{ bodySummary(m.text) }}
              </p>
              <el-button
                v-if="m.text.length > 500 || m.truncated"
                text
                size="small"
                @click="expand(m)"
                >{{ expanded[m.emailId] ? t('mailChatCollapse') : t('mailChatExpand') }}</el-button
              >
              <details v-if="quoted(m.text)">
                <summary>{{ t('mailChatQuote') }}</summary>
                <pre>{{ quoted(m.text) }}</pre>
              </details>
              <div v-for="att in m.attachments" :key="att.attId" class="attachment">
                <el-button text @click="download(att)"
                  >{{ att.filename }} · {{ formatBytes(att.size) }}</el-button
                >
              </div>
              <div class="message-actions">
                <el-button text size="small" @click="viewOriginal(m)">{{
                  t('mailChatOriginal')
                }}</el-button
                ><el-button v-perm="'email:send'" text size="small" @click="replyTarget = m">{{
                  t('reply')
                }}</el-button>
              </div>
            </div>
            <div class="message-meta">
              <time>{{ time(m.createTime) }}</time
              ><span v-if="m.type === 1" :class="{ failed: [3, 4, 8].includes(m.status) }">{{
                statusText(m.status)
              }}</span>
            </div>
          </article>
        </template>
      </div>
      <el-button v-if="!atBottom" class="latest" round @click="bottom">{{
        t('chatNewest')
      }}</el-button>
      <form v-if="hasPerm('email:send')" class="composer" @submit.prevent="send">
        <div class="reply-heading">
          <span>{{ t('mailChatReplying') }} {{ target?.subject || selected.subject }}</span
          ><el-checkbox v-if="selected.peers.length > 1" v-model="replyAll">{{
            t('mailChatReplyAll')
          }}</el-checkbox>
        </div>
        <el-input
          v-model="drafts[draftKey]"
          type="textarea"
          :rows="2"
          resize="none"
          maxlength="20000"
          :placeholder="t('mailChatInput')"
          :aria-label="t('mailChatInput')"
          @keydown="keyDown"
        />
        <div class="chosen-files">
          <div v-for="(file, i) in files[draftKey] || []" :key="i" class="chosen-file">
            <span>{{ file.filename }}</span
            ><el-button text @click="files[draftKey].splice(i, 1)">×</el-button>
          </div>
        </div>
        <div class="composer-footer">
          <label class="attach-label"
            >{{ t('mailChatAttach') }}<input type="file" multiple @change="chooseFiles" /></label
          ><span>{{ t('chatEnterHint') }}</span
          ><el-button
            type="primary"
            native-type="submit"
            :loading="sending"
            :disabled="!drafts[draftKey]?.trim() || messageLoading"
            >{{ t('mailChatSend') }}</el-button
          >
        </div>
      </form>
    </main>
    <div v-else class="empty-thread"><el-empty :description="t('mailChatChoose')" /></div>
    <el-dialog v-model="newOpen" :title="t('mailChatNew')" width="min(500px, calc(100% - 24px))">
      <form @submit.prevent="sendNew">
        <p>{{ accounts.find((a) => a.accountId === accountId)?.email }}</p>
        <el-input
          v-model="newMail.to"
          :aria-label="t('mailChatTo')"
          :placeholder="t('mailChatTo')"
        />
        <el-input
          v-model="newMail.subject"
          maxlength="300"
          :aria-label="t('mailChatSubject')"
          :placeholder="t('mailChatSubject')"
        />
        <el-input
          v-model="newMail.text"
          type="textarea"
          :rows="5"
          maxlength="20000"
          :aria-label="t('mailChatInput')"
          :placeholder="t('mailChatInput')"
        />
        <label class="attach-label"
          >{{ t('mailChatAttach')
          }}<input type="file" multiple @change="chooseFiles($event, 'new:' + accountId)"
        /></label>
        <div class="chosen-files">
          <div v-for="(file, i) in files['new:' + accountId] || []" :key="i" class="chosen-file">
            <span>{{ file.filename }}</span
            ><el-button text @click="files['new:' + accountId].splice(i, 1)">×</el-button>
          </div>
        </div>
        <el-button type="primary" native-type="submit" :loading="sending">{{
          t('mailChatSend')
        }}</el-button>
      </form>
    </el-dialog>
    <el-dialog
      v-model="originalOpen"
      :title="t('mailChatOriginal')"
      width="min(800px, calc(100% - 24px))"
    >
      <template v-if="original"
        ><dl class="original-meta">
          <dt>From</dt>
          <dd>{{ original.sendEmail }}</dd>
          <dt>To / Cc</dt>
          <dd>{{ original.recipient }} {{ original.cc }}</dd>
          <dt>Reply-To</dt>
          <dd>{{ original.replyTo }}</dd>
          <dt>Message-ID</dt>
          <dd>{{ original.messageId }}</dd>
          <dt>In-Reply-To</dt>
          <dd>{{ original.inReplyTo }}</dd>
          <dt>References</dt>
          <dd>{{ original.relation }}</dd>
        </dl>
        <h3>{{ original.subject }}</h3>
        <pre class="original-text">{{ original.text }}</pre>
        <iframe
          v-if="original.content"
          class="rich-mail"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
          :srcdoc="richDocument(original.content)"
          :title="t('mailChatRich')"
      /></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/store/user';
import { useAccountStore } from '@/store/account';
import { hasPerm } from '@/perm/perm';
import { accountList } from '@/request/account';
import {
  mailConversations,
  mailMessages,
  mailDetail,
  mailRead,
  mailPin,
  mailSend,
  mailAttachment
} from '@/request/mail-chat';
import { useMailSync } from '@/composables/use-mail-sync';
import { fileToBase64, formatBytes } from '@/utils/file-utils';

const { t } = useI18n();
const user = useUserStore(),
  accountStore = useAccountStore();
const accountId = ref(accountStore.currentAccountId || user.user.account.accountId);
const accounts = ref([user.user.account]);
const conversations = ref([]),
  selected = ref(null),
  messages = ref([]),
  search = ref('');
const active = computed(() => !!selected.value);
const sortedConversations = computed(() =>
  [...conversations.value].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.latestId - a.latestId
  )
);
const draftKey = computed(() => `${accountId.value}:${selected.value?.key || ''}`);
const drafts = reactive({}),
  files = reactive({}),
  expanded = reactive({});
const listLoading = ref(true),
  messageLoading = ref(false),
  olderLoading = ref(false),
  sending = ref(false);
const indexing = ref(false),
  listHasMore = ref(false),
  hasOlder = ref(false),
  atBottom = ref(true),
  scroll = ref(null);
const replyTarget = ref(null),
  replyAll = ref(false),
  target = computed(() => replyTarget.value || messages.value.at(-1));
const newOpen = ref(false),
  newMail = reactive({ to: '', subject: '', text: '' });
const originalOpen = ref(false),
  original = ref(null);
let version = 0,
  stopped = false,
  busy = false,
  dirty = false,
  searchTimer,
  indexTimer;
const pendingRequests = new Map();
const readThrough = new Map();
const { connected } = useMailSync(sync);
const utc = (value) => new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'));
const date = (value) => utc(value).toLocaleDateString();
const time = (value) => utc(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const shortTime = (value) => (value ? date(value) : '');
function parseAddresses(value) {
  try {
    return (JSON.parse(value || '[]') || [])
      .map((a) => (typeof a === 'string' ? a : a.address))
      .filter(Boolean);
  } catch {
    return [];
  }
}
function statusText(status) {
  return t(
    {
      1: 'mailChatAccepted',
      2: 'mailChatDelivered',
      3: 'mailChatBounced',
      4: 'mailChatComplained',
      5: 'mailChatDelayed',
      8: 'mailChatFailed'
    }[status] || 'mailChatAccepted'
  );
}
function deliveryError(value) {
  try {
    const data = JSON.parse(value);
    return String(data.message || data.reason || value);
  } catch {
    return String(value);
  }
}
function splitBody(text = '') {
  const lines = text.split('\n'),
    at = lines.findIndex((line) =>
      /^\s*>|^On .+wrote:|^在.+写道|^--\s*$|^-{2,}\s*(Original Message|原始邮件)/i.test(line)
    );
  return at < 0 ? [text, ''] : [lines.slice(0, at).join('\n'), lines.slice(at).join('\n')];
}
const bodySummary = (text) => splitBody(text)[0] || t('mailChatQuotedOnly');
const quoted = (text) => splitBody(text)[1];
function richDocument(html) {
  return `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:14px sans-serif;overflow-wrap:anywhere}table{max-width:100%}img{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;
}
function closeThread() {
  version++;
  selected.value = null;
  messages.value = [];
  replyTarget.value = null;
  messageLoading.value = false;
}
async function bottom() {
  await nextTick();
  if (scroll.value) {
    scroll.value.scrollTop = scroll.value.scrollHeight;
    atBottom.value = true;
  }
}
function merge(rows) {
  const data = new Map(messages.value.map((m) => [m.emailId, m]));
  rows.forEach((m) => data.set(m.emailId, m));
  const identities = new Set();
  messages.value = [...data.values()]
    .sort((a, b) => a.emailId - b.emailId)
    .filter((m) => {
      const k = m.messageId ? `${m.type}:${m.messageId}` : `id:${m.emailId}`;
      if (identities.has(k)) return false;
      identities.add(k);
      return true;
    });
}
async function markRead() {
  if (!selected.value || !atBottom.value || document.hidden || !messages.value.length) return;
  const current = selected.value;
  const marker = `${accountId.value}:${current.key}`,
    through = messages.value.at(-1).emailId;
  if ((readThrough.get(marker) || 0) >= through) {
    if (current.latestId <= through) {
      current.unread = 0;
      const row = conversations.value.find((c) => c.key === current.key);
      if (row) row.unread = 0;
    }
    return;
  }
  await mailRead({ accountId: accountId.value, key: current.key, through });
  current.unread = 0;
  readThrough.set(marker, through);
  const row = conversations.value.find((c) => c.key === current.key);
  if (row) row.unread = 0;
}
function onScroll() {
  const el = scroll.value;
  if (el) atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  if (atBottom.value) markRead().catch(() => {});
}
async function select(c) {
  const mine = ++version;
  selected.value = c;
  messages.value = [];
  replyTarget.value = null;
  replyAll.value = false;
  messageLoading.value = true;
  atBottom.value = true;
  hasOlder.value = false;
  try {
    const data = await mailMessages({ accountId: accountId.value, key: c.key });
    if (mine !== version || stopped) return;
    merge(data.messages);
    hasOlder.value = data.hasMore;
    await bottom();
    await markRead();
  } catch {
    /* Shared API errors retain the mailbox and draft. */
  } finally {
    if (mine === version) {
      messageLoading.value = false;
      sync();
    }
  }
}
async function sync() {
  if (stopped) return;
  if (busy) {
    dirty = true;
    return;
  }
  busy = true;
  try {
    do {
      dirty = false;
      const a = accountId.value,
        q = search.value;
      const list = await mailConversations({ accountId: a, search: q });
      if (a !== accountId.value || q !== search.value || stopped) {
        dirty = true;
        continue;
      }
      const oldestFresh = Math.min(...list.conversations.map((c) => c.latestId));
      const retained = list.conversations.length
        ? conversations.value.filter(
            (c) => c.latestId < oldestFresh && !list.conversations.some((f) => f.key === c.key)
          )
        : [];
      conversations.value = [...list.conversations, ...retained];
      indexing.value = list.indexing;
      if (!retained.length) listHasMore.value = list.hasMore;
      clearTimeout(indexTimer);
      if (list.indexing) indexTimer = setTimeout(sync, 500);
      const matching =
        selected.value && list.conversations.find((c) => c.key === selected.value.key);
      if (matching) Object.assign(selected.value, matching);
      if (selected.value && !messageLoading.value) {
        const mine = version,
          k = selected.value.key,
          stick = atBottom.value;
        let more;
        do {
          const after = messages.value.at(-1)?.emailId;
          const data = await mailMessages({ accountId: a, key: k, ...(after ? { after } : {}) });
          if (mine !== version || stopped) break;
          merge(data.messages);
          if (!after) hasOlder.value = data.hasMore;
          more = !!after && data.hasMore;
        } while (more);
        if (mine === version && !stopped) {
          const recent = await mailMessages({ accountId: a, key: k });
          if (mine === version && !stopped) merge(recent.messages);
        }
        if (mine === version && !stopped) {
          if (stick) await bottom();
          await markRead();
        }
      }
    } while (dirty && !stopped);
  } catch {
    /* Next push or periodic reconciliation retries. */
  } finally {
    busy = false;
    listLoading.value = false;
  }
}
async function moreConversations() {
  if (listLoading.value || !conversations.value.length) return;
  listLoading.value = true;
  const a = accountId.value,
    q = search.value;
  try {
    const data = await mailConversations({
      accountId: a,
      search: q,
      before: Math.min(...conversations.value.map((c) => c.latestId))
    });
    if (a !== accountId.value || q !== search.value) return;
    const map = new Map(conversations.value.map((c) => [c.key, c]));
    data.conversations.forEach((c) => map.set(c.key, c));
    conversations.value = [...map.values()];
    listHasMore.value = data.hasMore;
  } catch {
  } finally {
    listLoading.value = false;
  }
}
async function older() {
  if (olderLoading.value || !messages.value.length) return;
  olderLoading.value = true;
  const mine = version,
    el = scroll.value,
    top = el.scrollTop,
    height = el.scrollHeight;
  try {
    const data = await mailMessages({
      accountId: accountId.value,
      key: selected.value.key,
      before: messages.value[0].emailId
    });
    if (mine !== version || stopped) return;
    merge(data.messages);
    hasOlder.value = data.hasMore;
    await nextTick();
    el.scrollTop = top + el.scrollHeight - height;
    onScroll();
  } catch {
  } finally {
    olderLoading.value = false;
  }
}
async function expand(m) {
  if (expanded[m.emailId]) {
    expanded[m.emailId] = false;
    return;
  }
  try {
    if (m.truncated) {
      const data = await mailDetail(m.emailId);
      m.text = data.text;
      m.truncated = false;
    }
    expanded[m.emailId] = true;
  } catch {}
}
async function viewOriginal(m) {
  try {
    original.value = await mailDetail(m.emailId);
    originalOpen.value = true;
  } catch {}
}
async function download(att) {
  try {
    const blob = await mailAttachment(att.attId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.filename || 'attachment';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    ElMessage.error(e.message);
  }
}
async function togglePin() {
  const c = selected.value;
  try {
    await mailPin({ accountId: accountId.value, key: c.key, pinned: !c.pinned });
    c.pinned = !c.pinned;
    await sync();
  } catch {}
}
function switchMailbox(value) {
  closeThread();
  accountId.value = value;
  accountStore.currentAccountId = value;
  accountStore.currentAccount = accounts.value.find((a) => a.accountId === value);
  conversations.value = [];
  listLoading.value = true;
  search.value = '';
  sync();
}
async function chooseFiles(event, current = draftKey.value) {
  const chosen = [...event.target.files];
  event.target.value = '';
  const existing = files[current] || [];
  if (
    existing.length + chosen.length > 10 ||
    existing.reduce((n, f) => n + f.size, 0) + chosen.reduce((n, f) => n + f.size, 0) >
      10 * 1024 * 1024
  ) {
    ElMessage.error(t('mailChatFileLimit'));
    return;
  }
  try {
    const added = await Promise.all(
      chosen.map(async (f) => ({
        filename: f.name,
        size: f.size,
        contentType: f.type || 'application/octet-stream',
        content: await fileToBase64(f)
      }))
    );
    files[current] = [...existing, ...added];
  } catch {
    ElMessage.error(t('mailChatFileError'));
  }
}
function keyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    send();
  }
}
async function deliver(payload, context, intent) {
  let pending = pendingRequests.get(context);
  if (!pending || pending.intent !== intent) {
    pending = { intent, payload, clientId: crypto.randomUUID() };
    pendingRequests.set(context, pending);
  }
  // Notifications may change the default reply target during a lost response.
  // Retrying an unchanged draft must reuse the original payload and request ID.
  const result = await mailSend({ ...pending.payload, clientId: pending.clientId });
  pendingRequests.delete(context);
  return result;
}
async function showSent(account, result) {
  if (stopped || accountId.value !== account) return;
  search.value = '';
  const data = await mailConversations({ accountId: account });
  if (stopped || accountId.value !== account) return;
  conversations.value = data.conversations;
  listHasMore.value = data.hasMore;
  const sentConversation = data.conversations.find((c) => c.key === result.conversationKey);
  if (sentConversation) await select(sentConversation);
}
async function send() {
  if (sending.value || !drafts[draftKey.value]?.trim() || !target.value) return;
  const account = accounts.value.find((a) => a.accountId === accountId.value),
    m = target.value,
    current = draftKey.value,
    a = accountId.value;
  const peer =
    m.type === 0
      ? parseAddresses(m.replyTo).length
        ? parseAddresses(m.replyTo)
        : [m.sendEmail]
      : parseAddresses(m.recipient);
  const recipients = replyAll.value
    ? [...new Set([...peer, ...parseAddresses(m.recipient), ...parseAddresses(m.cc)])].filter(
        (e) => e.toLowerCase() !== account.email.toLowerCase()
      )
    : peer;
  const text = drafts[current];
  sending.value = true;
  const intent = JSON.stringify({
    text,
    attachments: files[current] || [],
    replyAll: replyAll.value,
    explicitReply: replyTarget.value?.emailId || null
  });
  try {
    const result = await deliver(
      {
        accountId: a,
        replyId: m.emailId,
        recipients,
        subject: /^re:/i.test(m.subject || '')
          ? m.subject
          : `Re: ${m.subject || t('mailChatDefaultSubject')}`,
        text,
        attachments: files[current] || []
      },
      current,
      intent
    );
    if (drafts[current] === text) drafts[current] = '';
    files[current] = [];
    await showSent(a, result);
  } catch {
  } finally {
    sending.value = false;
  }
}
async function sendNew() {
  if (sending.value) return;
  sending.value = true;
  const a = accountId.value;
  const context = `new:${a}`,
    payload = {
      accountId: a,
      recipients: newMail.to.split(/[,;，；\s]+/).filter(Boolean),
      subject: newMail.subject,
      text: newMail.text,
      attachments: files[context] || []
    };
  try {
    const result = await deliver(payload, context, JSON.stringify(payload));
    newOpen.value = false;
    files[context] = [];
    Object.assign(newMail, { to: '', subject: '', text: '' });
    await showSent(a, result);
  } catch {
  } finally {
    sending.value = false;
  }
}
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    conversations.value = [];
    sync();
  }, 300);
});
onMounted(async () => {
  if (hasPerm('account:query')) {
    try {
      let all = [],
        cursor = 0,
        sort;
      for (let page = 0; page < 20; page++) {
        const rows = await accountList(cursor, 50, sort);
        all.push(...rows);
        if (rows.length < 50) break;
        cursor = rows.at(-1).accountId;
        sort = rows.at(-1).sort;
      }
      if (!stopped) accounts.value = all.filter((a) => a.status === 0);
    } catch {}
  }
  sync();
});
onBeforeUnmount(() => {
  stopped = true;
  version++;
  clearTimeout(searchTimer);
  clearTimeout(indexTimer);
});
</script>

<style scoped lang="scss">
.composer {
  max-height: 60%;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.chosen-files {
  max-height: 96px;
  overflow-y: auto;
}
.delivery-error {
  color: var(--el-color-danger);
  font-size: 12px;
  overflow-wrap: anywhere;
  margin-bottom: 8px;
}
:deep(.el-dialog h3) {
  overflow-wrap: anywhere;
}
.mail-chat {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.conversations {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--el-border-color);
}
.list-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px;
  gap: 8px;
  h2 {
    font-size: 16px;
  }
}
.mailbox-select,
.search {
  margin: 0 12px 10px;
  width: calc(100% - 24px);
}
.connection,
.indexing {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 0 12px 10px;
}
.conversation-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
}
.contact {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 12px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.contact:hover,
.contact.selected {
  background: var(--el-fill-color-light);
}
.avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  justify-content: center;
  align-items: center;
}
.contact-summary {
  display: grid;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.peers,
.preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview,
.contact-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.contact-meta {
  display: grid;
  justify-items: end;
  gap: 4px;
  flex-shrink: 0;
}
.badge {
  background: var(--el-color-danger);
  color: white;
  border-radius: 12px;
  padding: 0 6px;
}
.load-more {
  display: block;
  margin: 8px auto;
}
.thread {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  min-width: 0;
}
.thread-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 60px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color);
}
.thread-title {
  flex: 1;
  min-width: 0;
  strong {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}
.back {
  display: none;
}
.messages {
  min-height: 0;
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0 20px 16px;
}
.date-divider {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin: 16px;
}
.mail-message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 16px 0;
  min-width: 0;
}
.sender {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}
.bubble {
  max-width: 85%;
  padding: 12px 14px;
  border-radius: 12px 12px 12px 2px;
  background: var(--el-fill-color);
  min-width: 0;
}
.subject {
  font-size: 12px;
  opacity: 0.75;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 6px;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
}
.body-text,
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}
.body-text.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
}
.message-meta {
  display: flex;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-top: 4px;
}
.failed {
  color: var(--el-color-danger);
}
.mail-message.mine {
  align-items: flex-end;
  .bubble {
    background: var(--el-color-primary-light-9);
    border-radius: 12px 12px 2px 12px;
  }
}
details {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  summary {
    cursor: pointer;
  }
  pre {
    margin-top: 8px;
  }
}
.attachment {
  max-width: 100%;
  .el-button {
    max-width: 100%;
    height: auto;
    white-space: normal;
    text-align: left;
    overflow-wrap: anywhere;
  }
}
.composer {
  border-top: 1px solid var(--el-border-color);
  padding: 10px 16px;
  flex-shrink: 0;
}
.reply-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.composer-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  margin-top: 8px;
  > span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}
.attach-label {
  color: var(--el-color-primary);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
}
.chosen-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
.empty-thread {
  display: flex;
  align-items: center;
  justify-content: center;
}
.latest {
  position: absolute;
  right: 16px;
  bottom: 180px;
}
.original-meta {
  font-size: 12px;
  dt {
    font-weight: bold;
    margin-top: 8px;
  }
  dd {
    overflow-wrap: anywhere;
  }
}
.original-text {
  margin: 15px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 300px;
  overflow: auto;
}
.rich-mail {
  width: 100%;
  height: 400px;
  border: 1px solid var(--el-border-color);
  background: white;
}
:deep(.el-dialog form) {
  display: grid;
  gap: 12px;
}
@media (max-width: 767px) {
  .mail-chat {
    grid-template-columns: minmax(0, 1fr);
  }
  .empty-thread,
  .conversation-open .conversations {
    display: none;
  }
  .conversations {
    border-right: 0;
  }
  .back {
    display: inline-flex;
    padding: 8px;
  }
  .thread-header {
    padding: 8px;
  }
  .messages {
    padding: 0 12px 12px;
  }
  .bubble {
    max-width: 94%;
  }
  .composer {
    padding: 8px 12px;
  }
  .composer :deep(textarea) {
    font-size: 16px;
  }
  .composer-footer > span {
    display: none;
  }
}
</style>
