<template>
  <el-popover
    v-model:visible="opened"
    trigger="click"
    placement="top-start"
    :width="320"
    popper-class="sticker-picker-popover"
    @show="init"
  >
    <template #reference
      ><el-button class="sticker-trigger" :disabled="disabled" text :aria-label="t('stickersTitle')"
        >☺</el-button
      ></template
    >
    <div class="sticker-picker">
      <el-tabs v-model="tab" stretch
        ><el-tab-pane :label="t('stickersEmoji')" name="emoji" /><el-tab-pane
          :label="t('stickersTitle')"
          name="stickers"
      /></el-tabs>
      <template v-if="tab === 'emoji'">
        <el-input
          v-model="query"
          clearable
          :placeholder="t('mailChatSearch')"
          @input="limit = 120"
        />
        <div class="emoji-grid">
          <button
            v-for="item in filteredEmoji.slice(0, limit)"
            :key="item.native"
            type="button"
            :title="item.name"
            @click="emit('emoji', item.native)"
          >
            {{ item.native }}
          </button>
        </div>
        <el-button v-if="filteredEmoji.length > limit" text @click="limit += 120">{{
          t('chatOlder')
        }}</el-button>
      </template>
      <template v-else>
        <form @submit.prevent="importPack">
          <el-input
            v-model="packInput"
            maxlength="300"
            :placeholder="t('stickersLink')"
            :aria-label="t('stickersLink')"
          /><el-button native-type="submit" :loading="loading">{{ t('stickersImport') }}</el-button>
        </form>
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
      </template>
    </div>
  </el-popover>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import http from '@/axios';
import StickerMedia from './sticker-media.vue';
import { fileToBase64 } from '@/utils/file-utils';
const props = defineProps({ disabled: Boolean });
const emit = defineEmits(['emoji', 'attachment', 'upload']);
const { t } = useI18n();
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
  max-height: min(420px, 55dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
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
}
button:hover {
  background: var(--el-fill-color);
  border-radius: 6px;
}
form {
  display: flex;
  gap: 5px;
}
form .el-input {
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
