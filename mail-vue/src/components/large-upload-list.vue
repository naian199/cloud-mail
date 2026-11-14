<template>
  <ul v-if="items.length" class="large-uploads" :aria-label="t('largeAttTitle')">
    <li v-for="item in items" :key="item.clientId" class="large-upload" :class="item.status">
      <Icon icon="cloud-mail:file" width="22" aria-hidden="true" />
      <span class="large-upload-detail">
        <strong :title="item.name">{{ item.name }}</strong>
        <small>{{ formatBytes(item.size) }} · {{ statusText(item) }}</small>
        <progress v-if="item.status === 'uploading' && !item.direct" :value="item.progress" max="1" :aria-label="t('largeAttUploading')" />
        <progress v-else-if="item.status === 'uploading'" :aria-label="t('largeAttDirectUploading')" />
      </span>
      <el-button v-if="item.status === 'failed'" text size="small" @click="emit('retry', item)">{{ t('largeAttRetry') }}</el-button>
      <el-button text size="small" :aria-label="t('cancel')" @click="emit('remove', item)">×</el-button>
    </li>
  </ul>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { formatBytes } from '@/utils/file-utils';

defineProps({ items: { type: Array, required: true } });
const emit = defineEmits(['retry', 'remove']);
const { t } = useI18n();
// Progress is the bytes sent to this site's Worker, which relays them as they arrive; at 100%
// the storage service is still confirming the file.
//
// Files too large for the Worker go straight to the storage program; browsers give no progress
// for those (see uploadDirect), so they show the elapsed time.
const now = ref(Date.now());
const clock = setInterval(() => { now.value = Date.now(); }, 1000);
onBeforeUnmount(() => clearInterval(clock));
const elapsed = (item) => { const s = Math.max(0, Math.floor((now.value - item.startedAt) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const statusText = (item) => item.status === 'uploading' && item.direct
  ? (item.progress >= 1 ? t('largeAttConfirming') : `${t('largeAttDirectUploading')} · ${elapsed(item)}`)
  : item.status === 'uploading'
  ? (item.progress >= 1 ? t('largeAttConfirming') : `${t('largeAttUploading')} ${Math.round(item.progress * 100)}%`)
  : t(item.status === 'ready' ? 'largeAttReady' : 'largeAttFailed');
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
