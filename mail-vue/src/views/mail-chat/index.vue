<template>
  <section class="mail-chat" :class="{ 'conversation-open': active }">
    <aside class="conversations">
      <div ref="contactScroll" class="conversation-list" @scroll.passive="contactListScroll" @keydown.home="restoreContactControls">
      <div v-if="compactChat" ref="contactHeaderHost" class="contact-header-host"></div>
      <div ref="contactControls" class="contact-controls">
      <el-input
        class="search"
        v-model="search"
        clearable
        :placeholder="t('mailChatSearch')"
        :aria-label="t('mailChatSearch')"
      >
        <template #prefix><Icon icon="cloud-mail:search" width="18" /></template>
        <template #suffix>
          <el-dropdown trigger="click" placement="bottom-end">
            <el-button class="search-actions" text :aria-label="t('mailChatNew')"><span aria-hidden="true">＋</span></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="newOpen = true">{{ t('mailChatNew') }}</el-dropdown-item>
                <el-dropdown-item @click="friendsOpen = true; loadFriends()">{{ t('mailChatContacts') }}</el-dropdown-item>
                <el-dropdown-item @click="router.push('/settings')">{{ t('profile') }}</el-dropdown-item>
                <el-dropdown-item v-for="a in accounts.length > 1 ? accounts : []" :key="a.accountId" @click="switchMailbox(a.accountId)">{{ a.email }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-input>
      </div>
      <div class="contact-entries" v-loading="listLoading">
        <button
          v-for="c in sortedConversations"
          :key="c.key"
          class="contact"
          :class="{ selected: selected?.key === c.key }"
          @click="select(c)"
        >
          <UserAvatar :profile="c.profile" :email="c.peers[0]" />
          <span class="contact-summary"
            ><span class="peers" translate="no" :title="c.peers.join(', ')">{{
              c.profile?.displayName || c.peers.join(', ')
            }}</span
            ><span class="preview">{{ c.preview || c.subject }}</span></span
          >
          <span class="contact-meta"
            ><span>{{ shortTime(c.createTime) }}</span
            ><span v-if="c.pinned">★</span
            ><span v-if="c.unread" class="badge">{{ c.unread > 99 ? $n(99) + '+' : $n(c.unread) }}</span></span
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
        @touchstart.passive="startTouch($event, null)"
        @touchmove.passive="moveTouch"
        @touchend="endTouch"
        @touchcancel="cancelPress"
      >
        <el-button class="back" text :aria-label="t('chatBack')" @click="closeThread"
          ><Icon icon="cloud-mail:back" width="24"
        /></el-button>
        <button
          class="profile-button"
          :aria-label="t('profileView')"
          @click="viewProfile(selected.profile, selected.peers.join(', '))"
        >
          <UserAvatar :profile="selected.profile" :email="selected.peers[0]" />
        </button>
        <div class="thread-title">
          <strong translate="no" :title="selected.peers.join(', ')">{{
            selected.profile?.displayName || selected.peers.join(', ')
          }}</strong
          ><span v-if="live.internal || messages.some(message => message.internal)" class="live-status" :class="{ online: live.online }">{{
            live.typing
              ? t('mailChatTyping')
              : live.online
                ? t('mailChatOnline')
                : t('mailChatOffline')
          }}</span>
          <span v-else>{{ connected ? t('mailChatLive') : t('chatReconnecting') }}</span>
        </div>
        <el-popover trigger="click" :width="300" placement="bottom-end">
          <template #reference><el-button text :aria-label="t('translateAuto')" :title="t('translateAuto')"><Icon icon="cloud-mail:translate" width="20" /></el-button></template>
          <AutoTranslationSettings />
        </el-popover>
        <el-button text :aria-label="t('exploreTitle')" :title="t('exploreTitle')" @click="explorer?.open()"><Icon icon="cloud-mail:search" width="22" /></el-button>
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
            <button
              class="profile-button message-avatar"
              :aria-label="t('profileView')"
              @click="viewProfile(m.type === 1 ? user.user.profile : m.profile, m.sendEmail)"
            >
              <UserAvatar
                :profile="m.type === 1 ? user.user.profile : m.profile"
                :email="m.sendEmail"
              />
            </button>
            <div
              class="bubble"
              :class="{ 'internal-bubble': isChat(m) }"
              :tabindex="0"
              @contextmenu="openMessageMenu($event, m)"
              @pointerdown="startPress($event, m)"
              @pointermove="movePress"
              @pointerup="cancelPress"
              @pointercancel="cancelPress"
              @touchstart.passive="startTouch($event, m)"
              @touchmove.passive="moveTouch"
              @touchend="endTouch"
              @touchcancel="cancelPress"
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
                  class="body-text" dir="auto"
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
                :class="{ 'sticker-image': /^sticker.*\.webp$/i.test(image.alt || '') }"
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
                <StickerMedia v-if="/\.(tgs|webm)$/i.test(att.filename)" :format="att.filename.toLowerCase().endsWith('.tgs') ? 'tgs' : 'webm'" :label="'🙂'" :load="()=>mailAttachment(att.attId)" @error="stickerErrors[att.attId] = true" />
                <el-button v-if="! /\.(tgs|webm)$/i.test(att.filename) || stickerErrors[att.attId]" text @click="download(att)">
                  <Icon icon="cloud-mail:file" width="26" aria-hidden="true" />
                  <span class="attachment-detail"><strong>{{ att.filename }}</strong><small>{{ formatBytes(att.size) }}</small></span>
                </el-button
                >
              </div>
              <MessageTranslation :ref="el => setTranslationRef(m.emailId, el)" v-if="(m.replyText ?? m.text)?.trim()" :email-id="m.emailId" :text="m.replyText ?? m.text" :chat-style="isChat(m)" :incoming="m.type !== 1" />
            </div>
            <span
              v-if="m.internal && m.type === 1 && m.read !== undefined"
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
      <el-button v-if="!atBottom || historyAnchor" class="latest" round @click="bottom">{{
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
        <div v-if="files[draftKey]?.length" class="chosen-files">
          <div v-for="(file, i) in files[draftKey] || []" :key="i" class="chosen-file">
            <span>{{ file.filename }}</span
            ><el-button text @click="files[draftKey].splice(i, 1)">×</el-button>
          </div>
        </div>
        <div class="compose-input-row">
        <el-input
          v-model="drafts[draftKey]"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          resize="none"
          maxlength="20000"
          :placeholder="t('mailChatCompactInput')"
          :title="t('chatEnterHint')"
          :aria-label="t('mailChatInput')"
          @keydown="keyDown"
          @focus="stickerPicker?.close()"
          @input="liveInput"
        />
        <div class="composer-footer">
          <StickerPicker ref="stickerPicker" :compact="compactChat" :dock="stickerDock" :context="draftKey" :disabled="sending" @visibility="stickerVisibility" @emoji="insertEmoji" @attachment="addSticker" @upload="chooseFiles" />
          <label class="attach-label" :aria-label="t('mailChatAttach')" :title="t('mailChatAttach')" tabindex="0" @keydown.enter.prevent="$event.currentTarget.querySelector('input').click()" @keydown.space.prevent="$event.currentTarget.querySelector('input').click()">
            <Icon class="attach-icon" icon="cloud-mail:attach" width="22" aria-hidden="true" /><span>{{ t('mailChatAttach') }}</span><input type="file" multiple :disabled="sending" @change="chooseFiles" /></label
          ><span>{{ t('chatEnterHint') }}</span
          ><el-button
            type="primary"
            native-type="submit"
            :aria-label="t('mailChatSend')"
            :title="t('mailChatSend')"
            :loading="sending"
            :disabled="(!drafts[draftKey]?.trim() && !files[draftKey]?.length) || messageLoading"
            ><Icon icon="cloud-mail:send" width="19" aria-hidden="true" /><span>{{ t('mailChatSend') }}</span></el-button
          >
        </div>
        </div>
        <div ref="stickerDock" class="sticker-dock"></div>
      </form>
    </main>
    <ConversationExplorer v-if="selected" ref="explorer" :account-id="Number(accountId)" :conversation-key="selected.key" :peer="selected.profile?.displayName || selected.peers.join(', ')" :revision="explorerRevision" @jump="jumpToResult" />
    <div v-if="!active" class="empty-thread"><el-empty :description="t('mailChatChoose')" /></div>
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
            <Icon icon="cloud-mail:copy" width="20" aria-hidden="true" />{{ t('mailChatCopy') }}
          </button>
          <button
            v-if="messageMenu.message && canSend"
            role="menuitem"
            @click="menuAction('quote')"
          >
            <Icon icon="cloud-mail:reply" width="20" aria-hidden="true" />{{ t('mailChatQuoteReply') }}
          </button>
          <button v-if="messageMenu.message && (messageMenu.message.replyText ?? messageMenu.message.text)?.trim()" role="menuitem" @click="menuAction('translate')">
            <Icon icon="cloud-mail:translate" width="20" aria-hidden="true" />{{ t('translateTitle') }}
          </button>
          <button v-if="messageMenu.message" role="menuitem" class="danger" @click="menuAction('delete-self')">
            <Icon icon="cloud-mail:delete" width="20" aria-hidden="true" />{{ t('deleteSelf') }}
          </button>
          <button
            v-if="messageMenu.message?.internal"
            role="menuitem"
            class="danger"
            @click="menuAction('delete')"
          >
            <Icon icon="cloud-mail:delete" width="20" aria-hidden="true" />{{ t('mailChatDeleteBoth') }}
          </button>
          <button
            v-if="(live.internal || messages.some(message => message.internal)) && messages.length"
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
    <el-dialog v-model="profileOpen" :title="t('profile')" width="min(380px, calc(100% - 24px))">
      <div class="profile-card">
        <UserAvatar :profile="shownProfile" :email="shownProfile.email" :size="72" />
        <h3>{{ shownProfile.displayName || shownProfile.email }}</h3>
        <p translate="no">{{ shownProfile.email }}</p>
        <p>{{ shownProfile.bio || t('profileNoBio') }}</p>
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { randomUUID } from '@/utils/uuid';

import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import MailBody from '@/components/mail-body.vue';
import UserAvatar from '@/components/user-avatar.vue';
import '@/icons/chat';
import { useMediaQuery } from '@vueuse/core';
import { useUiStore } from '@/store/ui';
import ConversationExplorer from '@/components/conversation-explorer.vue';
import MessageTranslation from '@/components/message-translation.vue';
import StickerPicker from '@/components/sticker-picker.vue';
import StickerMedia from '@/components/sticker-media.vue';
import AutoTranslationSettings from '@/components/auto-translation-settings.vue';
import { useRoute, useRouter } from 'vue-router';
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
  mailRemoveSelf,
  mailOpen,
  mailInstant
} from '@/request/mail-chat';
import { useMailLive } from '@/composables/use-mail-live';
import { listFriends, requestFriend, respondFriend } from '@/request/chat';
import { useMailSync } from '@/composables/use-mail-sync';
import { fileToBase64, formatBytes } from '@/utils/file-utils';
import { mailDate, showChatTime, chatTimeLabel } from '@/utils/mail-chat-display';

const { t, locale } = useI18n();
const route = useRoute(),
  router = useRouter();
const profileOpen = ref(false),
  shownProfile = ref({});
function viewProfile(profile, email) {
  shownProfile.value = { ...profile, email };
  profileOpen.value = true;
}
const user = useUserStore(),
  accountStore = useAccountStore();
const savedThreadKey = `mail-chat:thread:${user.user.userId}`;
function rememberThread(conversation) {
  try {
    if (conversation) {
      sessionStorage.setItem(savedThreadKey, JSON.stringify({ accountId: accountId.value, conversation }));
    } else {
      sessionStorage.removeItem(savedThreadKey);
    }
  } catch { /* Storage restrictions must not prevent opening or closing a chat. */ }
}
function rememberedThread() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(savedThreadKey) || 'null');
    if (saved && Number.isSafeInteger(saved.accountId) &&
        /^[a-f0-9]{64}$/.test(saved.conversation?.key) &&
        Array.isArray(saved.conversation.peers)) return saved;
  } catch { /* Ignore obsolete or malformed tab state. */ }
  return null;
}
const accountId = ref(accountStore.currentAccountId || user.user.account.accountId);
const accounts = ref([user.user.account]);
const conversations = ref([]),
  selected = ref(null),
  messages = ref([]),
  search = ref('');
const compactChat = useMediaQuery('(max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse)');
const ui = useUiStore();
const contactScroll = ref(null), contactHeaderHost = ref(null), contactControls = ref(null);
function contactListScroll() {
  if (!compactChat.value) return;
  const threshold = (contactHeaderHost.value?.offsetHeight || 0) + (contactControls.value?.offsetHeight || 0);
  ui.mobileContactsCollapsed = (contactScroll.value?.scrollTop || 0) >= threshold;
}
function restoreContactControls() {
  contactScroll.value?.scrollTo({ top: 0, behavior: 'smooth' });
}
watch([compactChat, contactHeaderHost], ([compact, host]) => {
  ui.mobileContactsHeaderTarget = compact ? host : null;
  ui.mobileContactsCollapsed = false;
}, { flush: 'post' });
const active = computed(() => !!selected.value);
watch(active, value => { ui.mobileChatFocused = value; ui.mobileContactsCollapsed = false; if (!value) nextTick(contactListScroll); }, { immediate: true });
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
const explorer = ref(null), explorerRevision = ref(0), historyAnchor = ref(null);
const translationRefs = new Map();
function setTranslationRef(id, element) {
  if (element) translationRefs.set(id, element);
  else translationRefs.delete(id);
}
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
  if ((!message && !live.value.internal) || event.pointerType !== 'touch') return;
  if (event.target?.closest('button, a, input, textarea, select, .message-translation')) return;
  cancelPress();
  pressStart = { x: event.clientX, y: event.clientY };
  pressTimer = setTimeout(() => {
    suppressUntil = Date.now() + 800;
    openMessageMenu(event, message);
  }, 450);
}
function startTouch(event, message) {
  if (event.touches.length !== 1) { cancelPress(); return; }
  const touch = event.touches[0];
  startPress({ pointerType: 'touch', target: event.target, currentTarget: event.currentTarget,
    clientX: touch.clientX, clientY: touch.clientY, preventDefault() {} }, message);
}
function moveTouch(event) {
  if (event.touches.length !== 1) { cancelPress(); return; }
  movePress(event.touches[0]);
}
function endTouch(event) {
  cancelPress();
  if (messageMenu.value && Date.now() < suppressUntil && event.cancelable) event.preventDefault();
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
  if (!message && !live.value.internal) return;
  event.preventDefault();
  cancelPress();
  const box = event.currentTarget?.getBoundingClientRect();
  const x = event.clientX || box?.left || 16,
    y = event.clientY || box?.top || 80;
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  messageMenu.value = {
    message,
    x: Math.max(left + 8, Math.min(x, left + (viewport?.width || innerWidth) - 210)),
    y: Math.max(top + 8, Math.min(y, top + (viewport?.height || innerHeight) - 310))
  };
}
async function menuAction(action) {
  const message = messageMenu.value?.message;
  closeMenu();
  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText(message.replyText || message.text || '');
      ElMessage.success(t('copySuccessMsg'));
    } catch { ElMessage.error(t('copyFailMsg')); }
    return;
  }
  if (action === 'translate') translationRefs.get(message.emailId)?.open();
  else if (action === 'quote') quoteMessage(message);
  else if (action === 'delete-self') removeSelf(message);
  else if (action === 'delete') removeBoth(message);
  else if (action === 'clear') removeBoth();
}
function menuEscape(event) {
  if (event.key === 'Escape') closeMenu();
}
const stickerErrors = reactive({});
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
  if (atBottom.value && !historyAnchor.value) bottom();
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
const canSend = computed(() => hasPerm('email:send') || live.value.internal || selected.value?.internal || messages.value.some(message => message.internal));
const friendsOpen = ref(false),
  friends = ref([]),
  friendEmail = ref('');
const revisions = new Map();
function applyMessages(data) {
  const marker = `${accountId.value}:${selected.value?.key}`;
  if (revisions.has(marker) && revisions.get(marker) !== data.revision) {
    messages.value = [];
    explorerRevision.value++;
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
async function removeSelf(message) {
  const a = accountId.value, k = selected.value?.key, v = version;
  if (!message || !k) return;
  try {
    await ElMessageBox.confirm(t('deleteSelfConfirm'), t('deleteSelf'), {
      type: 'warning', confirmButtonText: t('mailChatConfirmDelete'), cancelButtonText: t('mailChatCancelDelete')
    });
    if (a !== accountId.value || k !== selected.value?.key || v !== version) return;
    await mailRemoveSelf({ accountId: a, key: k, emailId: message.emailId });
    await sync();
  } catch { /* Cancellation preserves the message. */ }
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
const date = (value) => utc(value).toLocaleDateString(locale.value);
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
  historyAnchor.value = null;
  closeMenu();
  cancelPress();
  quoteTarget.value = null;
  version++;
  selected.value = null;
  rememberThread(null);
  messages.value = [];
  messageLoading.value = false;
}
async function bottom() {
  if (historyAnchor.value && selected.value) { await select(selected.value); return; }
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
    historyAnchor.value ||
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
  historyAnchor.value = null;
  closeMenu();
  cancelPress();
  quoteTarget.value = null;
  const mine = ++version;
  selected.value = c;
  rememberThread(c);
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
async function jumpToResult(emailId) {
  const mine = version;
  const conversationKey = selected.value?.key;
  if (!conversationKey) return;
  try {
    const data = await mailMessages({ accountId: accountId.value, key: conversationKey, around: emailId });
    if (mine !== version || stopped) return;
    if (!data.messages.some(message => message.emailId === emailId)) return;
    // Discard any live refresh that started before switching to this history window.
    version++;
    historyAnchor.value = emailId;
    messages.value = [];
    applyMessages(data);
    hasOlder.value = data.hasMore;
    atBottom.value = false;
    await nextTick();
    const element = scroll.value?.querySelector(`[data-email-id="${emailId}"]`);
    element?.scrollIntoView({ block: 'center' });
    element?.classList.add('search-result-focus');
    setTimeout(() => element?.classList.remove('search-result-focus'), 2200);
  } catch { /* Shared API error handling leaves the current conversation intact. */ }
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
        if (historyAnchor.value) {
          const data = await mailMessages({ accountId: a, key: k, around: historyAnchor.value });
          if (mine === version && !stopped) applyMessages(data);
          continue;
        }
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
const stickerDock = ref(null), stickerPicker = ref(null), pickerOpen = ref(false);
function stickerVisibility(value) {
  pickerOpen.value = value;
  if (value && compactChat.value) document.activeElement?.blur();
}
function insertEmoji(value) {
  const current = draftKey.value, text = drafts[current] || '';
  const input = document.querySelector('.composer textarea');
  const start = input?.selectionStart ?? text.length, end = input?.selectionEnd ?? text.length;
  if (text.length - (end - start) + value.length > 20000) return;
  drafts[current] = text.slice(0, start) + value + text.slice(end);
  liveInput();
  nextTick(() => { if (!pickerOpen.value) input?.focus({preventScroll:true}); input?.setSelectionRange(start + value.length, start + value.length); });
}
function addSticker(file) {
  const current = draftKey.value, existing = files[current] || [];
  if (existing.length >= 10 || existing.reduce((n,f)=>n+f.size,0)+file.size > 10*1024*1024) { ElMessage.error(t('mailChatFileLimit')); return; }
  files[current] = [...existing, file];
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
        contentType: /\.tgs$/i.test(f.name) ? 'application/x-tgsticker' : f.type || 'application/octet-stream',
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
async function showSent(account, result, selectionVersion) {
  if (stopped || accountId.value !== account || version !== selectionVersion) return;
  search.value = '';
  const data = await mailConversations({ accountId: account });
  if (stopped || accountId.value !== account || version !== selectionVersion) return;
  conversations.value = data.conversations;
  listHasMore.value = data.hasMore;
  const sentConversation = data.conversations.find((c) => c.key === result.conversationKey);
  if (!sentConversation) return;
  if (selected.value?.key !== sentConversation.key) {
    await select(sentConversation);
    return;
  }
  // Refresh the current thread without clearing its rendered messages or history.
  const recent = await mailMessages({ accountId: account, key: sentConversation.key });
  if (stopped || accountId.value !== account || version !== selectionVersion) return;
  Object.assign(selected.value, sentConversation);
  if (historyAnchor.value) {
    // Replace a search history window atomically when returning to the latest mail.
    version++;
    historyAnchor.value = null;
    messages.value = recent.messages;
    hasOlder.value = recent.hasMore;
  }
  applyMessages(recent);
  await bottom();
  await markRead();
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
    a = accountId.value,
    selectionVersion = version;
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
    instant: !!(live.value.internal || selected.value?.internal || messages.value.some(message => message.internal))
  });
  try {
    const result = await deliver(
      {
        accountId: a,
        instant: !!(live.value.internal || selected.value?.internal || messages.value.some(message => message.internal)),
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
    if (version === selectionVersion) quoteTarget.value = null;
    stopTyping();
    await showSent(a, result, selectionVersion);
  } catch {
  } finally {
    sending.value = false;
  }
}
async function sendNew() {
  if (sending.value) return;
  sending.value = true;
  const a = accountId.value, selectionVersion = version;
  const context = `new:${a}`,
    payload = {
      accountId: a,
      recipients: newMail.to.split(/[,;，；\s]+/).filter(Boolean),
      subject: newMail.subject.trim() || t('mailChatDefaultSubject'),
      text: newMail.text,
      attachments: files[context] || []
    };
  try {
    const result = await deliver(payload, context, JSON.stringify(payload));
    newOpen.value = false;
    files[context] = [];
    Object.assign(newMail, { to: '', subject: '', text: '' });
    await showSent(a, result, selectionVersion);
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
let openingLink = false;
watch(
  [() => route.query.accountId, () => route.query.conversation, accounts, conversations],
  async () => {
    const requested = Number(route.query.accountId),
      key = route.query.conversation;
    if (
      openingLink ||
      !requested ||
      !accounts.value.some((account) => account.accountId === requested)
    )
      return;
    if (accountId.value !== requested) {
      switchMailbox(requested);
      return;
    }
    const found = conversations.value.find((conversation) => conversation.key === key);
    if (!found) return;
    openingLink = true;
    try {
      if (selected.value?.key !== found.key) await select(found);
      await router.replace({ path: '/mail-chat', query: {} });
    } finally {
      openingLink = false;
    }
  }
);
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
  if (stopped) return;
  // Explicit conversation links take precedence over this tab's last open chat.
  if (!selected.value && !route.query.conversation) {
    const saved = rememberedThread();
    if (saved && accounts.value.some((account) => account.accountId === saved.accountId)) {
      if (accountId.value !== saved.accountId) switchMailbox(saved.accountId);
      await select(saved.conversation);
    }
  }
  sync();
});
onBeforeUnmount(() => {
  ui.mobileChatFocused = false;
  ui.mobileContactsCollapsed = false;
  ui.mobileContactsHeaderTarget = null;
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
.contact-controls { flex-shrink: 0; padding-top: 10px; }
.search-actions { padding: 0 4px; height: 24px; font-size: 22px; }
.translation-notice { display: inline-flex; color: var(--el-text-color-secondary); }
.conversations {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-inline-end: 1px solid var(--el-border-color);
}
.search {
  margin: 0 12px 10px;
  width: calc(100% - 24px);
}
.conversation-list {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.contact-entries { min-height: 0; flex: 1; overflow: auto; }
.contact-header-host { height: 60px; flex-shrink: 0; border-bottom: 1px solid var(--el-border-color); }
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
  direction: ltr;
  position: relative;
  padding-left: 48px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 16px 0;
  min-width: 0;
}
.mail-message.mine {
  padding-left: 0;
  padding-right: 48px;
}
.profile-button {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}
.message-avatar {
  position: absolute;
  top: 0;
  left: 0;
}
.mine .message-avatar {
  left: auto;
  right: 0;
}
.profile-card {
  text-align: center;
  overflow-wrap: anywhere;
}
.profile-card p {
  margin-top: 12px;
  white-space: pre-wrap;
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
.external :deep(.message-translation) { padding: 12px 16px; }
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
.bubble {
  -webkit-touch-callout: none;
  touch-action: pan-y;
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
.inline-image.sticker-image :deep(.el-image) { width: 160px; height: 160px; }
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
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
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

/* Chat surface; external email content continues to use its original mail card. */
.mail-chat {
  --chat-canvas: #eaf1f5;
  --chat-accent: #248bce;
  --chat-outgoing: #e0f2ff;
  --chat-incoming: var(--el-bg-color-overlay);
  --chat-shadow: 0 1px 2px rgba(24, 55, 78, .09);
  grid-template-columns: 330px minmax(0, 1fr);
}
:global(html.dark .mail-chat) {
  --chat-canvas: #101c28;
  --chat-accent: #63b3ed;
  --chat-outgoing: #234864;
  --chat-incoming: #20303f;
  --chat-shadow: 0 1px 2px rgba(0, 0, 0, .18);
}
.conversations { background: var(--el-bg-color); }
.contact { padding: 12px; min-height: 72px; border-radius: 10px; width: calc(100% - 12px); margin: 2px 6px; }
.contact.selected { background: var(--el-color-primary); color: white; }
.contact.selected .preview, .contact.selected .contact-meta { color: rgba(255,255,255,.85); }
.contact.selected .badge { background: white; color: var(--el-color-primary); }
.contact :deep(.user-avatar) { width: 46px !important; height: 46px !important; font-size: 18px; }
.mail-chat :deep(.user-avatar) { border-radius: 50%; border: 0; font-weight: 600; }
.peers { font-weight: 600; font-size: 14px; }
.badge { background: var(--el-color-primary); min-width: 20px; text-align: center; line-height: 20px; padding: 0 5px; }
.thread, .empty-thread { background: var(--chat-canvas); }
.thread-header { background: var(--el-bg-color); min-height: 52px; padding: 6px 14px; flex-shrink: 0; z-index: 1; }
.thread-title strong { font-size: 15px; line-height: 24px; }
.thread-title span { font-size: 12px; }
.messages { padding: 8px clamp(12px, 3vw, 44px) 20px; scroll-padding-block: 20px; }
.date-divider { width: fit-content; max-width: 90%; margin: 16px auto; padding: 4px 12px; border-radius: 20px; background: var(--el-bg-color-overlay); box-shadow: var(--chat-shadow); font-size: 11px; }
.mail-message { margin: 8px 0; padding-left: 46px; }
.search-result-focus .bubble { outline: 2px solid var(--chat-accent); outline-offset: 3px; }
.message-avatar { top: auto; bottom: 0; }
.bubble { padding: 9px 12px; border-radius: 15px 15px 15px 5px; background: var(--chat-incoming); box-shadow: var(--chat-shadow); line-height: 1.6; max-width: min(82%, 640px); }
.mail-message.mine { padding-right: 46px; }
.mail-message.mine .internal-bubble { background: var(--chat-outgoing); color: var(--el-text-color-primary); border-radius: 15px 15px 5px 15px; }
.body-text { margin: 0; font-size: 14px; }
.quote-card, .compose-quote { border-inline-start: 3px solid var(--chat-accent); background: var(--el-color-primary-light-9); border-radius: 5px; }
.quote-card strong, .compose-quote strong { color: var(--chat-accent); }
.read-receipt { color: var(--chat-accent); padding-inline: 4px; }
.attachment .el-button { display: flex; align-items: center; gap: 10px; border-radius: 10px; padding: 10px; background: var(--el-color-primary-light-9); }
.attachment-detail { display: grid; gap: 2px; text-align: start; min-width: 0; }
.attachment-detail strong { white-space: normal; overflow-wrap: anywhere; font-weight: 500; }
.attachment-detail small { color: var(--el-text-color-secondary); }
.composer { background: var(--el-bg-color); padding: 12px 20px max(12px, env(safe-area-inset-bottom)); }
.composer :deep(.el-textarea__inner) { border-radius: 14px; padding: 12px 14px; background: var(--el-fill-color-extra-light); }
.composer-footer .el-button { border-radius: 22px; gap: 7px; }
.composer-footer .el-button :deep(> span) { gap: 7px; }
.attach-label { display: inline-flex; align-items: center; min-height: 36px; padding-inline: 4px; }
.quote-card:focus-visible, .profile-button:focus-visible, .contact:focus-visible { outline: 2px solid var(--chat-accent); outline-offset: 2px; }
.external .bubble { box-shadow: var(--chat-shadow); }
.mail-message.mine.external .bubble { background: var(--el-bg-color); color: var(--el-text-color-primary); }
:global(.mail-message-menu) { border-radius: 14px; padding: 6px; }
:global(.mail-message-menu button) { display: flex; align-items: center; gap: 10px; border-radius: 8px; min-height: 44px; text-align: start; }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .mail-chat { grid-template-columns: minmax(0, 1fr); }
  .thread-header { min-height: 60px; padding: 6px 10px; gap: 8px; }
  .thread-title strong { font-size: 14px; }
  .messages { padding: 6px 10px 14px; }
  .mail-message { padding-left: 34px; }
  .mail-message.mine { padding-right: 0; }
  .message-avatar :deep(.user-avatar) { width: 28px !important; height: 28px !important; font-size: 12px; }
  .mine .message-avatar { display: none; }
  .bubble { max-width: 92%; padding: 8px 11px; }
  .external .bubble { max-width: 100%; padding: 0; }
  .composer { padding: 8px 10px max(8px, env(safe-area-inset-bottom)); }
  .composer :deep(.el-textarea__inner) { min-height: 48px; }
  .composer-footer { margin-top: 5px; }
}
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .conversation-list { display: block; overflow-y: auto; overscroll-behavior-y: contain; }
  .contact-entries { overflow: visible; min-height: 100%; }
}
.composer { padding: 6px 12px max(6px, env(safe-area-inset-bottom)); }
.compose-input-row { display: grid; grid-template-columns: 36px 34px minmax(0, 1fr) 42px; align-items: end; gap: 6px; }
.compose-input-row > .el-textarea { grid-column: 3; grid-row: 1; }
.composer :deep(.el-textarea__inner) { min-height: 40px; padding: 9px 12px; line-height: 22px; }
.composer-footer { display: contents; }
.attach-label { grid-column: 1; grid-row: 1; height: 40px; justify-content: center; padding: 0; }
.composer-footer :deep(.sticker-trigger) { grid-column: 2; grid-row: 1; margin: 0; height: 40px; }
.attach-icon { display: block; }
.attach-label > span, .composer-footer > span { display: none; }
.composer-footer > .el-button:not(.sticker-trigger) { grid-column: 4; grid-row: 1; width: 42px; height: 40px; padding: 0; margin: 0; }
.composer-footer > .el-button :deep(> span > span) { display: none; }
.composer-footer > .el-button :deep(> span) { gap: 0; }
.chosen-files { margin-bottom: 6px; }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .thread-header { min-height: 54px; }
  .thread-title > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .composer { padding: 6px 8px max(6px, env(safe-area-inset-bottom)); }
}
</style>
