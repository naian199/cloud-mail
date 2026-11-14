<template>
  <div class="app-detail">
    <div class="detail-bar">
      <button type="button" class="detail-back" :aria-label="t('navBack')" @click="back"><Icon icon="cloud-mail:back" width="22" /></button>
      <span>{{ t('navStore') }}</span>
    </div>

    <div v-if="state === 'loading'" class="detail-body" v-loading="true" style="min-height:200px"></div>
    <div v-else-if="state === 'missing'" class="detail-empty" role="alert">
      <Icon icon="cloud-mail:store" width="44" />
      <p>{{ t('appUnavailable') }}</p>
      <el-button @click="router.replace('/apps')">{{ t('navStore') }}</el-button>
    </div>
    <div v-else-if="state === 'failed'" class="detail-empty"><ListState state="failed" @retry="load" /></div>

    <div v-else class="detail-body">
      <section class="detail-hero">
        <span class="hero-icon" :style="{ background: tint(app.name) }" aria-hidden="true">{{ initial }}</span>
        <div class="hero-copy">
          <h1>{{ app.name }}</h1>
          <p class="hero-pub">
            <span v-if="app.publisherName">{{ app.publisherName }}</span>
            <span>{{ t('appCategory_' + app.category) }}</span>
            <a v-if="app.sourceUrl" :href="app.sourceUrl" target="_blank" rel="noopener noreferrer">{{ t('appSource') }}: {{ host(app.sourceUrl) }}</a>
          </p>
          <p v-if="app.summary" class="hero-summary">{{ app.summary }}</p>
          <p v-if="app.status !== 'published'" class="hero-status" :data-status="app.status">{{ t('appStatus_' + app.status) }}<template v-if="app.reviewNote"> · {{ app.reviewNote }}</template></p>
        </div>
      </section>

      <section class="detail-get">
        <template v-if="installable.length">
          <div class="get-row">
            <el-select v-model="platform" class="get-platform" :aria-label="t('appPlatform')">
              <el-option v-for="p in platformsOf" :key="p" :label="t('appPlatform_' + p)" :value="p" />
            </el-select>
            <el-select v-model="versionId" class="get-version" :aria-label="t('appVersion')">
              <el-option v-for="v in forPlatform" :key="v.versionId" :label="'v' + v.version" :value="v.versionId" />
            </el-select>
          </div>
          <div class="get-row">
            <el-button type="primary" size="large" class="get-download" :loading="downloading" :disabled="!versionId" @click="download"><Icon icon="cloud-mail:download" width="18" />&nbsp;{{ t('appDownload') }}</el-button>
            <el-button size="large" @click="share"><Icon icon="cloud-mail:share" width="18" />&nbsp;{{ t('appShare') }}</el-button>
          </div>
          <p class="get-note">{{ t('appDownloadNote') }}<template v-if="chosen"> · {{ formatBytes(chosen.size) }}</template></p>
        </template>
        <p v-else class="get-note">{{ t('appNoVersions') }}</p>
      </section>

      <section v-if="app.description" class="detail-section">
        <h2>{{ t('appAbout') }}</h2>
        <p class="detail-text">{{ app.description }}</p>
      </section>

      <section class="detail-section">
        <h2>{{ t('appVersions') }}</h2>
        <ul class="versions">
          <li v-for="v in versions" :key="v.versionId" :data-version="v.versionId">
            <div><strong>v{{ v.version }}</strong> · {{ t('appPlatform_' + v.platform) }}<span v-if="v.status !== 'published'" class="v-status" :data-status="v.status"> · {{ t('appStatus_' + v.status) }}</span></div>
            <small>{{ date(v.publishTime || v.createTime) }}<template v-if="canManage || canReview"> · {{ v.filename }} · {{ t('appClicks', { n: v.clicks }) }}</template></small>
            <p v-if="v.notes">{{ v.notes }}</p>
            <p v-if="v.reviewNote && (canManage || canReview)" class="v-note">{{ v.reviewNote }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import ListState from '@/components/list-state.vue';
import { appDetail, appDownload, appLink } from '@/request/apps';
import { goBack } from '@/utils/go-back.js';
import { formatBytes } from '@/utils/file-utils.js';

const { t, locale } = useI18n();
const route = useRoute(), router = useRouter();
const state = ref('loading'), app = ref({}), versions = ref([]), canManage = ref(false), canReview = ref(false);
const platform = ref(''), versionId = ref(0), downloading = ref(false);
const installable = computed(() => versions.value.filter((v) => v.status === 'published' && app.value.status === 'published'));
const platformsOf = computed(() => [...new Set(installable.value.map((v) => v.platform))]);
const forPlatform = computed(() => installable.value.filter((v) => v.platform === platform.value));
const chosen = computed(() => installable.value.find((v) => v.versionId === versionId.value));
const initial = computed(() => Array.from(app.value.name || '?')[0].toUpperCase());

async function load() {
  const id = Number(route.params.id);
  state.value = 'loading';
  try {
    const data = await appDetail(id);
    if (Number(route.params.id) !== id) return;
    app.value = data.app; versions.value = data.versions; canManage.value = data.canManage; canReview.value = data.canReview;
    // Default to this device's platform when the app has it.
    const ua = navigator.userAgent;
    const guess = /Android/i.test(ua) ? 'android' : /iPhone|iPad/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'macos' : /Linux/i.test(ua) ? 'linux' : '';
    platform.value = platformsOf.value.includes(guess) ? guess : platformsOf.value[0] || '';
    state.value = 'ready';
  } catch (error) {
    if (Number(route.params.id) === id) state.value = error?.code === 404 ? 'missing' : 'failed';
  }
}
watch(forPlatform, (list) => { if (!list.some((v) => v.versionId === versionId.value)) versionId.value = list[0]?.versionId || 0; });
watch(() => route.params.id, (id) => { if (id) load(); }, { immediate: true });

async function download() {
  // Open the window first, in the click, so popup blockers allow it; then point it at the page.
  const tab = window.open('', '_blank');
  downloading.value = true;
  try {
    const { url } = await appDownload(app.value.appId, versionId.value);
    if (tab) { tab.opener = null; tab.location.href = url; } else window.location.href = url;
  } catch { tab?.close(); } finally { downloading.value = false; }
}
async function share() {
  const link = appLink(app.value.appId);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: app.value.name, url: link }); return; }
    await navigator.clipboard.writeText(link);
    ElMessage.success(t('appLinkCopied'));
  } catch (e) { if (e?.name !== 'AbortError') ElMessage.info(link); }
}
const back = () => goBack(router, '/apps');
const host = (u) => { try { return new URL(u).hostname; } catch { return u; } };
const date = (s) => (s ? new Date(s * 1000).toLocaleDateString(locale.value) : '');
function tint(name) {
  let h = 0; for (const ch of name || '') h = (h * 31 + ch.codePointAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))`;
}
</script>

<style scoped>
.app-detail { height:100%; overflow-y:auto; box-sizing:border-box; }
.detail-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; height:52px; padding:0 max(8px, calc((100% - 880px) / 2)); background:color-mix(in srgb, var(--el-bg-color) 92%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--el-border-color-lighter); font-weight:600; }
.detail-back { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:10px; background:none; color:var(--el-text-color-primary); cursor:pointer; }
.detail-back:hover { background:var(--el-fill-color-light); }
.detail-back:focus-visible { outline:2px solid var(--el-color-primary); }
.detail-body { padding:24px max(16px, calc((100% - 880px) / 2)) 40px; }
.detail-empty { display:flex; flex-direction:column; align-items:center; gap:12px; padding:64px 16px; color:var(--el-text-color-secondary); }
.detail-hero { display:flex; gap:20px; align-items:flex-start; }
.hero-icon { display:grid; place-items:center; flex-shrink:0; width:88px; height:88px; border-radius:22px; color:#fff; font-size:38px; font-weight:700; box-shadow:0 8px 24px rgb(15 23 42 / 15%); }
.hero-copy { min-width:0; }
.hero-copy h1 { margin:0; font-size:26px; line-height:1.2; }
.hero-pub { display:flex; flex-wrap:wrap; gap:4px 12px; margin:8px 0 0; font-size:13px; color:var(--el-text-color-secondary); }
.hero-pub a { color:var(--el-color-primary); }
.hero-summary { margin:10px 0 0; font-size:15px; }
.hero-status { display:inline-block; margin:10px 0 0; padding:4px 10px; border-radius:8px; background:var(--el-color-warning-light-9); color:var(--el-color-warning-dark-2); font-size:13px; }
.detail-get { margin-top:24px; padding:18px; border-radius:16px; background:var(--el-fill-color-lighter); border:1px solid var(--el-border-color-lighter); }
.get-row { display:flex; flex-wrap:wrap; gap:10px; }
.get-row + .get-row { margin-top:12px; }
.get-platform { width:180px; }
.get-version { width:160px; }
.get-download { min-width:160px; }
.get-note { margin:12px 0 0; font-size:12px; color:var(--el-text-color-secondary); }
.detail-section { margin-top:28px; }
.detail-section h2 { margin:0 0 10px; font-size:16px; }
.detail-text { white-space:pre-wrap; margin:0; line-height:1.6; }
.versions { list-style:none; margin:0; padding:0; border-radius:14px; border:1px solid var(--el-border-color-lighter); overflow:hidden; }
.versions li { padding:12px 16px; }
.versions li + li { border-top:1px solid var(--el-border-color-extra-light); }
.versions small { color:var(--el-text-color-secondary); }
.versions p { margin:6px 0 0; font-size:13px; white-space:pre-wrap; }
.v-status { color:var(--el-color-warning-dark-2); }
.v-note { color:var(--el-color-danger); }
@media (max-width: 767px) {
  .detail-hero { gap:14px; }
  .hero-icon { width:64px; height:64px; border-radius:16px; font-size:28px; }
  .hero-copy h1 { font-size:21px; }
  .get-platform, .get-version, .get-download { flex:1; min-width:0; width:auto; }
}
</style>
