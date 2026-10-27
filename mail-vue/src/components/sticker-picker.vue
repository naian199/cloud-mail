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
              :disabled="loading || sending"
            /><el-button :loading="loading" :disabled="!packInput.trim() || sending" @click="importPack">{{
              t('stickersImport')
            }}</el-button>
          </div>
          <div class="sticker-upload-row"><el-button size="small" :disabled="sending" @click="uploadInput?.click()">{{ t('stickersUploadAction') }}</el-button><small>WebP · TGS · WebM</small><input ref="uploadInput" type="file" hidden accept=".webp,.tgs,.webm,image/webp,video/webm,application/x-tgsticker" multiple @change="upload" /></div>
          <p v-if="!pack" class="sticker-hint">{{ t('stickersImportHint') }}</p>
          <p v-if="pack?.partial" class="sticker-preview-note" role="status">{{ t('stickersPublicPreview') }}</p>
          <p v-if="error" class="sticker-error" role="alert">{{ t(error) }}</p>
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
              :key="`${pack.name}:${sticker.id}`"
              type="button"
              :aria-label="sticker.emoji"
              :disabled="sending || loading || disabled"
              @click="choose(sticker)"
            >
              <StickerMedia
                :format="pack.source === 'public' ? 'image' : sticker.format"
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
import {packName as normalizePackName} from '../../../shared/telegram-pack-name.mjs';
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
onBeforeUnmount(() => {disposed=true;invalidate();emit('visibility', false);});

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
const uploadInput=ref();
const filteredEmoji = computed(() => {
  const q = query.value.trim().toLowerCase();
  return emoji.value.filter((e) => !q || e.name.includes(q) || e.native.includes(q));
});
watch(
  opened,
  (value) => {
    emit('visibility', value);
    if (value) init();
    else invalidate();
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
  version = 0, pending, disposed=false;
const blobCache=new Map();
function invalidate(){version++;pending?.abort();pending=null;loading.value=false;sending.value=false;blobCache.clear();}
function errorKey(error){return ['stickersErrorLink','stickersErrorConfig','stickersErrorAuth','stickersErrorNotFound','stickersErrorNetwork','stickersErrorEmpty','stickersErrorPublic'].includes(error?.message)?error.message:'stickersErrorNetwork';}
async function init() {
  if (initialized || disposed) return;
  initialized = true;
  try {
    const data = (await import('@emoji-mart/data')).default;
    if(disposed)return;
    if(!opened.value){initialized=false;return;}
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
async function loadPack(value=activeName.value) {
  let name;try{name=normalizePackName(value);}catch{error.value='stickersErrorLink';return null;}
  const current=++version;pending?.abort();pending=new AbortController();
  loading.value=true;error.value='';
  try{
    const data=await http.get('/mail-chat/stickers/pack',{params:{name},signal:pending.signal,noMsg:true,timeout:35000});
    if(current!==version)return null;
    pack.value=data;activeName.value=data.name;blobCache.clear();return data;
  }catch(failure){if(current===version){error.value=errorKey(failure);if(pack.value)activeName.value=pack.value.name;}return null;}
  finally{if(current===version){loading.value=false;pending=null;}}
}
async function importPack(){
  if(loading.value||sending.value)return;
  const data=await loadPack(packInput.value);if(!data)return;
  names.value=[data.name,...names.value.filter(name=>name.toLowerCase()!==data.name.toLowerCase())].slice(0,20);
  try{localStorage.setItem('cloud-mail:sticker-packs',JSON.stringify(names.value));}catch{}
  packInput.value='';
}
async function loadFile(sticker) {
  const name=pack.value?.name;if(!name)throw Error('stickersErrorNetwork');
  const key=`${name}:${sticker.id}`;if(blobCache.has(key))return blobCache.get(key);
  const current=version;
  const url = new URL(`${import.meta.env.VITE_BASE_URL}/mail-chat/stickers/file`, location.origin);
  url.search = new URLSearchParams({ name, id: sticker.id });
  const response = await fetch(url, {
    headers: { Authorization: localStorage.getItem('token') || '' }
  });
  if (response.headers.get('content-type')?.includes('application/json')) {
    const failure=await response.json();throw Error(errorKey(failure));
  }
  if (!response.ok) throw Error('stickersErrorNetwork');
  const blob=await response.blob();if(current===version){blobCache.set(key,blob);if(blobCache.size>24)blobCache.delete(blobCache.keys().next().value);}
  return blob;
}
async function choose(sticker) {
  if (sending.value || props.disabled) return;
  sending.value = true;
  const current=version,context=props.context,source=pack.value?.source;
  error.value = '';
  try {
    const blob = await loadFile(sticker);
    if(current!==version||context!==props.context||props.disabled)return;
    const content=await fileToBase64(blob);
    if(current!==version||context!==props.context||props.disabled)return;
    const format=source==='public'?({'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[blob.type]||'webp'):sticker.format;
    emit('attachment', {
      filename: `sticker.${format}`,
      size: blob.size,
      contentType:
        source==='public'?blob.type:sticker.format === 'webp'
          ? 'image/webp'
          : sticker.format === 'webm'
            ? 'video/webm'
            : 'application/x-tgsticker',
      content
    });
    opened.value = false;
  } catch(failure) {
    if(current===version)error.value=errorKey(failure);
  } finally {
    if(current===version)sending.value = false;
  }
}
function upload(event) {
  if(!event.target.files?.length)return;
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
.sticker-import>.el-button{font-size:13px;padding:8px 12px;flex-shrink:0;min-height:32px;background:var(--el-color-primary);color:var(--el-color-white);border-radius:6px;}
.sticker-upload-row{display:flex;align-items:center;gap:8px;margin-top:10px;}
.sticker-upload-row .el-button{font-size:12px;padding:6px 10px;border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-fill-color-light);}
.sticker-upload-row small,.sticker-hint{color:var(--el-text-color-secondary);font-size:11px;}
.sticker-preview-note{color:var(--el-color-warning);}
.sticker-error{color:var(--el-color-danger);}
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
.sticker-grid>button{display:grid;place-items:center;min-width:0;min-height:82px;padding:3px;}
.sticker-grid :deep(.sticker-media) {
  width: 76px;
  height: 76px;
  overflow:hidden;
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
