<template>
  <div class="profile-dialog">
    <el-dialog v-model="profileOpen" :title="t('profile')" width="min(380px, calc(100% - 24px))">
      <div class="profile-card">
        <UserAvatar :profile="shownProfile" :email="shownProfile.email" :size="72" />
        <h3>{{ shownProfile.remark || shownProfile.displayName || shownProfile.email }}<OfficialBadge :profile="shownProfile" /></h3>
        <p translate="no">{{ shownProfile.email }}</p>
        <p v-if="shownProfile.username" translate="no">@{{ shownProfile.username }}</p>
        <p>{{ shownProfile.bio || t('profileNoBio') }}</p>
        <form v-if="shownProfile.email && shownProfile.email !== user.user.email" @submit.prevent="saveRemark">
          <el-input v-model="contactRemark" maxlength="50" :aria-label="t('contactRemark')" :placeholder="t('contactRemark')" />
          <small>{{ t('contactRemarkHint') }}</small>
          <el-button native-type="submit" :loading="savingRemark">{{ t('save') }}</el-button>
        </form>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/user-avatar.vue';
import { useUserStore } from '@/store/user';
import { saveContactNote } from '@/request/chat';

// A contact's profile card, where the reader can keep a private remark (display name).
const props = defineProps({
  // Awaited after a remark is saved, so the caller can update lists that show the name.
  onRemarkSaved: { type: Function, default: null }
});
const { t } = useI18n();
const user = useUserStore();

const profileOpen = ref(false);
const shownProfile = ref({});
const contactRemark = ref(''), savingRemark = ref(false);

function view(profile, email) {
  shownProfile.value = { ...profile, email };
  contactRemark.value = profile?.remark || '';
  profileOpen.value = true;
}

async function saveRemark() {
  if (savingRemark.value) return;
  const email = shownProfile.value.email;
  savingRemark.value = true;
  try {
    const result = await saveContactNote(email, contactRemark.value);
    if (shownProfile.value.email === email) { shownProfile.value.remark = result.remark; contactRemark.value = result.remark; }
    await props.onRemarkSaved?.(email, result.remark);
  } catch {} finally { savingRemark.value = false; }
}

// Keeps the open card current when the live conversation profile for one of `peers` changes.
function merge(peers, profile) {
  if (profileOpen.value && peers?.some((email) => email === shownProfile.value.email)) {
    shownProfile.value = { ...shownProfile.value, ...profile };
  }
}

defineExpose({ view, merge });
</script>

<style scoped>
/* The dialog renders in place, so this wrapper takes no space in the chat layout. */
.profile-dialog { display: contents; }
.profile-card {
  text-align: center;
  overflow-wrap: anywhere;
}
.profile-card p {
  margin-top: 12px;
  white-space: pre-wrap;
}
/* gap 12px: the chat view's later `:deep(.el-dialog form)` rule set it before this moved out. */
.profile-card form { display: grid; gap: 12px; margin-top: 14px; text-align: start; }
.profile-card form small { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
