<template>
  <div class="review">
    <div class="review-body">
      <header class="review-heading">
        <h1>{{ t('appReviewTitle') }}</h1>
        <el-button :loading="loading" :disabled="busy" @click="load">{{ t('userManagementRefresh') }}</el-button>
      </header>
      <div class="review-filters">
        <el-input v-model="search" clearable :placeholder="t('appSearch')" :aria-label="t('appSearch')" />
        <el-select v-model="filter" :aria-label="t('tabStatus')">
          <el-option value="pending" :label="t('appStatus_review')" />
          <el-option value="all" :label="t('userManagementAllStatuses')" />
          <el-option v-for="status in statuses" :key="status" :value="status" :label="t('appStatus_' + status)" />
        </el-select>
      </div>
      <ListState :state="error" :retrying="loading" @retry="load" />
      <p v-if="loaded && !error && !loading && !visibleApps.length" class="muted">{{ t(filter === 'pending' && !search.trim() ? 'appReviewEmpty' : 'adminNoMatchingApps') }}</p>
      <article v-for="a in visibleApps" :key="a.appId" class="review-item" :data-review="a.appId">
        <header>
          <div>
            <RouterLink :to="`/apps/${a.appId}`"><strong>{{ a.name }}</strong></RouterLink>
            <small> · {{ a.publisherName }} · <span :data-status="a.status">{{ t('appStatus_' + a.status) }}</span>
              <template v-if="a.removedBy === 'publisher'"> ({{ t('appByPublisher') }})</template>
              <template v-if="a.pendingVersions"> · {{ t('appPendingVersions', { n: a.pendingVersions }) }}</template></small>
          </div>
          <div class="review-actions">
            <el-button :disabled="!!error || busy || loading" v-if="a.status === 'review'" size="small" type="primary" data-approve @click="approve(a)">{{ t('appApprove') }}</el-button>
            <el-button :disabled="!!error || busy || loading" v-if="a.status === 'review'" size="small" @click="decide(a, 'reject', true)">{{ t('appReject') }}</el-button>
            <el-button :disabled="!!error || busy || loading" v-if="['published','hidden','review'].includes(a.status)" size="small" type="danger" plain @click="decide(a, 'remove', true)">{{ t('appRemove') }}</el-button>
            <el-button :disabled="!!error || busy || loading" v-if="a.status === 'removed'" size="small" @click="decide(a, 'restore')">{{ t('appRestore') }}</el-button>
            <el-button size="small" text @click="toggle(a)">{{ open[a.appId] ? t('appCollapse') : t('appVersions') }}</el-button>
          </div>
        </header>
        <p v-if="a.summary" class="summary">{{ a.summary }}</p>
        <p v-if="a.reviewNote" class="note">{{ a.reviewNote }}</p>
        <ul v-if="open[a.appId]" class="versions">
          <li v-for="v in versions[a.appId] || []" :key="v.versionId">
            <span><strong>v{{ v.version }}</strong> · {{ t('appPlatform_' + v.platform) }} · {{ v.filename }} · {{ formatBytes(v.size) }} · <span :data-status="v.status">{{ t('appStatus_' + v.status) }}</span></span>
            <span class="review-actions">
              <el-button :disabled="!!error || busy || loading" v-if="v.status === 'review'" size="small" type="primary" plain @click="decide(a, 'approve', false, v)">{{ t('appApprove') }}</el-button>
              <el-button :disabled="!!error || busy || loading" v-if="v.status === 'review'" size="small" @click="decide(a, 'reject', true, v)">{{ t('appReject') }}</el-button>
              <el-button :disabled="!!error || busy || loading" v-if="['published','review'].includes(v.status)" size="small" type="danger" text @click="decide(a, 'block', true, v)">{{ t('appBlock') }}</el-button>
            </span>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import ListState from '@/components/list-state.vue';
import { reviewQueue, reviewApp, reviewVersion, appDetail } from '@/request/apps';
import { formatBytes } from '@/utils/file-utils.js';

const { t } = useI18n();
const queue = ref([]), loaded = ref(false), loading = ref(false), error = ref('');
const search = ref(''), filter = ref('pending'), busy = ref(false);
const statuses = ['published', 'hidden', 'removed', 'rejected'];
const visibleApps = computed(() => {
  const term = search.value.trim().toLocaleLowerCase();
  return queue.value.filter(app => {
    const matchesFilter = filter.value === 'all' || (filter.value === 'pending'
      ? app.status === 'review' || Number(app.pendingVersions) > 0
      : app.status === filter.value);
    return matchesFilter && (!term || [app.name, app.publisherName].some(text => text?.toLocaleLowerCase().includes(term)));
  });
});
const open = reactive({}), versions = reactive({}), seen = reactive({});

async function load() {
  if (loading.value) return;
  loading.value = true;
  try { queue.value = await reviewQueue(); loaded.value = true; error.value = ''; } catch { error.value = loaded.value ? 'stale' : 'failed'; } finally { loading.value = false; }
}
async function loadVersions(a) {
  try { const data = await appDetail(a.appId); versions[a.appId] = data.versions; seen[a.appId] = data.app.updateTime; return true; } catch { return false; }
}
// Approving publishes the listing and only the pending versions shown here, as of this snapshot.
// If the publisher changed anything since, the server refuses and the list reloads.
async function approve(a) {
  if (busy.value) return;
  busy.value = true;
  try {
    open[a.appId] = true;
    if (!(await loadVersions(a))) return;
    const pending = versions[a.appId].filter(v => v.status === 'review');
    const list = pending.map(v => `v${v.version} · ${t('appPlatform_' + v.platform)}`).join('\n') || t('appNoVersions');
    try { await ElMessageBox.confirm(list, t('appApprove'), { customStyle: { whiteSpace: 'pre-line' } }); } catch { return; }
    try { await reviewApp(a.appId, 'approve', '', { updateTime: seen[a.appId], versionIds: pending.map(v => v.versionId) }); } catch {}
    await Promise.all([load(), loadVersions(a)]);
  } finally {
    busy.value = false;
  }
}

function toggle(a) {
  open[a.appId] = !open[a.appId];
  if (open[a.appId]) loadVersions(a);
}

async function decide(a, action, needsReason = false, version) {
  if (busy.value) return;
  busy.value = true;
  try {
    let note = '';
    if (needsReason) {
      try {
        const { value } = await ElMessageBox.prompt(t('appReason'), {
          inputValidator: value => !!value?.trim() || t('appReason')
        });
        note = value.trim();
      } catch { return; }
    }
    try {
      if (version) await reviewVersion(a.appId, version.versionId, action, note);
      else await reviewApp(a.appId, action, note);
    } catch {}
    await Promise.all([load(), open[a.appId] && loadVersions(a)]);
  } finally {
    busy.value = false;
  }
}
load();
</script>

<style scoped>
.review { height: 100%; overflow-y: auto; background: var(--el-bg-color-page); }
.review-body { display: flex; flex-direction: column; gap: 14px; max-width: 1130px; margin-inline: auto; padding: clamp(14px, 3vw, 34px); }
.review-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.review-heading h1 { margin: 0; color: var(--el-text-color-primary); font-size: clamp(22px, 3vw, 29px); }
.review-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.review-filters .el-input { max-width: 340px; flex: 1 1 185px; }
.review-filters .el-select { width: min(190px, 100%); }
.review-item { padding:14px 16px; border-radius:14px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); }
.review-item header { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; overflow-wrap:anywhere; }
.review-item small { color:var(--el-text-color-secondary); }
.review-actions { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.review-actions .el-button { margin: 0; }
.summary { margin:8px 0 0; font-size:13px; }
.note { margin:6px 0 0; font-size:12px; color:var(--el-color-danger); }
.versions { list-style:none; margin:10px 0 0; padding:0; border-top:1px solid var(--el-border-color-extra-light); }
.versions li { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:8px 0; font-size:13px; }
.muted { color:var(--el-text-color-secondary); }
</style>
