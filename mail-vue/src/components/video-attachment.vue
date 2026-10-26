<template>
  <div ref="host" class="video-attachment" :aria-busy="loading || converting" @pointerdown.stop @touchstart.stop @contextmenu.stop>
    <video v-if="url" ref="player" :src="url" controls playsinline preload="metadata" :aria-label="file.filename" @error="playbackFailed" />
    <button v-else class="video-start" type="button" :disabled="loading || converting" @click="play">
      <Icon icon="cloud-mail:play" width="38" aria-hidden="true" />
      <span>{{ t(loading ? 'videoLoading' : 'videoPlay') }}</span>
    </button>
    <div class="video-caption"><strong :title="file.filename">{{ file.filename }}</strong><small>{{ formatBytes(file.size) }}</small></div>
    <p v-if="converting" class="video-status" role="status">{{ t('videoConverting', { percent: percent }) }}</p>
    <p v-else-if="error" class="video-status" role="status">{{ t(error) }}</p>
    <div class="video-actions">
      <button v-if="converting" type="button" @click="cancel">{{ t('cancel') }}</button>
      <button v-else-if="!converted" type="button" :disabled="loading" @click="convert">{{ t('videoCompatible') }}</button>
      <button type="button" @click="$emit('download')">{{ t('videoDownload') }}</button>
    </div>
  </div>
</template>
<script setup>
import { ref, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { videoMime } from '@/utils/video-files.mjs';
const props = defineProps({ file: { type: Object, required: true }, load: { type: Function, required: true } });
defineEmits(['download']);
const { t } = useI18n();
const visible = ref(true);
const host = ref(null), player = ref(null), url = ref(''), loading = ref(false), converting = ref(false),
  converted = ref(false), error = ref(''), percent = ref(0);
let original, controller, disposed = false, observer;
const formatBytes = value => Number(value) < 1024 * 1024 ? `${(Number(value || 0) / 1024).toFixed(1)} KB` : `${(Number(value) / 1024 / 1024).toFixed(1)} MB`;
async function originalBlob() {
  if (!original) {
    if (Number(props.file.size) > 50 * 1024 * 1024) throw Error('videoLoadFailed');
    const blob = await props.load();
    if (blob.size > 50 * 1024 * 1024) throw Error('videoLoadFailed');
    if (disposed) throw new DOMException('Cancelled', 'AbortError');
    original = blob;
  }
  return original;
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
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    visible.value = !!entries[0]?.isIntersecting;
    if (!visible.value) player.value?.pause();
  });
  if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => {
  disposed = true; cancel(); observer?.disconnect(); player.value?.pause();
  if (url.value) URL.revokeObjectURL(url.value);
  original = null;
});
</script>
<style scoped>
.video-attachment { width: min(300px, 100%); max-width: 100%; overflow: hidden; }
video, .video-start { display: flex; width: 100%; height: auto; aspect-ratio: 16 / 9; max-height: 280px; border-radius: 9px; background: #101820; color: white; }
.video-start { border: 0; align-items: center; justify-content: center; flex-direction: column; gap: 6px; cursor: pointer; min-height: 130px; }
.video-start:disabled { opacity: .6; cursor: wait; }
.video-caption { display: flex; align-items: baseline; gap: 8px; margin: 6px 0 2px; }
.video-caption strong { font-size: 12px; font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; }
.video-caption small { flex-shrink: 0; color: var(--el-text-color-secondary); font-size: 11px; }
.video-status { margin: 5px 0; font-size: 12px; overflow-wrap: anywhere; }
.video-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.video-actions button { border: 0; padding: 4px 0; background: none; font: inherit; color: var(--el-color-primary); font-size: 12px; cursor: pointer; }
.video-actions button:disabled { color: var(--el-text-color-secondary); cursor: default; }
</style>
