<template>
  <div class="files-page">
    <header class="files-header">
      <h1>{{ t('cloudFileTitle') }}</h1>
      <p class="files-hint">{{ t('cloudFileHint') }}</p>
      <div class="files-tools">
        <el-input v-model="query" clearable :placeholder="t('cloudFileSearch')" :aria-label="t('cloudFileSearch')" class="files-search">
          <template #prefix><Icon icon="cloud-mail:search" width="16" aria-hidden="true" /></template>
        </el-input>
        <el-select v-model="sort" :aria-label="t('cloudFileSort')" class="files-sort">
          <el-option value="recent" :label="t('cloudFileSortRecent')" />
          <el-option value="name" :label="t('cloudFileSortName')" />
          <el-option value="size" :label="t('cloudFileSortSize')" />
        </el-select>
      </div>
      <div class="files-filters" role="group" :aria-label="t('cloudFileType')">
        <button v-for="c in ['', ...FILE_CATEGORIES]" :key="c || 'all'" type="button" class="chip" :class="{ active: category === c }" :aria-pressed="category === c" @click="category = c">
          {{ t(c ? `cloudFileCat_${c}` : 'all') }}
        </button>
        <span class="files-filters-gap" />
        <button v-for="m in ['', 'uploaded', 'viewed', 'downloaded']" :key="m || 'any'" type="button" class="chip mark" :class="{ active: mark === m }" :aria-pressed="mark === m" @click="mark = m">
          {{ t(m ? `cloudFileMark_${m}` : 'cloudFileMarkAny') }}
        </button>
      </div>
    </header>

    <div v-if="loadError" class="files-empty">
      <p>{{ t('cloudFileLoadFailed') }}</p>
      <el-button @click="reload">{{ t('cloudFileRetryLoad') }}</el-button>
    </div>
    <div v-else-if="!loading && !items.length" class="files-empty">
      <Icon icon="cloud-mail:folder" width="40" aria-hidden="true" />
      <p>{{ t(query || category || mark ? 'cloudFileNoMatch' : 'cloudFileEmpty') }}</p>
    </div>
    <ul v-else class="files-list" v-loading="loading && !items.length">
      <li v-for="item in items" :key="item.fileId" class="file-row" :class="{ unavailable: item.status !== 'ready' }">
        <button v-if="thumbs[item.fileId]" type="button" class="file-thumb" :aria-label="t('cloudFileOpenPreview', { name: item.filename })" @click="openPreview(item)">
          <img :src="thumbs[item.fileId]" alt="" loading="lazy" />
          <Icon v-if="item.category === 'video'" class="play" icon="cloud-mail:play" width="20" aria-hidden="true" />
        </button>
        <span v-else class="file-thumb icon"><Icon :icon="fileIcon(item.category)" width="26" aria-hidden="true" /></span>
        <span class="file-main">
          <strong :title="item.filename">{{ item.filename }}</strong>
          <small>
            {{ formatBytes(item.size) }} · {{ formatTime(item.lastAccess) }}
            <template v-if="item.status !== 'ready'"> · {{ t('largeAttUnavailable') }}</template>
            <template v-else-if="item.preview === 'expired'"> · {{ t('cloudFilePreviewExpired') }}</template>
          </small>
          <span class="file-marks">
            <span v-if="item.uploaded" class="tag">{{ t('cloudFileMark_uploaded') }}</span>
            <span v-if="item.viewed" class="tag">{{ t('cloudFileMark_viewed') }}</span>
            <span v-if="item.downloaded" class="tag">{{ t('cloudFileMark_downloaded') }}</span>
          </span>
        </span>
        <span class="file-actions">
          <el-button v-if="item.status === 'ready'" size="small" type="primary" :loading="opening === item.fileId" @click="download(item)">{{ t('largeAttDownload') }}</el-button>
          <el-button size="small" text :aria-label="t('cloudFileRemove') + ' ' + item.filename" @click="remove(item)">{{ t('cloudFileRemove') }}</el-button>
        </span>
      </li>
    </ul>
    <div v-if="hasMore && !loadError" class="files-more">
      <el-button :loading="loading" @click="load(page + 1)">{{ t('cloudFileMore') }}</el-button>
    </div>
    <el-image-viewer v-if="viewing" :url-list="[viewing]" teleported hide-on-click-modal @close="viewing = ''" />
  </div>
</template>

<script setup>
import { defineOptions, onActivated, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { debounce } from 'lodash-es';
import { formatBytes } from '@/utils/file-utils';
import { FILE_CATEGORIES, fileIcon } from '@/utils/cloud-file';
import { cloudFileList, cloudFilePreview, cloudFileRemove, cloudFileView, openOfficialDownload } from '@/request/cloud-file';

defineOptions({ name: 'files' });

// The user's own document library: files they uploaded, opened or clicked to download. It is
// independent from chats: deleting a chat never removes anything here.
const { t, locale } = useI18n();
const query = ref(''), category = ref(''), mark = ref(''), sort = ref('recent');
const items = ref([]), page = ref(1), hasMore = ref(false), loading = ref(false), loadError = ref(false);
const thumbs = reactive({}), opening = ref(0), viewing = ref('');
let request = 0;

const formatTime = (seconds) => new Date(seconds * 1000).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' });

async function load(nextPage = 1) {
  const id = ++request;
  loading.value = true;
  loadError.value = false;
  try {
    const params = { page: nextPage, sort: sort.value };
    if (query.value.trim()) params.q = query.value.trim();
    if (category.value) params.category = category.value;
    if (mark.value) params.mark = mark.value;
    const data = await cloudFileList(params);
    if (id !== request) return;
    items.value = nextPage === 1 ? data.list : [...items.value, ...data.list];
    page.value = nextPage;
    hasMore.value = data.hasMore;
    loadThumbs(data.list);
  } catch {
    if (id === request) loadError.value = true;
  } finally {
    if (id === request) loading.value = false;
  }
}
const reload = () => load(1);
const reloadSoon = debounce(reload, 300);
watch(query, reloadSoon);
watch([category, mark, sort], reload);
reload();
// The page is kept alive; returning from chat shows files collected meanwhile.
let firstActivation = true;
onActivated(() => { if (firstActivation) firstActivation = false; else reload(); });

async function loadThumbs(list) {
  for (const item of list) {
    if (item.preview !== 'ready' || thumbs[item.fileId]) continue;
    const url = await cloudFilePreview(item.fileId).catch(() => null);
    if (url) thumbs[item.fileId] = url;
  }
}
onBeforeUnmount(() => Object.values(thumbs).forEach((url) => URL.revokeObjectURL(url)));

function openPreview(item) {
  viewing.value = thumbs[item.fileId];
  cloudFileView(item.fileId).then(() => { item.viewed = true; }).catch(() => {});
}

async function download(item) {
  opening.value = item.fileId;
  try {
    const result = await openOfficialDownload(item.fileId);
    if (result === 'ok') item.downloaded = true;
    if (result === 'gone') { item.status = 'deleted'; ElMessage.warning(t('cloudFileGone')); }
    if (result === 'retry') ElMessage.error(t('cloudFileRetry'));
  } finally {
    opening.value = 0;
  }
}

async function remove(item) {
  try {
    await ElMessageBox.confirm(t('cloudFileRemoveConfirm', { name: item.filename }), { confirmButtonText: t('confirm'), cancelButtonText: t('cancel'), type: 'warning' });
  } catch { return; }
  await cloudFileRemove(item.fileId);
  items.value = items.value.filter((row) => row !== item);
  if (thumbs[item.fileId]) { URL.revokeObjectURL(thumbs[item.fileId]); delete thumbs[item.fileId]; }
}
</script>

<style scoped>
.files-page { height: 100%; overflow: auto; padding: 20px 24px 32px; box-sizing: border-box; max-width: 980px; }
.files-header h1 { margin: 0; font-size: 20px; font-weight: 600; }
.files-hint { margin: 6px 0 14px; font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.6; }
.files-tools { display: flex; gap: 10px; }
.files-search { flex: 1; min-width: 0; }
.files-sort { width: 150px; flex: none; }
.files-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px; align-items: center; }
.files-filters-gap { width: 10px; }
.chip { border: 1px solid var(--el-border-color); background: transparent; color: var(--el-text-color-regular); border-radius: 999px; padding: 4px 12px; font-size: 13px; cursor: pointer; min-height: 30px; }
.chip.active { background: var(--el-color-primary); border-color: var(--el-color-primary); color: #fff; }
.chip.mark.active { background: var(--el-color-primary-light-8); color: var(--el-color-primary); }
.chip:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.files-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; min-height: 80px; }
.file-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--el-fill-color-light); min-width: 0; }
.file-row.unavailable { opacity: .65; }
.file-thumb { position: relative; flex: none; width: 52px; height: 52px; border-radius: 8px; overflow: hidden; border: 0; padding: 0; background: var(--el-fill-color-darker); display: grid; place-items: center; color: var(--el-text-color-secondary); }
button.file-thumb { cursor: zoom-in; }
.file-thumb img { width: 100%; height: 100%; object-fit: cover; }
.file-thumb .play { position: absolute; inset: 0; margin: auto; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.file-main { display: grid; gap: 2px; min-width: 0; flex: 1; }
.file-main strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-main small { font-size: 12px; color: var(--el-text-color-secondary); }
.file-marks { display: flex; flex-wrap: wrap; gap: 4px; }
.tag { font-size: 11px; padding: 0 6px; border-radius: 4px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); line-height: 18px; }
.file-actions { display: flex; gap: 4px; flex: none; }
.file-actions .el-button + .el-button { margin-left: 0; }
.files-empty { display: grid; justify-items: center; gap: 8px; padding: 48px 0; color: var(--el-text-color-secondary); }
.files-more { display: flex; justify-content: center; margin-top: 16px; }
@media (max-width: 640px) {
  .files-page { padding: 14px 16px 24px; }
  .files-sort { width: 112px; }
  .file-row { flex-wrap: wrap; }
  .file-actions { width: 100%; justify-content: flex-end; }
  .file-actions .el-button { min-height: 36px; }
  .chip { min-height: 36px; }
}
</style>
