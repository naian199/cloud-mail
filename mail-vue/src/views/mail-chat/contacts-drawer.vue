<template>
  <div class="contacts-drawer">
    <el-drawer v-model="isOpen" :title="t('mailChatContacts')" size="min(420px, 100%)">
      <form class="friend-request" @submit.prevent="addFriend">
        <el-input v-model="friendEmail" :placeholder="t('contactSearchHint')" :aria-label="t('contactSearchHint')" /><el-button
          native-type="submit"
          type="primary"
          :loading="searchingFriends"
          >{{ t('contactSearch') }}</el-button
        >
      </form>
      <p v-if="friendSearched && !friendResults.length">{{ t('contactNotFound') }}</p>
      <div v-for="person in friendResults" :key="person.username" class="friend-row">
        <div><strong>{{ person.displayName || person.username }}<OfficialBadge :profile="person" /></strong><div translate="no">@{{ person.username }}</div></div>
        <el-button :loading="addingFriend === person.username" :disabled="person.requested || !!addingFriend" @click="addUsername(person)">{{ t(person.requested ? 'mailChatPending' : 'mailChatAddFriend') }}</el-button>
      </div>
      <div v-for="friend in friends" :key="friend.id" class="friend-row">
        <el-button text @click="emit('view-profile', friend, friend.email)">{{ friend.remark || friend.displayName || (friend.username ? '@' + friend.username : friend.email) }}<OfficialBadge :profile="friend" /></el-button>
        <template v-if="friend.status === 'accepted'"
          ><el-button text @click="emit('open-friend', friend)">{{
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
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/store/user';
import { listFriends, requestFriend, respondFriend, searchUsers, requestFriendByUsername } from '@/request/chat';

// Contacts: search people, send and answer friend requests, open a friend's chat.
const emit = defineEmits(['view-profile', 'open-friend']);
const { t } = useI18n();
const user = useUserStore();

const isOpen = ref(false);
const friends = ref([]);
const friendEmail = ref('');
const friendResults = ref([]), friendSearched = ref(false), searchingFriends = ref(false), addingFriend = ref('');

async function loadFriends() {
  try {
    friends.value = await listFriends();
  } catch {}
}

async function addFriend() {
  if (searchingFriends.value) return;
  const query = friendEmail.value.trim();
  if (!query) return;
  searchingFriends.value = true;
  try {
    if (query.includes('@') && !query.startsWith('@')) {
      await requestFriend(query);
      friendEmail.value = '';
      await loadFriends();
    } else {
      const results = await searchUsers(query);
      if (friendEmail.value.trim() === query) { friendResults.value = results; friendSearched.value = true; }
    }
  } catch {} finally { searchingFriends.value = false; }
}

async function addUsername(person) {
  if (addingFriend.value) return;
  addingFriend.value = person.username;
  try {
    await requestFriendByUsername(person.username);
    person.requested = true;
    await loadFriends();
  } catch {} finally { addingFriend.value = ''; }
}

async function answerFriend(friend, accept) {
  try {
    await respondFriend(friend.id, accept);
    await loadFriends();
  } catch {}
}

defineExpose({
  isOpen,
  open() {
    isOpen.value = true;
    loadFriends();
  },
  close() {
    isOpen.value = false;
  },
  // Refreshes the list while the drawer is open; used after syncs and remark changes.
  async refresh() {
    if (isOpen.value) await loadFriends();
  }
});
</script>

<style scoped>
/* The drawer renders in place, so this wrapper takes no space in the chat layout. */
.contacts-drawer { display: contents; }
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
</style>
