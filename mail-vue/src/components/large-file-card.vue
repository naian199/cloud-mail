<template>
  <div class="large-file" :class="{ unavailable: !available, 'has-thumb': thumb }">
    <button v-if="thumb" type="button" class="large-file-thumb" :aria-label="t('cloudFileOpenPreview', { name: file.filename })" @click="openPreview">
      <img :src="thumb" alt="" />
      <Icon v-if="file.category === 'video'" class="play" icon="cloud-mail:play" width="22" aria-hidden="true" />
    </button>
    <Icon v-else class="large-file-icon" :icon="fileIcon(file.category)" width="26" aria-hidden="true" />
    <span class="large-file-detail">
      <strong :title="file.filename">{{ file.filename }}</strong>
      <small>{{ formatBytes(file.size) }} · {{ statusLine }}</small>
    </span>
    <el-button v-if="available" size="small" :loading="opening" @click="download">{{ t('largeAttDownload') }}</el-button>
    <el-image-viewer v-if="viewing" :url-list="[thumb]" teleported hide-on-click-modal @close="viewing = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { formatBytes } from '@/utils/file-utils';
import { fileIcon } from '@/utils/cloud-file';
import { largeAttLink } from '@/request/large-att';
import { cloudFilePreview, cloudFileView, openOfficialDownload } from '@/request/cloud-file';

// A large attachment in a message. The site shows a small preview for 7 days after upload;
// the original is downloaded only from the storage program's official page.
const props = defineProps({ file: { type: Object, required: true } });
const { t } = useI18n();
const opening = ref(false), gone = ref(false), viewing = ref(false), thumb = ref('');
const available = computed(() => props.file.status === 'ready' && !gone.value);
const statusLine = computed(() => {
  if (!available.value) return t('largeAttUnavailable');
  if (props.file.preview === 'expired') return t('cloudFilePreviewExpired');
  return t('largeAttStoredRemotely');
});

// Thumbnails load when the message is shown; that does not count as opening the file.
let controller;
watch(() => [props.file.fileId, props.file.preview], async ([fileId, preview]) => {
  controller?.abort();
  if (thumb.value) { URL.revokeObjectURL(thumb.value); thumb.value = ''; }
  if (!fileId || preview !== 'ready') return;
  controller = new AbortController();
  try { thumb.value = (await cloudFilePreview(fileId, { signal: controller.signal })) || ''; } catch {}
}, { immediate: true });
onBeforeUnmount(() => { controller?.abort(); if (thumb.value) URL.revokeObjectURL(thumb.value); });

// Opening the preview on purpose adds the file to the user's library as "viewed".
function openPreview() {
  viewing.value = true;
  cloudFileView(props.file.fileId).catch(() => {});
}

async function download() {
  if (opening.value) return;
  opening.value = true;
  try {
    let result;
    if (props.file.fileId) result = await openOfficialDownload(props.file.fileId);
    else {
      // Messages from before the document library: by attachment ID.
      const tab = window.open('', '_blank');
      try { const { url } = await largeAttLink(props.file.attId); if (tab) tab.location.href = url; result = 'ok'; }
      catch (error) { tab?.close(); result = error?.code === 410 ? 'gone' : 'retry'; }
    }
    if (result === 'gone') gone.value = true;
    if (result === 'retry') ElMessage.error(t('cloudFileRetry'));
  } finally {
    opening.value = false;
  }
}
</script>

<style scoped>
.large-file { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-top: 6px; border-radius: 10px; background: var(--el-fill-color-light); min-width: 0; max-width: 360px; }
.large-file.unavailable { opacity: .65; }
.large-file-detail { display: grid; min-width: 0; flex: 1; }
.large-file-detail strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.large-file-detail small { color: var(--el-text-color-secondary); font-size: 12px; }
.large-file-thumb { position: relative; flex: none; width: 56px; height: 56px; padding: 0; border: 0; border-radius: 8px; overflow: hidden; cursor: zoom-in; background: var(--el-fill-color-darker); }
.large-file-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.large-file-thumb .play { position: absolute; inset: 0; margin: auto; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.large-file-thumb:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
</style>
