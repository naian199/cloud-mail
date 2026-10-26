<template>
  <div ref="host" class="video-attachment" :class="{ expanded }" :style="{ '--video-aspect': aspect }" :aria-busy="loading || converting">
    <div class="video-frame">
      <video v-if="url" ref="player" :src="url" controls playsinline preload="metadata" :poster="poster" :aria-label="file.filename" @loadedmetadata="readDimensions" @error="playbackFailed" @pointerdown.stop @touchstart.stop />
      <button v-else class="video-start" :class="{ 'has-poster': poster, 'preview-loading': preparing }" type="button" :aria-label="t('videoPlay')" :disabled="loading || converting" @click="play">
        <img v-if="poster" class="video-poster" :src="poster" alt="" />
        <span class="video-play-icon"><Icon icon="cloud-mail:play" width="34" aria-hidden="true" /></span>
        <span v-if="!poster" class="video-placeholder">{{ t(loading || preparing ? 'videoLoading' : 'videoPlay') }}</span>
        <span v-if="duration" class="video-duration">{{ clock(duration) }}</span>
      </button>
      <span v-if="poster && !url" class="video-size">{{ formatBytes(file.size) }}</span>
      <div class="video-actions">
        <button v-if="!expanded" class="video-expand" type="button" :aria-label="t('mediaOpen')" :title="t('mediaOpen')" @click="player?.pause(); $emit('preview')"><Icon icon="cloud-mail:expand" width="17" /></button>
        <el-dropdown trigger="click" placement="bottom-end" @command="action">
          <button class="video-menu" type="button" :aria-label="file.filename + ' · ' + t('tabSetting')"><Icon icon="cloud-mail:more" width="18" /></button>
          <template #dropdown><el-dropdown-menu>
            <el-dropdown-item v-if="converting" command="cancel">{{ t('cancel') }}</el-dropdown-item>
            <el-dropdown-item v-else-if="!converted" command="convert" :disabled="loading">{{ t('videoCompatible') }}</el-dropdown-item>
            <el-dropdown-item command="download">{{ t('videoDownload') }}</el-dropdown-item>
          </el-dropdown-menu></template>
        </el-dropdown>
      </div>
    </div>
    <div v-if="!expanded" class="video-caption"><strong :title="file.filename">{{ file.filename }}</strong><small>{{ formatBytes(file.size) }}</small></div>
    <p v-if="converting" class="video-status" role="status">{{ t('videoConverting', { percent: percent }) }} <button type="button" @click="cancel">{{ t('cancel') }}</button></p>
    <p v-else-if="error" class="video-status" role="status">{{ t(error) }} <button v-if="!converted" type="button" :disabled="loading" @click="convert">{{ t('videoCompatible') }}</button></p>
  </div>
</template>
<script setup>
import { ref, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { videoMime } from '@/utils/video-files.mjs';
import { videoPoster } from '@/utils/video-poster.mjs';
const props = defineProps({ file: { type: Object, required: true }, load: { type: Function, required: true }, expanded: Boolean });
const emit = defineEmits(['download', 'preview', 'resize']);
const { t } = useI18n();
const visible = ref(true), aspect = ref(16 / 9), poster = ref(''), duration = ref(0), preparing = ref(false);
let previewController, previewAttempted = false;
const clock = value => { const seconds = Math.floor(value); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
async function preparePreview() {
  if (props.expanded || previewAttempted || poster.value || url.value || loading.value || converting.value || disposed) return;
  previewAttempted = true; preparing.value = true;
  const mine = new AbortController(); previewController = mine;
  try {
    const result = await videoPoster(async signal => {
      const cancelRead = () => { if (!loading.value && !converting.value) readController?.abort(); };
      signal.addEventListener('abort', cancelRead, { once: true });
      try {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const blob = await originalBlob();
        if (!visible.value && !url.value) original = null;
        return new Blob([blob], { type: videoMime(props.file) || 'video/mp4' });
      } finally { signal.removeEventListener('abort', cancelRead); }
    }, { signal: mine.signal });
    if (disposed || mine.signal.aborted || url.value) return;
    aspect.value = result.width / result.height; duration.value = result.duration;
    poster.value = URL.createObjectURL(result.poster);
    await nextTick(); emit('resize');
  } catch (reason) {
    if (reason.name === 'AbortError') previewAttempted = false;
    if (!mine.signal.aborted) error.value = reason.message === 'Unsupported video preview' ? 'videoUnsupported' : 'videoLoadFailed';
  } finally {
    if (previewController === mine) { preparing.value = false; previewController = null; }
    if (!visible.value && !url.value) original = null;
    if (mine.signal.aborted && visible.value && !disposed && !url.value && !poster.value) queueMicrotask(preparePreview);
  }
}
function readDimensions() {
  const width = player.value?.videoWidth, height = player.value?.videoHeight;
  if (width > 0 && height > 0) { aspect.value = width / height; nextTick(() => emit('resize')); }
}
function action(command) {
  if (command === 'download') emit('download');
  else if (command === 'convert') convert();
  else if (command === 'cancel') cancel();
}
const host = ref(null), player = ref(null), url = ref(''), loading = ref(false), converting = ref(false),
  converted = ref(false), error = ref(''), percent = ref(0);
let original, originalRequest, readController, controller, disposed = false, observer;
const formatBytes = value => Number(value) < 1024 * 1024 ? `${(Number(value || 0) / 1024).toFixed(1)} KB` : `${(Number(value) / 1024 / 1024).toFixed(1)} MB`;
async function originalBlob() {
  if (disposed) throw new DOMException('Cancelled', 'AbortError');
  if (original) return original;
  if (originalRequest && readController?.signal.aborted) {
    await originalRequest.catch(() => {});
    return originalBlob();
  }
  if (!originalRequest) {
    readController = new AbortController();
    originalRequest = (async () => {
      if (Number(props.file.size) > 50 * 1024 * 1024) throw Error('videoLoadFailed');
      const blob = await props.load({ signal: readController.signal });
      if (blob.size > 50 * 1024 * 1024) throw Error('videoLoadFailed');
      if (disposed) throw new DOMException('Cancelled', 'AbortError');
      original = blob;
      return blob;
    })().finally(() => { originalRequest = null; });
  }
  return originalRequest;
}
function replaceURL(blob) {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = URL.createObjectURL(blob);
}
async function startPlayback() {
  await nextTick();
  if (!disposed && visible.value && player.value) player.value.play().catch(() => {});
}
async function play() {
  if (loading.value || converting.value) return;
  loading.value = true; error.value = '';
  previewController?.abort();
  try {
    const blob = await originalBlob();
    if (disposed) return;
    replaceURL(new Blob([blob], { type: videoMime(props.file) || 'video/mp4' }));
    await startPlayback();
  } catch (reason) { if (!disposed) error.value = reason.message === 'videoTooLarge' ? 'videoTooLarge' : 'videoLoadFailed'; }
  finally { loading.value = false; }
}
function playbackFailed() { error.value = converted.value ? 'videoConvertFailed' : 'videoUnsupported'; }
async function convert() {
  if (loading.value || converting.value || converted.value) return;
  converting.value = true;
  previewController?.abort();
  controller = new AbortController();
  const mine = controller;
  converting.value = true; percent.value = 0; error.value = '';
  try {
    const blob = await originalBlob();
    if (disposed || mine.signal.aborted) return;
    const { compatibleVideo } = await import('@/utils/compatible-video');
    const result = await compatibleVideo(blob, { signal: mine.signal, progress: value => { percent.value = value; } });
    if (disposed || mine.signal.aborted) return;
    replaceURL(result); converted.value = true;
    await startPlayback();
  } catch (reason) {
    if (!disposed && !mine.signal.aborted)
      error.value = ['videoBusy', 'videoTooLarge'].includes(reason.message) ? reason.message : 'videoConvertFailed';
  } finally { if (controller === mine) { converting.value = false; controller = null; } }
}
function cancel() { controller?.abort(); }
onMounted(() => {
  if (props.expanded) { play(); return; }
  if (!('IntersectionObserver' in window)) { preparePreview(); return; }
  visible.value = false;
  observer = new IntersectionObserver(entries => {
    visible.value = !!entries[0]?.isIntersecting;
    if (visible.value) preparePreview();
    else {
      player.value?.pause(); previewController?.abort();
      if (!url.value) original = null;
    }
  }, { rootMargin: '80px 0px' });
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => {
  disposed = true; cancel(); previewController?.abort(); readController?.abort(); observer?.disconnect(); player.value?.pause();
  if (url.value) URL.revokeObjectURL(url.value);
  if (poster.value) URL.revokeObjectURL(poster.value);
  original = null;
});
</script>
<style scoped>
.video-attachment { width:min(340px, calc(min(400px, 55dvh) * var(--video-aspect))); max-width:100%; overflow:hidden; }
.video-frame { position:relative; border-radius:10px; overflow:hidden; background:#101820; }
video { display:block; width:100%; height:auto; object-fit:contain; background:#101820; }
.video-start { position:relative; display:flex; width:100%; aspect-ratio:var(--video-aspect); border:0; align-items:center; justify-content:center; flex-direction:column; gap:6px; cursor:pointer; background:#101820; color:white; }
.video-start:disabled { opacity:.6; cursor:wait; }
.video-caption { display:flex; align-items:baseline; gap:8px; margin:5px 2px 0; min-width:0; }
.video-caption strong { flex:1; font-size:11px; font-weight:400; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; min-width:0; color:var(--el-text-color-regular); }
.video-caption small { flex-shrink:0; color:var(--el-text-color-secondary); font-size:10px; }
.video-status { margin:5px 2px 0; font-size:12px; overflow-wrap:anywhere; }
.video-status button { border:0; padding:2px; background:none; font:inherit; color:var(--el-color-primary); cursor:pointer; }
.video-actions { position:absolute; inset-block-start:6px; inset-inline-end:6px; display:flex; gap:4px; }
.video-actions button { display:grid; place-items:center; width:28px; height:28px; padding:0; border:0; border-radius:50%; background:#0008; color:white; cursor:pointer; }
.video-actions button:hover { background:#000c; }.video-actions button:focus-visible { outline:2px solid white; outline-offset:1px; }
.video-attachment.expanded { width:min(1100px,100%); }
.expanded .video-frame { background:transparent; }
.expanded video { width:auto; max-width:100%; max-height:calc(100dvh - 130px); margin:auto; }
.expanded .video-start { max-height:calc(100dvh - 130px); }
.video-poster { display:block; position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
.video-play-icon { z-index:1; display:grid; place-items:center; width:52px; height:52px; border-radius:50%; background:#0007; }
.video-placeholder { z-index:1; font-size:12px; }
.video-duration,.video-size { position:absolute; z-index:1; padding:2px 6px; border-radius:8px; color:white; background:#0008; font-size:11px; line-height:1.5; pointer-events:none; }
.video-duration { bottom:7px; inset-inline-end:7px; }.video-size { top:7px; inset-inline-start:7px; }
.preview-loading { background:linear-gradient(120deg,#142433,#28404e,#142433); }
</style>
