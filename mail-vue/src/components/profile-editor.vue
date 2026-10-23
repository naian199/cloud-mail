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
    <div class="alert-settings">
      <h3>{{ t('profileAlerts') }}</h3>
      <el-switch
        :model-value="alertsEnabled"
        @change="setAlertsEnabled"
        :active-text="t('profileWebAlerts')"
      />
      <el-button v-if="notificationPermission === 'default'" @click="enableBrowserAlerts">{{
        t('profileEnableBrowser')
      }}</el-button>
      <p class="hint">
        {{
          t(
            notificationPermission === 'granted'
              ? 'profileBrowserGranted'
              : notificationPermission === 'denied'
                ? 'profileBrowserDenied'
                : 'profileBrowserHint'
          )
        }}
      </p>
    </div>
  </form>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import UserAvatar from './user-avatar.vue';
import { myProfile, saveProfile } from '@/request/my';
import { useUserStore } from '@/store/user';
import {
  alertsEnabled,
  setAlertsEnabled,
  notificationPermission,
  enableBrowserAlerts
} from '@/composables/use-message-alerts';
const { t } = useI18n(),
  user = useUserStore();
const form = reactive({
  displayName: user.user.profile?.displayName || user.user.name || '',
  bio: user.user.profile?.bio || '',
  avatar: user.user.profile?.avatar || ''
});
const saving = ref(false),
  uploading = ref(false);
onMounted(async () => {
  try {
    const profile = await myProfile();
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
</style>
