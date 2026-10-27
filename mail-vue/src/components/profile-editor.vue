<template>
  <form class="profile-editor" @submit.prevent="save">
    <div class="profile-photo">
      <UserAvatar :profile="form" :email="user.user.email" :size="72" />
      <label class="upload-avatar"
        >{{ t('profileUpload')
        }}<input
          aria-label="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          @change="upload"
      /></label>
      <el-button v-if="form.avatar" text @click="form.avatar = ''">{{
        t('profileRemoveAvatar')
      }}</el-button>
    </div>
    <el-form-item :label="t('contactUsername')">
      <el-input v-model="username" maxlength="25" :aria-label="t('contactUsername')" placeholder="@username" @keydown.enter.prevent="saveHandle" />
      <el-button :loading="savingUsername" @click="saveHandle">{{ t('save') }}</el-button>
    </el-form-item>
    <p class="hint">{{ t('contactUsernameHint') }}</p>
    <el-form-item :label="t('profileNickname')"
      ><el-input v-model="form.displayName" maxlength="40" :aria-label="t('profileNickname')"
    /></el-form-item>
    <el-form-item :label="t('profileBio')"
      ><el-input
        v-model="form.bio"
        type="textarea"
        maxlength="200"
        show-word-limit
        :aria-label="t('profileBio')"
    /></el-form-item>
    <p class="hint">{{ t('profileShared') }}</p>
    <el-button type="primary" native-type="submit" :loading="saving" :disabled="uploading">{{
      t('save')
    }}</el-button>
    <PushSettings />
  </form>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import PushSettings from '@/components/push-settings.vue';
import UserAvatar from './user-avatar.vue';
import { myProfile, saveProfile, saveUsername } from '@/request/my';
import { useUserStore } from '@/store/user';

const { t } = useI18n(),
  user = useUserStore();
const form = reactive({
  displayName: user.user.profile?.displayName || user.user.name || '',
  bio: user.user.profile?.bio || '',
  avatar: user.user.profile?.avatar || ''
});
const saving = ref(false),
  uploading = ref(false);
const username = ref(user.user.profile?.username || ''), savingUsername = ref(false);
async function saveHandle() {
  if (savingUsername.value) return;
  savingUsername.value = true;
  try {
    const result = await saveUsername(username.value);
    username.value = result.username;
    user.user.profile = { ...user.user.profile, username: result.username };
    ElMessage.success(t('saveSuccessMsg'));
  } catch {} finally { savingUsername.value = false; }
}
onMounted(async () => {
  try {
    const profile = await myProfile();
    username.value = profile.username || '';
    Object.assign(form, profile, { displayName: profile.displayName || user.user.name || '' });
  } catch {}
});
async function upload(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
    ElMessage.error(t('profileImageLimit'));
    return;
  }
  uploading.value = true;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const side = Math.min(img.naturalWidth, img.naturalHeight),
      ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256
    );
    const data = canvas.toDataURL('image/jpeg', 0.75);
    if (data.length > 87000) throw Error('Image too large');
    form.avatar = data;
  } catch {
    ElMessage.error(t('profileImageLimit'));
  } finally {
    uploading.value = false;
    URL.revokeObjectURL(url);
  }
}
async function save() {
  if (saving.value || uploading.value) return;
  saving.value = true;
  try {
    user.user.profile = await saveProfile({ ...form });
    ElMessage.success(t('saveSuccessMsg'));
  } catch {
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.profile-editor {
  max-width: 520px;
  padding: 16px 0;
}
.profile-photo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.upload-avatar {
  color: var(--el-color-primary);
  cursor: pointer;
}
.upload-avatar input {
  display: none;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin: 12px 0;
}
.alert-settings {
  margin-top: 28px;
  display: grid;
  justify-items: start;
  gap: 10px;
}
:deep(.el-switch) { max-width: 100%; height: auto; }
:deep(.el-switch__label), :deep(.el-switch__label span) { white-space: normal; height: auto; line-height: 1.5; }
</style>
