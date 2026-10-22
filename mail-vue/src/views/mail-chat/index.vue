<template>
  <section class="mail-chat" :class="{ 'conversation-open': active }">
    <aside class="conversations">
      <div class="list-title">
        <h2>{{ t('mailChatTitle') }}</h2>
        <el-button
          text
          size="small"
          @click="
            friendsOpen = true;
            loadFriends();
          "
          >{{ t('mailChatContacts') }}</el-button
        >
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
          <span class="avatar" translate="no">{{ c.peers[0]?.[0]?.toUpperCase() || '@' }}</span>
          <span class="contact-summary"
            ><span class="peers" translate="no">{{ c.peers.join(', ') }}</span
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
      <header
        class="thread-header"
        @contextmenu="openMessageMenu($event, null)"
        @pointerdown="startPress($event, null)"
        @pointermove="movePress"
        @pointerup="cancelPress"
        @pointercancel="cancelPress"
      >
        <el-button class="back" text :aria-label="t('chatBack')" @click="closeThread"
          ><Icon icon="material-symbols:arrow-back-rounded" width="24"
        /></el-button>
        <div class="thread-title">
          <strong translate="no">{{ selected.peers.join(', ') }}</strong
          ><span v-if="live.internal" class="live-status" :class="{ online: live.online }">{{
            live.typing
              ? t('mailChatTyping')
              : live.online
                ? t('mailChatOnline')
                : t('mailChatOffline')
          }}</span>
          <span v-else>{{ connected ? t('mailChatLive') : t('chatReconnecting') }}</span>
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
            v-if="showChatTime(m.createTime, messages[index - 1]?.createTime)"
            class="date-divider"
          >
            {{ chatTimeLabel(m.createTime, locale) }}
          </p>
          <article
            v-if="
              (m.replyText ?? m.text)?.trim() ||
              m.images?.length ||
              m.attachments?.length ||
              m.message ||
              m.richHtml
            "
            class="mail-message"
            :class="{ mine: m.type === 1, external: !isChat(m) }"
            :data-email-id="m.emailId"
          >
            <div
              class="bubble"
              :class="{ 'internal-bubble': isChat(m) }"
              :tabindex="m.internal ? 0 : undefined"
              @contextmenu="openMessageMenu($event, m)"
              @pointerdown="startPress($event, m)"
              @pointermove="movePress"
              @pointerup="cancelPress"
              @pointercancel="cancelPress"
              @keydown.shift.f10.prevent="openMessageMenu($event, m)"
              @keydown.esc="closeMenu"
              @click.capture="suppressAfterPress"
            >
              <h3 v-if="!isChat(m)" class="external-subject">{{ m.subject }}</h3>
              <MailBody
                v-if="m.richHtml"
                :html="m.richHtml"
                :images="m.richImages"
                :title="m.subject"
              />
              <template v-else>
                <button
                  v-if="m.quote"
                  class="quote-card"
                  type="button"
                  @click="jumpToQuote(m.quote)"
                >
                  <strong translate="no">{{ m.quote.author }}</strong
                  ><span>{{ m.quote.text }}</span>
                </button>
                <p v-if="m.type === 1 && m.message" class="delivery-error">
                  {{ deliveryError(m.message) }}
                </p>
                <p
                  v-if="m.replyText ?? m.text"
                  class="body-text"
                  :class="{ collapsed: isChat(m) && !expanded[m.emailId] }"
                >
                  {{ m.replyText ?? m.text }}
                </p>
                <el-button
                  v-if="(isChat(m) && (m.replyText ?? m.text).length > 500) || m.truncated"
                  text
                  size="small"
                  @click="expand(m)"
                  >{{
                    expanded[m.emailId] ? t('mailChatCollapse') : t('mailChatExpand')
                  }}</el-button
                >
              </template>
              <div
                v-for="image in m.images || []"
                :key="image.attId || image.src"
                class="inline-image"
              >
                <el-image
                  v-if="image.src || imageUrls[image.attId]"
                  :src="image.src || imageUrls[image.attId]"
                  @click="imagePreview = image.src || imageUrls[image.attId]"
                  @keydown.enter="imagePreview = image.src || imageUrls[image.attId]"
                  role="button"
                  tabindex="0"
                  fit="contain"
                  :alt="image.alt"
                  referrerpolicy="no-referrer"
                  @load="imageLoaded"
                >
                  <template #error
                    ><span>{{ t('mailChatImageError') }}</span></template
                  >
                </el-image>
                <el-button
                  v-else-if="imageErrors[image.attId]"
                  text
                  @click="loadImage(image.attId)"
                  >{{ t('mailChatImageRetry') }}</el-button
                >
                <span v-else>{{ t('mailChatImageLoading') }}</span>
              </div>
              <div v-for="att in m.attachments" :key="att.attId" class="attachment">
                <el-button text @click="download(att)"
                  >{{ att.filename }} · {{ formatBytes(att.size) }}</el-button
                >
              </div>
            </div>
            <span
              v-if="live.internal && m.type === 1 && m.read !== undefined"
              class="read-receipt"
              >{{ m.read ? t('mailChatRead') : t('mailChatUnread') }}</span
            >
            <div v-if="m.type === 1 && [3, 4, 5, 8].includes(m.status)" class="message-meta">
              <span :class="{ failed: [3, 4, 8].includes(m.status) }">{{
                statusText(m.status)
              }}</span>
            </div>
          </article>
        </template>
      </div>
      <el-button v-if="!atBottom" class="latest" round @click="bottom">{{
        t('chatNewest')
      }}</el-button>
      <form v-if="canSend" class="composer" @submit.prevent="send">
        <div v-if="quoteTarget" class="compose-quote">
          <div>
            <strong
              >{{ t('mailChatQuoteReply') }} ·
              <span translate="no">{{ quoteTarget.sendEmail }}</span></strong
            >
            <p>{{ quoteTarget.replyText || '🖼' }}</p>
          </div>
          <el-button text :aria-label="t('mailChatCancelQuote')" @click="quoteTarget = null"
            >×</el-button
          >
        </div>
        <div v-if="selected.peers.length > 1" class="reply-heading">
          <el-checkbox v-model="replyAll">{{ t('mailChatReplyAll') }}</el-checkbox>
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
          @input="liveInput"
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
            :disabled="(!drafts[draftKey]?.trim() && !files[draftKey]?.length) || messageLoading"
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
    <el-drawer v-model="friendsOpen" :title="t('mailChatContacts')" size="min(420px, 100%)">
      <form class="friend-request" @submit.prevent="addFriend">
        <el-input v-model="friendEmail" :placeholder="t('mailChatFriendEmail')" /><el-button
          native-type="submit"
          type="primary"
          >{{ t('mailChatAddFriend') }}</el-button
        >
      </form>
      <div v-for="friend in friends" :key="friend.id" class="friend-row">
        <span translate="no">{{ friend.email }}</span>
        <template v-if="friend.status === 'accepted'"
          ><el-button text @click="openFriend(friend)">{{
            t('mailChatOpenChat')
          }}</el-button></template
        >
        <template v-else-if="friend.requesterId !== user.user.userId"
          ><el-button text @click="answerFriend(friend, true)">{{ t('mailChatAccept') }}</el-button
          ><el-button text @click="answerFriend(friend, false)">{{
            t('mailChatDecline')
          }}</el-button></template
        >
        <span v-else>{{ t('mailChatPending') }}</span>
      </div>
    </el-drawer>
    <Teleport to="body">
      <div
        v-if="messageMenu"
        class="mail-menu-backdrop"
        @pointerdown="closeMenu"
        @contextmenu.prevent="closeMenu"
      >
        <div
          class="mail-message-menu"
          role="menu"
          :style="{ left: messageMenu.x + 'px', top: messageMenu.y + 'px' }"
          @pointerdown.stop
          @contextmenu.prevent
        >
          <button v-if="messageMenu.message" role="menuitem" @click="menuAction('copy')">
            {{ t('mailChatCopy') }}
          </button>
          <button
            v-if="messageMenu.message && canSend"
            role="menuitem"
            @click="menuAction('quote')"
          >
            {{ t('mailChatQuoteReply') }}
          </button>
          <button
            v-if="messageMenu.message"
            role="menuitem"
            class="danger"
            @click="menuAction('delete')"
          >
            {{ t('mailChatDeleteBoth') }}
          </button>
          <button
            v-if="messages.length"
            role="menuitem"
            class="danger"
            @click="menuAction('clear')"
          >
            {{ t('mailChatClearBoth') }}
          </button>
        </div>
      </div>
    </Teleport>
    <el-dialog
      :model-value="!!imagePreview"
      @close="imagePreview = ''"
      class="image-preview"
      width="min(900px, calc(100% - 24px))"
      :title="t('mailChatImage')"
    >
      <img :src="imagePreview" :alt="t('mailChatImage')" referrerpolicy="no-referrer" />
    </el-dialog>
  </section>
</template>

<script setup>
import { randomUUID } from '@/utils/uuid';

import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import MailBody from '@/components/mail-body.vue';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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
  mailAttachment,
  mailRemoveBoth,
  mailOpen,
  mailInstant
} from '@/request/mail-chat';
import { useMailLive } from '@/composables/use-mail-live';
import { listFriends, requestFriend, respondFriend } from '@/request/chat';
import { useMailSync } from '@/composables/use-mail-sync';
import { fileToBase64, formatBytes } from '@/utils/file-utils';
import { mailDate, showChatTime, chatTimeLabel } from '@/utils/mail-chat-display';

const { t, locale } = useI18n();
const user = useUserStore(),
  accountStore = useAccountStore();
const accountId = ref(accountStore.currentAccountId || user.user.account.accountId);
const accounts = ref([user.user.account]);
const conversations = ref([]),
  selected = ref(null),
  messages = ref([]),
  search = ref('');
const active = computed(() => !!selected.value);
const isChat = (message) => message.chatStyle ?? message.internal;
const sortedConversations = computed(() =>
  [...conversations.value].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (b.createTime ? mailDate(b.createTime).getTime() : 0) -
        (a.createTime ? mailDate(a.createTime).getTime() : 0) ||
      b.latestId - a.latestId
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
const quoteTarget = ref(null);
const replyAll = ref(false),
  target = computed(
    () =>
      quoteTarget.value ||
      messages.value[messages.value.length - 1] ||
      (selected.value
        ? {
            type: 1,
            recipient: JSON.stringify(selected.value.peers),
            subject: t('mailChatDefaultSubject')
          }
        : null)
  );
const newOpen = ref(false),
  newMail = reactive({ to: '', subject: '', text: '' });
let version = 0,
  stopped = false,
  busy = false,
  dirty = false,
  searchTimer,
  indexTimer;
const messageMenu = ref(null);
let pressTimer,
  pressStart,
  suppressUntil = 0;
function closeMenu() {
  messageMenu.value = null;
}
function cancelPress() {
  clearTimeout(pressTimer);
  pressStart = null;
}
function startPress(event, message) {
  if (!live.value.internal || event.pointerType !== 'touch') return;
  cancelPress();
  pressStart = { x: event.clientX, y: event.clientY };
  pressTimer = setTimeout(() => {
    suppressUntil = Date.now() + 800;
    openMessageMenu(event, message);
  }, 550);
}
function movePress(event) {
  if (pressStart && Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10)
    cancelPress();
}
function suppressAfterPress(event) {
  if (Date.now() < suppressUntil) {
    event.preventDefault();
    event.stopPropagation();
  }
}
function openMessageMenu(event, message) {
  if (!live.value.internal) return;
  event.preventDefault();
  cancelPress();
  const box = event.currentTarget?.getBoundingClientRect();
  const x = event.clientX || box?.left || 16,
    y = event.clientY || box?.top || 80;
  messageMenu.value = {
    message,
    x: Math.max(8, Math.min(x, innerWidth - 210)),
    y: Math.max(8, Math.min(y, innerHeight - 190))
  };
}
async function menuAction(action) {
  const message = messageMenu.value?.message;
  closeMenu();
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(message.replyText || message.text || '');
    } catch {}
    return;
  }
  if (action === 'quote') quoteMessage(message);
  else if (action === 'delete') removeBoth(message);
  else if (action === 'clear') removeBoth();
}
function menuEscape(event) {
  if (event.key === 'Escape') closeMenu();
}
const imagePreview = ref('');
const imageUrls = reactive({}),
  imageErrors = reactive({});
const imageRequests = new Set();
async function loadImage(id) {
  if (imageUrls[id] || imageRequests.has(id)) return;
  imageRequests.add(id);
  delete imageErrors[id];
  try {
    const blob = await mailAttachment(id);
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    // Sniff raster formats; never display active SVG/HTML from an attachment.
    const mime =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
        ? 'image/png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? 'image/jpeg'
          : String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)
            ? 'image/gif'
            : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
                String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
              ? 'image/webp'
              : '';
    if (!mime) throw new Error('Invalid image');
    if (!stopped) imageUrls[id] = URL.createObjectURL(new Blob([blob], { type: mime }));
  } catch {
    if (!stopped) imageErrors[id] = true;
  } finally {
    imageRequests.delete(id);
  }
}
function imageLoaded() {
  if (atBottom.value) bottom();
}
watch(
  messages,
  (rows) => {
    for (const row of rows)
      for (const image of row.images || []) if (image.attId) loadImage(image.attId);
  },
  { deep: true }
);
const pendingRequests = new Map();
const readThrough = new Map();
const { connected } = useMailSync(sync);
const { live, refreshLive, liveInput, stopTyping } = useMailLive(accountId, selected, connected);
const canSend = computed(() => hasPerm('email:send') || live.value.friend);
const friendsOpen = ref(false),
  friends = ref([]),
  friendEmail = ref('');
const revisions = new Map();
function applyMessages(data) {
  const marker = `${accountId.value}:${selected.value?.key}`;
  if (revisions.has(marker) && revisions.get(marker) !== data.revision) {
    messages.value = [];
    quoteTarget.value = null;
    readThrough.delete(marker);
    hasOlder.value = !!data.hasMore;
    imagePreview.value = '';
    for (const [id, url] of Object.entries(imageUrls)) {
      URL.revokeObjectURL(url);
      delete imageUrls[id];
    }
  }
  revisions.set(marker, data.revision);
  merge(data.messages);
}
async function loadFriends() {
  try {
    friends.value = await listFriends();
  } catch {}
}
async function addFriend() {
  try {
    await requestFriend(friendEmail.value);
    friendEmail.value = '';
    await loadFriends();
  } catch {}
}
async function answerFriend(friend, accept) {
  try {
    await respondFriend(friend.id, accept);
    await loadFriends();
  } catch {}
}
async function openFriend(friend) {
  try {
    const c = await mailOpen({ accountId: accountId.value, email: friend.email });
    if (!conversations.value.some((r) => r.key === c.key)) conversations.value.push(c);
    friendsOpen.value = false;
    await select(c);
  } catch {}
}
async function removeBoth(message) {
  const a = accountId.value,
    k = selected.value?.key,
    v = version;
  if (!k || !messages.value.length) return;
  const through = messages.value[messages.value.length - 1].emailId;
  try {
    await ElMessageBox.confirm(
      t(message ? 'mailChatDeleteBothConfirm' : 'mailChatClearBothConfirm'),
      t('mailChatDeleteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('mailChatConfirmDelete'),
        cancelButtonText: t('mailChatCancelDelete')
      }
    );
    if (a !== accountId.value || k !== selected.value?.key || v !== version) return;
    await mailRemoveBoth({
      accountId: a,
      key: k,
      through,
      ...(message ? { emailId: message.emailId } : {})
    });
    stopTyping();
    await sync();
  } catch {}
}
const utc = mailDate;
const date = (value) => utc(value).toLocaleDateString();
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
function quoteMessage(message) {
  if (!canSend.value) return;
  quoteTarget.value = message;
  nextTick(() => document.querySelector('.composer textarea')?.focus());
}
function jumpToQuote(quote) {
  const found = messages.value.find((message) => message.messageId === quote.messageId);
  if (found) {
    const el = scroll.value?.querySelector(`[data-email-id="${found.emailId}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
function closeThread() {
  closeMenu();
  cancelPress();
  quoteTarget.value = null;
  version++;
  selected.value = null;
  messages.value = [];
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
    .sort((a, b) => utc(a.createTime) - utc(b.createTime) || a.emailId - b.emailId)
    .filter((m) => {
      const k = m.messageId ? `${m.type}:${m.messageId}` : `id:${m.emailId}`;
      if (identities.has(k)) return false;
      identities.add(k);
      return true;
    });
}
async function markRead() {
  if (
    !selected.value ||
    !atBottom.value ||
    document.hidden ||
    friendsOpen.value ||
    newOpen.value ||
    imagePreview.value ||
    !messages.value.length
  )
    return;
  const current = selected.value;
  const marker = `${accountId.value}:${current.key}`,
    through = Math.max(...messages.value.map((m) => m.emailId));
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
  closeMenu();
  cancelPress();
  const el = scroll.value;
  if (el) atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  if (atBottom.value) markRead().catch(() => {});
}
async function select(c) {
  closeMenu();
  cancelPress();
  quoteTarget.value = null;
  const mine = ++version;
  selected.value = c;
  messages.value = [];
  replyAll.value = false;
  messageLoading.value = true;
  atBottom.value = true;
  hasOlder.value = false;
  try {
    const data = await mailMessages({ accountId: accountId.value, key: c.key });
    if (mine !== version || stopped) return;
    applyMessages(data);
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
      const oldestFresh = list.conversations[list.conversations.length - 1];
      const retained = list.conversations.length
        ? conversations.value.filter(
            (c) =>
              c.createTime &&
              (utc(c.createTime) < utc(oldestFresh.createTime) ||
                (utc(c.createTime).getTime() === utc(oldestFresh.createTime).getTime() &&
                  c.latestId < oldestFresh.latestId)) &&
              !list.conversations.some((f) => f.key === c.key)
          )
        : [];
      conversations.value = [
        ...list.conversations,
        ...retained.filter((c) => !list.removedKeys?.includes(c.key)),
        ...(list.contacts || []).filter(
          (c) =>
            !list.conversations.some((r) => r.key === c.key) &&
            !retained.some((r) => r.key === c.key)
        )
      ];
      indexing.value = list.indexing;
      if (!retained.length) listHasMore.value = list.hasMore;
      clearTimeout(indexTimer);
      if (list.indexing) indexTimer = setTimeout(sync, 500);
      const matching =
        selected.value && list.conversations.find((c) => c.key === selected.value.key);
      if (matching) Object.assign(selected.value, matching);
      await refreshLive();
      if (friendsOpen.value) await loadFriends();
      if (selected.value && !messageLoading.value) {
        const mine = version,
          k = selected.value.key,
          stick = atBottom.value;
        let more;
        do {
          const after = messages.value[messages.value.length - 1]?.emailId;
          const data = await mailMessages({ accountId: a, key: k, ...(after ? { after } : {}) });
          if (mine !== version || stopped) break;
          applyMessages(data);
          if (!after) hasOlder.value = data.hasMore;
          more = !!after && data.hasMore;
        } while (more);
        if (mine === version && !stopped) {
          const recent = await mailMessages({ accountId: a, key: k });
          if (mine === version && !stopped) applyMessages(recent);
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
      before: [...conversations.value]
        .filter((c) => c.latestId > 0)
        .sort((a, b) => utc(a.createTime) - utc(b.createTime) || a.latestId - b.latestId)[0]
        ?.latestId
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
    applyMessages(data);
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
      m.replyText = isChat(m) ? data.replyText : data.text;
      m.truncated = false;
    }
    expanded[m.emailId] = true;
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
    pending = { intent, payload, clientId: randomUUID() };
    pendingRequests.set(context, pending);
  }
  // Notifications may change the default reply target during a lost response.
  // Retrying an unchanged draft must reuse the original payload and request ID.
  const sendRequest = pending.payload.instant ? mailInstant : mailSend;
  const result = await sendRequest({ ...pending.payload, clientId: pending.clientId });
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
  if (
    sending.value ||
    (!drafts[draftKey.value]?.trim() && !files[draftKey.value]?.length) ||
    !target.value
  )
    return;
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
  const text = drafts[current] || '';
  sending.value = true;
  const intent = JSON.stringify({
    text,
    attachments: files[current] || [],
    replyAll: replyAll.value,
    quoteId: quoteTarget.value?.emailId || null,
    instant: !!live.value.friend
  });
  try {
    const result = await deliver(
      {
        accountId: a,
        instant: !!live.value.friend,
        replyId: m.emailId,
        quote: !!quoteTarget.value,
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
    quoteTarget.value = null;
    stopTyping();
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
  document.addEventListener('keydown', menuEscape);
  if (hasPerm('account:query')) {
    try {
      let all = [],
        cursor = 0,
        sort;
      for (let page = 0; page < 20; page++) {
        const rows = await accountList(cursor, 50, sort);
        all.push(...rows);
        if (rows.length < 50) break;
        cursor = rows[rows.length - 1].accountId;
        sort = rows[rows.length - 1].sort;
      }
      if (!stopped) accounts.value = all.filter((a) => a.status === 0);
    } catch {}
  }
  sync();
});
onBeforeUnmount(() => {
  cancelPress();
  document.removeEventListener('keydown', menuEscape);
  Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
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
.bubble {
  max-width: min(72%, 640px);
  padding: 12px 14px;
  border-radius: 12px 12px 12px 2px;
  background: var(--el-fill-color);
  min-width: 0;
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
.external .bubble {
  width: min(100%, 850px);
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
}
.external .body-text,
.external .bubble > .el-button,
.external .attachment {
  margin: 12px 16px;
}
.external-subject {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  overflow-wrap: anywhere;
}
.internal-bubble {
  -webkit-touch-callout: none;
}
@media (pointer: coarse) {
  .internal-bubble {
    -webkit-user-select: none;
    user-select: none;
  }
}
:global(.mail-menu-backdrop) {
  position: fixed;
  inset: 0;
  z-index: 4000;
}
:global(.mail-message-menu) {
  position: fixed;
  width: 200px;
  border-radius: 9px;
  padding: 5px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  box-shadow: var(--el-box-shadow);
}
:global(.mail-message-menu button) {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
}
:global(.mail-message-menu button:hover) {
  background: var(--el-fill-color);
}
:global(.mail-message-menu button.danger) {
  color: var(--el-color-danger);
}
.read-receipt {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 3px;
}
.live-status.online {
  color: #20a162;
}
.friend-request {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.friend-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.quote-action {
  opacity: 0;
  height: 22px;
  margin-top: 2px;
}
.mail-message:hover .quote-action,
.mail-message:focus-within .quote-action {
  opacity: 1;
}
@media (hover: none) {
  .quote-action {
    opacity: 1;
  }
}
.quote-card,
.compose-quote {
  background: rgba(0, 0, 0, 0.055);
  border: 0;
  border-radius: 5px;
  padding: 8px 10px;
  text-align: left;
  color: inherit;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.quote-card {
  display: block;
  margin-bottom: 8px;
  cursor: pointer;
}
.quote-card strong,
.quote-card span {
  display: block;
  font-size: 12px;
}
.quote-card span {
  white-space: pre-wrap;
  max-height: 54px;
  overflow: hidden;
  margin-top: 4px;
}
.compose-quote {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.compose-quote > div {
  min-width: 0;
}
.compose-quote p {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    background: #95ec69;
    color: #161616;
    border-radius: 12px 12px 2px 12px;
  }
}
:deep(.image-preview img) {
  display: block;
  max-width: 100%;
  max-height: 75dvh;
  margin: auto;
  object-fit: contain;
}
.inline-image {
  margin: 6px 0;
  max-width: 100%;
  .el-image {
    cursor: zoom-in;
    display: block;
    max-width: 100%;
    width: 320px;
  }
  :deep(img) {
    max-height: 360px;
    object-fit: contain;
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
