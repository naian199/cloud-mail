<template>
  <el-drawer
    class="conversation-explorer"
    v-model="opened"
    :title="t('exploreTitle')"
    size="min(520px, 100vw)"
    append-to-body
    destroy-on-close
  >
    <p class="explorer-peer" translate="no">{{ peer }}</p>
    <form class="explorer-filters" @submit.prevent="load(true)">
      <el-input
        v-model="term"
        maxlength="200"
        clearable
        :placeholder="t('exploreSearch')"
        :aria-label="t('exploreSearch')"
      />
      <div class="explorer-dates">
        <label>{{ t('exploreStart') }}<input v-model="start" type="date" /></label>
        <label>{{ t('exploreEnd') }}<input v-model="end" type="date" :min="start" /></label>
      </div>
      <el-button type="primary" native-type="submit" :loading="loading">{{
        t('exploreSearch')
      }}</el-button>
    </form>
    <el-tabs v-model="tab" stretch>
      <el-tab-pane :label="t('exploreSearch')" name="messages" />
      <el-tab-pane :label="t('exploreImages')" name="images" />
      <el-tab-pane :label="t('exploreFiles')" name="files" />
      <el-tab-pane :label="t('exploreLinks')" name="links" />
    </el-tabs>
    <p v-if="error" role="alert">{{ t(error) }}</p>
    <div class="explorer-results" :class="{ 'image-grid': tab === 'images' }" :aria-busy="loading">
      <template v-for="item in visibleItems" :key="item.emailId">
        <article v-if="tab === 'messages'" class="explorer-item">
          <small
            >{{ time(item.createTime) }} · <span translate="no">{{ item.sendEmail }}</span></small
          >
          <p>{{ item.text || t('exploreImages') }}</p>
          <el-button text @click="jump(item)">{{ t('exploreJump') }}</el-button>
        </article>
        <div
          v-for="image in tab === 'images' ? item.images : []"
          :key="image.attId || image.src"
          class="explorer-photo"
        >
          <el-image
            :src="image.src || urls[image.attId]"
            fit="cover"
            loading="lazy"
            :alt="image.alt || t('mailChatImage')"
            :preview-src-list="[image.src || urls[image.attId]].filter(Boolean)"
            preview-teleported
            referrerpolicy="no-referrer"
          >
            <template #error
              ><el-button text @click="loadImage(image.attId)">{{
                t('mailChatImageRetry')
              }}</el-button></template
            >
          </el-image>
          <el-button text size="small" @click="jump(item)">{{ t('exploreJump') }}</el-button>
        </div>
        <template v-if="tab === 'files'">
          <article v-for="file in item.attachments" :key="file.attId" class="explorer-item">
            <el-button text @click="download(file)"
              >{{ file.filename }} · {{ formatBytes(file.size) }}</el-button
            >
            <el-button text size="small" @click="jump(item)">{{ t('exploreJump') }}</el-button>
          </article>
        </template>
        <template v-if="tab === 'links'">
          <article v-for="url in item.links" :key="url" class="explorer-item">
            <a :href="url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{
              url
            }}</a>
            <el-button text size="small" @click="jump(item)">{{ t('exploreJump') }}</el-button>
          </article>
        </template>
      </template>
    </div>
    <el-empty v-if="!loading && !visibleItems.length" :image-size="64" />
    <el-button v-if="hasMore" class="explorer-more" :loading="loading" @click="load(false)">{{
      t('chatOlder')
    }}</el-button>
  </el-drawer>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mailExplore, mailAttachment } from '@/request/mail-chat';
import { formatBytes } from '@/utils/file-utils';
const props = defineProps({
  accountId: Number,
  conversationKey: String,
  peer: String,
  revision: Number
});
const emit = defineEmits(['jump']);
const { t, locale } = useI18n();
const opened = ref(false),
  term = ref(''),
  start = ref(''),
  end = ref(''),
  tab = ref('messages');
const rows = ref([]),
  loading = ref(false),
  hasMore = ref(false),
  error = ref(''),
  urls = ref({});
let before,
  revision,
  generation = 0,
  filters = {};
const imageRequests = new Set();
const visibleItems = computed(() =>
  rows.value.filter(
    (item) =>
      tab.value === 'messages' || item[tab.value === 'files' ? 'attachments' : tab.value]?.length
  )
);
function time(value) {
  return new Date(
    value.replace(' ', 'T') + (/[Z+]\d*:?\d*$/.test(value) ? '' : 'Z')
  ).toLocaleString(locale.value);
}
function reset() {
  generation++;
  rows.value = [];
  before = undefined;
  revision = undefined;
  hasMore.value = false;
  loading.value = false;
  Object.values(urls.value).forEach(URL.revokeObjectURL);
  urls.value = {};
  imageRequests.clear();
}
function open() {
  opened.value = true;
  term.value = '';
  start.value = '';
  end.value = '';
  tab.value = 'messages';
  load(true);
}
defineExpose({ open });
function dateBound(value, next = false) {
  if (!value) return undefined;
  const date = new Date(value + 'T00:00:00');
  if (next) date.setDate(date.getDate() + 1);
  return date.toISOString();
}
async function load(fresh) {
  if (fresh) reset();
  if (loading.value || !opened.value) return;
  const mine = generation;
  loading.value = true;
  error.value = '';
  try {
    if (fresh)
      filters = {
        search: term.value,
        start: dateBound(start.value),
        end: dateBound(end.value, true)
      };
    const data = await mailExplore({
      accountId: props.accountId,
      key: props.conversationKey,
      ...filters,
      before
    });
    if (mine !== generation) return;
    if (revision !== undefined && revision !== data.revision) {
      reset();
      load(true);
      return;
    }
    revision = data.revision;
    rows.value.push(
      ...data.items.filter((item) => !rows.value.some((row) => row.emailId === item.emailId))
    );
    before = data.before;
    hasMore.value = data.hasMore;
    await thumbnails();
  } catch (failure) {
    if (mine === generation) error.value = failure?.errorKey || 'serviceUnavailable';
  } finally {
    if (mine === generation) loading.value = false;
  }
}
async function loadImage(id) {
  if (!id || urls.value[id] || imageRequests.has(id)) return;
  const mine = generation;
  imageRequests.add(id);
  try {
    const blob = await mailAttachment(id);
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const mime =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
        ? 'image/png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? 'image/jpeg'
          : /^GIF8[79]a$/.test(String.fromCharCode(...bytes.slice(0, 6)))
            ? 'image/gif'
            : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
                String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
              ? 'image/webp'
              : '';
    if (mime && mine === generation)
      urls.value[id] = URL.createObjectURL(new Blob([blob], { type: mime }));
  } catch {
    /* Retry remains available without exposing a private attachment URL. */
  } finally {
    if (mine === generation) imageRequests.delete(id);
  }
}
async function thumbnails() {
  const mine = generation;
  if (tab.value !== 'images') return;
  // Fetch private thumbnails sequentially instead of flooding storage with parallel requests.
  for (const item of rows.value)
    for (const image of item.images) {
      if (mine !== generation || !opened.value || tab.value !== 'images') return;
      if (image.attId) await loadImage(image.attId);
    }
}
async function download(file) {
  const mine = generation;
  try {
    const blob = await mailAttachment(file.attId);
    if (mine !== generation) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    if (mine === generation) error.value = 'serviceUnavailable';
  }
}
function jump(item) {
  emit('jump', item.emailId);
  opened.value = false;
}
watch(tab, thumbnails);
watch(opened, (value) => {
  if (!value) reset();
});
watch(
  () => [props.accountId, props.conversationKey, props.revision],
  () => {
    reset();
    if (opened.value) load(true);
  }
);
onBeforeUnmount(reset);
</script>
<style scoped>
:global(.conversation-explorer.el-drawer) {
  max-width: 100vw;
  transition-property: transform, opacity;
}

.explorer-peer {
  overflow-wrap: anywhere;
  font-weight: 600;
  margin-bottom: 14px;
}
.explorer-filters {
  display: grid;
  gap: 10px;
}
.explorer-filters :deep(input) {
  font-size: 16px;
}
.explorer-dates {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.explorer-dates label {
  display: grid;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
}
.explorer-dates input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color);
  border-radius: 5px;
  padding: 8px 4px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  font: inherit;
}
.explorer-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-light);
  overflow-wrap: anywhere;
}
.explorer-item p {
  white-space: pre-wrap;
  margin: 8px 0;
}
.explorer-item small {
  color: var(--el-text-color-secondary);
}
.explorer-item .el-button {
  max-width: 100%;
  height: auto;
  white-space: normal;
  text-align: start;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.explorer-photo {
  min-width: 0;
  display: grid;
}
.explorer-photo .el-image {
  width: 100%;
  height: 150px;
  border-radius: 8px;
  background: var(--el-fill-color);
}
.explorer-more {
  margin-top: 16px;
  width: 100%;
}
</style>
