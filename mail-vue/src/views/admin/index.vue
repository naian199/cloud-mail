<template>
  <div class="admin-home">
    <div class="admin-content">
      <header class="admin-intro">
        <span class="intro-icon"><Icon icon="cloud-mail:shield" width="25" aria-hidden="true" /></span>
        <h1>{{ t('adminWorkspace') }}</h1>
      </header>

      <section v-if="canAnalyze" class="overview" :aria-label="t('analytics')" :aria-busy="loading">
        <div class="overview-heading">
          <h2>{{ t('analytics') }}</h2>
          <button class="refresh-overview" type="button" :disabled="loading" @click="load">
            <Icon icon="ion:reload" width="15" aria-hidden="true" />{{ t('userManagementRefresh') }}
          </button>
        </div>
        <ListState :state="error" :retrying="loading" @retry="load" />
        <dl v-if="counts || loading" class="metrics">
          <div v-for="metric in metrics" :key="metric.key" class="metric">
            <dt>{{ t(metric.label) }}</dt>
            <dd v-if="counts">{{ Number.isFinite(counts[metric.key]) ? n(counts[metric.key]) : '—' }}</dd>
            <dd v-else aria-hidden="true"><span class="metric-placeholder"></span></dd>
          </div>
        </dl>
      </section>

      <div class="admin-groups">
        <section v-for="group in groups" :key="group.id" class="admin-group" :aria-labelledby="'admin-group-' + group.id">
          <h2 :id="'admin-group-' + group.id">{{ t(group.label) }}</h2>
          <RouterLink v-for="page in group.pages" :key="page.name" :to="{ name: page.name }" class="admin-module">
            <span class="module-icon"><Icon :icon="'cloud-mail:' + page.icon" width="20" aria-hidden="true" /></span>
            <span>{{ t(page.label) }}</span>
            <Icon icon="cloud-mail:chevron" class="module-chevron" width="16" aria-hidden="true" />
          </RouterLink>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { hasPerm } from '@/perm/perm.js';
import { adminSections } from '@/perm/admin-pages.mjs';
import { analysisEcharts } from '@/request/analysis.js';
import ListState from '@/components/list-state.vue';

const { t, n } = useI18n();
const canAnalyze = computed(() => hasPerm('analysis:query'));
const groups = computed(() => adminSections.map(group => ({
  ...group, pages: group.pages.filter(page => hasPerm(page.permission))
})).filter(group => group.pages.length));
const metrics = [
  { key: 'userTotal', label: 'totalUsers' },
  { key: 'accountTotal', label: 'totalMailboxes' },
  { key: 'receiveTotal', label: 'totalReceived' },
  { key: 'sendTotal', label: 'totalSent' }
];
const counts = ref(null);
const loading = ref(false);
const error = ref('');
let revision = 0;

async function load() {
  const request = ++revision;
  loading.value = true;
  error.value = '';
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await analysisEcharts(zone);
    if (request === revision) counts.value = result.numberCount || null;
  } catch {
    if (request === revision) error.value = counts.value ? 'stale' : 'failed';
  } finally {
    if (request === revision) loading.value = false;
  }
}

watch(canAnalyze, allowed => {
  if (allowed) load();
  else {
    revision++;
    counts.value = null;
    loading.value = false;
    error.value = '';
  }
}, { immediate: true });
</script>

<style scoped>
.admin-home { overflow: auto; min-height: 0; background: var(--el-bg-color-page); }
.admin-content { max-width: 1240px; margin-inline: auto; padding: clamp(16px, 3vw, 42px); }
.admin-intro { display: flex; align-items: center; gap: 13px; margin-block-end: 26px; }
.admin-intro h1 { margin: 0; color: var(--el-text-color-primary); font-size: clamp(24px, 4vw, 34px); line-height: 1.2; letter-spacing: -.025em; }
.intro-icon, .module-icon { display: grid; place-items: center; flex: none; border-radius: 10px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.intro-icon { width: 49px; height: 49px; border: 1px solid var(--el-color-primary-light-8); }
.overview { margin-block-end: 28px; }
.overview-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-block-end: 9px; }
.overview h2, .admin-group h2 { margin: 0; font-size: 15px; font-weight: 650; color: var(--el-text-color-primary); }
.refresh-overview { display: flex; min-height: 40px; align-items: center; gap: 7px; padding-inline: 10px; font: inherit; font-size: 13px; color: var(--el-text-color-secondary); border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
.refresh-overview:hover:not(:disabled) { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.refresh-overview:disabled { opacity: .6; cursor: default; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
.metric, .admin-group { background: var(--el-bg-color-overlay); border: 1px solid var(--el-border-color-light); border-radius: 14px; min-width: 0; }
.metric { min-height: 99px; padding: 15px; }
.metric dt { color: var(--el-text-color-secondary); font-size: 13px; overflow-wrap: anywhere; }
.metric dd { margin: 6px 0 0; color: var(--el-text-color-primary); font-size: clamp(19px, 3vw, 28px); font-weight: 660; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.metric-placeholder { display: block; width: 42px; height: 18px; margin-block-start: 12px; border-radius: 4px; background: var(--el-fill-color); }
.admin-groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 12px; }
.admin-group { padding: 14px 12px 10px; }
.admin-group h2 { padding: 3px 8px 12px; }
.admin-module { display: flex; align-items: center; min-height: 52px; gap: 9px; padding: 6px 7px; border-radius: 8px; color: var(--el-text-color-primary); font-size: 14px; font-weight: 550; text-decoration: none; overflow-wrap: anywhere; }
.admin-module + .admin-module { margin-block-start: 2px; }
.module-icon { width: 32px; height: 32px; }
.module-chevron { margin-inline-start: auto; flex: none; color: var(--el-text-color-secondary); }
:global(html[dir="rtl"]) .module-chevron { transform: scaleX(-1); }
.admin-module:hover { background: var(--el-fill-color-light); color: var(--el-color-primary); }
.admin-module:focus-visible, .refresh-overview:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
@media (max-width: 900px) { .admin-groups { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 610px) {
  .admin-groups { grid-template-columns: minmax(0, 1fr); }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric { min-height: 80px; padding: 12px; }
}
</style>
