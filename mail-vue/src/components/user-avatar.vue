<template>
  <span class="user-avatar" :class="{ 'brand-avatar': brandUrl && !profile?.avatar && !failed }" :style="{ width: size + 'px', height: size + 'px' }" :title="brandUrl && !profile?.avatar && !failed ? t('brandAvatarHint') : undefined" translate="no">
    <img v-if="(profile?.avatar || brandUrl) && !failed" :src="profile?.avatar || brandUrl" alt="" referrerpolicy="no-referrer" @error="failed = true" />
    <span v-else>{{ (profile?.displayName || email || '@').slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { brandAvatarBlob } from '@/utils/brand-avatar';
const { t } = useI18n();
const props = defineProps({ profile: Object, email: String, size: { type: Number, default: 38 } });
const failed = ref(false);
const brandUrl = ref('');
let generation = 0;
function clearBrand() {
  if (brandUrl.value) URL.revokeObjectURL(brandUrl.value);
  brandUrl.value = '';
}
watch(
  [() => props.profile?.avatar, () => props.profile?.brandDomain, () => props.email],
  async () => {
    const current = ++generation;
    clearBrand();
    failed.value = false;
    if (props.profile?.avatar || !props.profile?.brandDomain) return;
    const blob = await brandAvatarBlob(props.profile.brandDomain);
    if (blob && current === generation) brandUrl.value = URL.createObjectURL(blob);
  },
  { immediate: true }
);
onBeforeUnmount(() => { generation++; clearBrand(); });
</script>
<style scoped>
.user-avatar {
  box-sizing: border-box;
  border: 1px solid var(--el-border-color-light);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  vertical-align: middle;
}
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.brand-avatar img { object-fit: contain; padding: 3px; box-sizing: border-box; }
</style>
