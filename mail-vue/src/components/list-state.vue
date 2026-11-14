<template>
  <!-- A list that has never loaded: say so and offer a retry, never an empty state. -->
  <div v-if="state === 'failed'" class="list-state list-state-failed" role="alert">
    <p>{{ t('listLoadFailed') }}</p>
    <el-button size="small" :loading="retrying" @click="$emit('retry')">{{ t('listRetry') }}</el-button>
  </div>
  <!-- A refresh failed: the list below is the last one that loaded. -->
  <div v-else-if="state === 'stale'" class="list-state list-state-stale" role="status">
    <span>{{ t('listNotUpdated') }}</span>
    <el-button size="small" text type="primary" :loading="retrying" @click="$emit('retry')">{{ t('listRetry') }}</el-button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

// state: '' (nothing to show), 'failed' (first load failed) or 'stale' (a refresh failed).
defineProps({ state: { type: String, default: '' }, retrying: { type: Boolean, default: false } });
defineEmits(['retry']);
const { t } = useI18n();
</script>

<style scoped>
.list-state { font-size: 13px; color: var(--el-text-color-secondary); }
.list-state-failed { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; text-align: center; }
.list-state-failed p { margin: 0; }
.list-state-stale { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 8px; padding: 4px 6px 4px 10px; border-radius: 6px; background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); }
</style>
