<template>
  <span class="user-avatar" :style="{ width: size + 'px', height: size + 'px' }" translate="no">
    <img v-if="profile?.avatar && !failed" :src="profile.avatar" alt="" @error="failed = true" />
    <span v-else>{{ (profile?.displayName || email || '@').slice(0, 1).toUpperCase() }}</span>
  </span>
</template>
<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ profile: Object, email: String, size: { type: Number, default: 38 } });
const failed = ref(false);
watch(
  () => props.profile?.avatar,
  () => {
    failed.value = false;
  }
);
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
</style>
