<template>
  <ul v-if="items.length" class="large-uploads" :aria-label="t('largeAttTitle')">
    <li v-for="item in items" :key="item.clientId" class="large-upload" :class="item.status">
      <Icon icon="cloud-mail:file" width="22" aria-hidden="true" />
      <span class="large-upload-detail">
        <strong :title="item.name">{{ item.name }}</strong>
        <small>{{ statusText(item) }}</small>
        <progress v-if="item.status === 'uploading'" :aria-label="t('largeAttDirectUploading')" />
      </span>
      <el-button v-if="item.status === 'failed'" text size="small" @click="emit('retry', item)">{{ t('largeAttRetry') }}</el-button>
      <el-button text size="small" :aria-label="t('cancel')" @click="emit('remove', item)">×</el-button>
    </li>
  </ul>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { formatBytes } from '@/utils/file-utils';

defineProps({ items: { type: Array, required: true } });
const emit = defineEmits(['retry', 'remove']);
const { t } = useI18n();
// While the file is being sent and verified the row says it is uploading; once the Worker has
// verified it, the row shows only the size the storage program confirmed.
function statusText(item) {
  const total = formatBytes(item.size);
  if (item.status === 'uploading') return `${total} · ${t('largeAttUploading')}`;
  if (item.status === 'ready') return formatBytes(item.verifiedSize || item.size);
  return `${total} · ${t('largeAttFailed')}`;
}
</script>

<style scoped>
.large-uploads { list-style: none; margin: 0 0 6px; padding: 0; display: grid; gap: 6px; }
.large-upload { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-lighter); min-width: 0; }
.large-upload.failed { border-color: var(--el-color-danger-light-5); }
.large-upload-detail { display: grid; min-width: 0; flex: 1; gap: 2px; }
.large-upload-detail strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.large-upload-detail small { color: var(--el-text-color-secondary); font-size: 12px; }
.large-upload-detail progress { width: 100%; height: 4px; accent-color: var(--el-color-primary); }
</style>
