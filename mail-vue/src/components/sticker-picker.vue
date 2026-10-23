<template>
  <el-popover
    v-if="!compact"
    v-model:visible="opened"
    trigger="click"
    placement="top-start"
    :width="320"
    popper-class="sticker-picker-popover"
  >
    <template #reference
      ><el-button class="sticker-trigger" :disabled="disabled" text :aria-label="t('stickersTitle')"
        >☺</el-button
      ></template
    >
    <div ref="desktopHost"></div>
  </el-popover>
  <el-button
    v-else
    class="sticker-trigger"
    :disabled="disabled"
    text
    :aria-label="t('stickersTitle')"
    :aria-expanded="opened"
    @click="opened = !opened"
    >☺</el-button
  >
  <Teleport v-if="opened && panelTarget" :to="panelTarget">
    <div
      class="sticker-picker"
      :class="{ 'sticker-picker-docked': compact }"
      @pointerdown.capture="beginDrag"
      @pointermove.capture="moveDrag"
      @pointercancel.capture="dragged = true"
      @touchstart.passive="beginTouch"
      @touchmove.passive="moveTouch"
      @click.capture="guardClick"
    >
      <div class="picker-heading">
        <el-tabs v-model="tab" stretch
          ><el-tab-pane :label="t('stickersEmoji')" name="emoji" /><el-tab-pane
            :label="t('stickersTitle')"
            name="stickers"
        /></el-tabs>
        <el-button text class="picker-close" :aria-label="t('chatBack')" @click="close"
          >×</el-button
        >
      </div>
      <template v-if="tab === 'emoji'">
        <el-input
          v-model="query"
          clearable
          :placeholder="t('mailChatSearch')"
          @input="limit = 120"
          @keydown.enter.prevent
        />
        <div class="picker-results" ref="results">
          <div class="emoji-grid">
            <button
              v-for="item in filteredEmoji.slice(0, limit)"
              :key="item.native"
              type="button"
              :title="item.name"
              @click="chooseEmoji(item.native)"
            >
              {{ item.native }}
            </button>
          </div>
          <el-button v-if="filteredEmoji.length > limit" text @click="limit += 120">{{
            t('chatOlder')
          }}</el-button>
        </div>
      </template>
      <template v-else>
        <div class="picker-results" ref="results">
          <div class="sticker-import" @keydown.enter.prevent.stop="importPack">
            <el-input
              v-model="packInput"
              maxlength="300"
              :placeholder="t('stickersLink')"
              :aria-label="t('stickersLink')"
            /><el-button :loading="loading" @click="importPack">{{
              t('stickersImport')
            }}</el-button>
          </div>
          <label class="upload-sticker"
            >{{ t('stickersUpload')
            }}<input
              type="file"
              accept=".webp,.tgs,.webm,image/webp,video/webm,application/x-tgsticker"
              multiple
              @change="upload"
          /></label>
          <p v-if="error" role="status">{{ t(error) }}</p>
          <el-select
            v-if="names.length"
            v-model="activeName"
            :aria-label="t('stickersTitle')"
            @change="loadPack"
            ><el-option v-for="name in names" :key="name" :value="name" :label="name"
          /></el-select>
          <div class="sticker-grid">
            <button
              v-for="sticker in pack?.stickers || []"
              :key="sticker.id"
              type="button"
              :aria-label="sticker.emoji"
              :disabled="sending"
              @click="choose(sticker)"
            >
              <StickerMedia
                :format="sticker.format"
                :label="sticker.emoji"
                :load="() => loadFile(sticker)"
              />
            </button>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>
<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import http from '@/axios';
import StickerMedia from './sticker-media.vue';
import { fileToBase64 } from '@/utils/file-utils';
const props = defineProps({ disabled: Boolean, compact: Boolean, dock: Object, context: String });
const emit = defineEmits(['emoji', 'attachment', 'upload', 'visibility']);
const { t } = useI18n();
const desktopHost = ref(null),
  results = ref(null);
const panelTarget = computed(() => (props.compact ? props.dock : desktopHost.value));
let dragStart = null,
  dragged = false;
function beginDrag(event) {
  dragStart = { x: event.clientX, y: event.clientY };
  dragged = false;
}
function moveDrag(event) {
  if (dragStart && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 8)
    dragged = true;
}
function beginTouch(event) {
  const touch = event.touches[0];
  if (touch) beginDrag(touch);
}
function moveTouch(event) {
  const touch = event.touches[0];
  if (touch) moveDrag(touch);
}
function guardClick(event) {
  if (dragged) {
    event.preventDefault();
    event.stopPropagation();
  }
}
function chooseEmoji(value) { emit('emoji', value); if (!props.compact) close(); }
function close() {
  opened.value = false;
}
defineExpose({ close });
onBeforeUnmount(() => emit('visibility', false));

const opened = ref(false),
  tab = ref('emoji'),
  query = ref(''),
  emoji = ref([]),
  limit = ref(120),
  packInput = ref(''),
  activeName = ref(''),
  names = ref([]),
  pack = ref(null),
  loading = ref(false),
  sending = ref(false),
  error = ref('');
const filteredEmoji = computed(() => {
  const q = query.value.trim().toLowerCase();
  return emoji.value.filter((e) => !q || e.name.includes(q) || e.native.includes(q));
});
watch(
  opened,
  (value) => {
    emit('visibility', value);
    if (value) init();
  },
  { flush: 'sync' }
);
watch([() => props.compact, () => props.context], close);
watch([tab, query, activeName], () =>
  nextTick(() => {
    if (results.value) results.value.scrollTop = 0;
  })
);
let initialized = false,
  version = 0;
async function init() {
  if (initialized) return;
  initialized = true;
  try {
    const data = (await import('@emoji-mart/data')).default;
    emoji.value = Object.values(data.emojis).flatMap((e) =>
      e.skins.map((s) => ({
        native: s.native,
        name: [e.name, e.id, ...(e.keywords || [])].join(' ').toLowerCase()
      }))
    );
    const saved = JSON.parse(localStorage.getItem('cloud-mail:sticker-packs') || '[]');
    names.value = Array.isArray(saved)
      ? saved.filter((s) => typeof s === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(s)).slice(0, 20)
      : [];
    if (names.value.length) {
      activeName.value = names.value[0];
      loadPack();
    }
  } catch {
    error.value = 'stickersError';
  }
}
async function loadPack() {
  const current = ++version;
  loading.value = true;
  pack.value = null;
  error.value = '';
  try {
    const data = await http.get('/mail-chat/stickers/pack', {
      params: { name: activeName.value },
      noMsg: true
    });
    if (current === version) pack.value = data;
  } catch {
    if (current === version) error.value = 'stickersError';
  } finally {
    if (current === version) loading.value = false;
  }
}
async function importPack() {
  if (loading.value) return;
  activeName.value = packInput.value;
  await loadPack();
  if (!pack.value) return;
  activeName.value = pack.value.name;
  names.value = [pack.value.name, ...names.value.filter((n) => n !== pack.value.name)].slice(0, 20);
  try {
    localStorage.setItem('cloud-mail:sticker-packs', JSON.stringify(names.value));
  } catch {}
  packInput.value = '';
}
async function loadFile(sticker) {
  const url = new URL(`${import.meta.env.VITE_BASE_URL}/mail-chat/stickers/file`, location.origin);
  url.search = new URLSearchParams({ name: pack.value.name, id: sticker.id });
  const response = await fetch(url, {
    headers: { Authorization: localStorage.getItem('token') || '' }
  });
  if (!response.ok || response.headers.get('content-type')?.includes('application/json'))
    throw Error('Sticker unavailable');
  return response.blob();
}
async function choose(sticker) {
  if (sending.value || props.disabled) return;
  sending.value = true;
  error.value = '';
  try {
    const blob = await loadFile(sticker);
    emit('attachment', {
      filename: `sticker.${sticker.format}`,
      size: blob.size,
      contentType:
        sticker.format === 'webp'
          ? 'image/webp'
          : sticker.format === 'webm'
            ? 'video/webm'
            : 'application/x-tgsticker',
      content: await fileToBase64(blob)
    });
    opened.value = false;
  } catch {
    error.value = 'stickersError';
  } finally {
    sending.value = false;
  }
}
function upload(event) {
  emit('upload', event);
  opened.value = false;
}
</script>
<style scoped>
.sticker-trigger {
  font-size: 26px;
  padding: 0 7px;
  min-height: 36px;
}
.sticker-picker {
  height: min(420px, 55dvh);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.sticker-picker-docked {
  height: min(340px, calc(var(--chat-viewport-height, 100dvh) * 0.42));
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-light);
  margin-top: 6px;
}
.picker-heading {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: flex-start;
}
.picker-heading .el-tabs {
  flex: 1;
  min-width: 0;
}
.picker-heading .picker-close {
  font-size: 22px;
  padding: 8px;
}
.sticker-picker > .el-input {
  flex-shrink: 0;
  margin-bottom: 4px;
}
.picker-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-anchor: none;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding-top: 8px;
}
button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  min-height: 40px;
  font-size: 25px;
  padding: 3px;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
}
button:hover {
  background: var(--el-fill-color);
  border-radius: 6px;
}
.sticker-import {
  display: flex;
  gap: 5px;
}
.sticker-import .el-input {
  min-width: 0;
}
.upload-sticker {
  display: block;
  padding: 10px 0;
  color: var(--el-color-primary);
  cursor: pointer;
}
input[type='file'] {
  width: 100%;
  font-size: 12px;
}
.sticker-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.sticker-grid :deep(.sticker-media) {
  width: 86px;
  height: 86px;
}
p {
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
<style>
.sticker-picker-popover {
  max-width: calc(100vw - 24px);
}
</style>
