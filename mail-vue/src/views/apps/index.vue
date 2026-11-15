<template>
  <div class="store">
    <header class="store-head">
      <div class="store-title">
        <h1>{{ t('navStore') }}</h1>
        <p>{{ t('appStoreHint') }}</p>
      </div>
      <RouterLink v-if="canPublish" to="/apps/publish" class="store-publish"><Icon icon="cloud-mail:upload" width="18" />{{ t('appPublishTitle') }}</RouterLink>
    </header>
    <div class="store-tools">
      <el-input v-model="q" class="store-search" clearable :placeholder="t('appSearch')" :aria-label="t('appSearch')" @input="queue">
        <template #prefix><Icon icon="cloud-mail:search" width="16" /></template>
      </el-input>
      <div class="store-platforms" role="group" :aria-label="t('appPlatform')">
        <button v-for="p in ['', ...platforms]" :key="p || 'all'" type="button" class="platform" :class="{ active: platform === p }"
          :aria-pressed="platform === p" @click="setPlatform(p)">{{ p ? t('appPlatform_' + p) : t('appAll') }}</button>
      </div>
    </div>

    <ListState :state="error" :retrying="loading" @retry="load()" />
    <div v-if="!error || apps.length" class="store-grid" v-loading="loading && !apps.length">
      <RouterLink v-for="app in apps" :key="app.appId" :to="`/apps/${app.appId}`" class="store-item" :data-app="app.appId">
        <span class="store-icon" :style="{ background: tint(app.name) }" aria-hidden="true">{{ initial(app.name) }}</span>
        <span class="store-copy">
          <strong>{{ app.name }}</strong>
          <small>{{ app.publisherName || t('appCategory_' + app.category) }}</small>
          <span class="store-summary">{{ app.summary }}</span>
          <span class="store-meta"><span v-for="p in app.platforms" :key="p" class="chip">{{ t('appPlatform_' + p) }}</span><span v-if="app.latestVersion" class="version">v{{ app.latestVersion }}</span></span>
        </span>
      </RouterLink>
    </div>
    <div v-if="loaded && !error && !apps.length" class="store-empty">
      <Icon icon="cloud-mail:store" width="44" />
      <p>{{ filtered ? t('appNoMatch') : t('appEmpty') }}</p>
      <el-button v-if="filtered" @click="clearFilters">{{ t('appClearFilters') }}</el-button>
    </div>
    <el-button v-if="hasMore && !error" class="store-more" :loading="loading" @click="load(page + 1)">{{ t('mailChatMoreConversations') }}</el-button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import ListState from '@/components/list-state.vue';
import { appList } from '@/request/apps';
import { hasPerm } from '@/perm/perm.js';

defineOptions({ name: 'apps' });
const { t } = useI18n();
const route = useRoute(), router = useRouter();
const platforms = ['android', 'ios', 'windows', 'macos', 'linux', 'web'];
// Search and platform live in the address, so Back and refresh keep the same filtered list.
const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
const platform = ref(platforms.includes(route.query.platform) ? route.query.platform : '');
const apps = ref([]), page = ref(0), hasMore = ref(false), loading = ref(false), loaded = ref(false), error = ref('');
const canPublish = computed(() => hasPerm('app:publish'));
const filtered = computed(() => !!(q.value.trim() || platform.value));
let generation = 0, timer;

async function load(next = 0) {
  const mine = ++generation;
  loading.value = true;
  try {
    const data = await appList({ q: q.value.trim(), platform: platform.value, page: next });
    if (mine !== generation) return;
    apps.value = next ? [...apps.value, ...data.apps] : data.apps;
    page.value = next; hasMore.value = data.hasMore; loaded.value = true; error.value = '';
  } catch {
    if (mine === generation) error.value = loaded.value ? 'stale' : 'failed';
  } finally {
    if (mine === generation) loading.value = false;
  }
}
function syncAddress() {
  // A search typed just before opening an app must not write onto the app's address.
  if (route.name !== 'apps') return;
  const query = {};
  if (q.value.trim()) query.q = q.value.trim();
  if (platform.value) query.platform = platform.value;
  router.replace({ query });
}
function queue() { clearTimeout(timer); timer = setTimeout(() => { if (route.name !== 'apps') return; syncAddress(); load(); }, 300); }
function setPlatform(p) { platform.value = p; syncAddress(); load(); }
function clearFilters() { q.value = ''; platform.value = ''; syncAddress(); load(); }
watch(() => [route.query.q, route.query.platform], ([nq, np]) => {
  if (route.name !== 'apps') return;
  const a = typeof nq === 'string' ? nq : '', b = platforms.includes(np) ? np : '';
  if (a !== q.value.trim() || b !== platform.value) { q.value = a; platform.value = b; load(); }
});
const initial = (name) => Array.from(name || '?')[0].toUpperCase();
function tint(name) {
  let h = 0; for (const ch of name || '') h = (h * 31 + ch.codePointAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}
load();
</script>

<style scoped>
.store { height:100%; overflow-y:auto; box-sizing:border-box; padding:24px max(16px, calc((100% - 1120px) / 2)) 32px; }
.store-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.store-title h1 { margin:0; font-size:26px; letter-spacing:-.01em; }
.store-title p { margin:6px 0 0; color:var(--el-text-color-secondary); font-size:13px; }
.store-publish { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; background:var(--el-color-primary); color:#fff; text-decoration:none; font-size:13px; font-weight:600; }
.store-tools { display:flex; flex-direction:column; gap:12px; margin:20px 0 16px; }
.store-search { max-width:520px; }
.store-search :deep(.el-input__wrapper) { border-radius:12px; padding:4px 12px; }
.store-platforms { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
.platform { flex-shrink:0; padding:6px 14px; border-radius:18px; border:1px solid var(--el-border-color); background:var(--el-bg-color); color:var(--el-text-color-regular); font-size:13px; cursor:pointer; }
.platform.active { border-color:var(--el-color-primary); background:var(--el-color-primary-light-9); color:var(--el-color-primary); font-weight:600; }
.platform:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:2px; }
.store-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap:14px; min-height:80px; }
.store-item { display:flex; gap:14px; padding:16px; border-radius:16px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); color:inherit; text-decoration:none; transition:box-shadow .15s, transform .15s, border-color .15s; }
.store-item:hover { border-color:var(--el-color-primary-light-7); box-shadow:0 6px 20px rgb(15 23 42 / 8%); transform:translateY(-1px); }
.store-item:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:2px; }
.store-icon { display:grid; place-items:center; flex-shrink:0; width:56px; height:56px; border-radius:15px; color:#fff; font-size:24px; font-weight:700; }
.store-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
.store-copy strong { font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.store-copy small { color:var(--el-text-color-secondary); font-size:12px; }
.store-summary { font-size:13px; color:var(--el-text-color-regular); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.store-meta { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; font-size:11px; color:var(--el-text-color-secondary); align-items:center; }
.chip { padding:2px 8px; border-radius:10px; background:var(--el-fill-color-light); }
.store-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:56px 16px; color:var(--el-text-color-secondary); text-align:center; }
.store-empty p { margin:0; }
.store-more { display:block; margin:18px auto 0; }
</style>
