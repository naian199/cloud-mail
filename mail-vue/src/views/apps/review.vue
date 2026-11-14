<template>
  <div class="review">
    <div class="detail-bar">
      <button type="button" class="detail-back" :aria-label="t('navBack')" @click="back"><Icon icon="cloud-mail:back" width="22" /></button>
      <span>{{ t('appReviewTitle') }}</span>
    </div>
    <div class="review-body">
      <ListState :state="error" :retrying="loading" @retry="load" />
      <p v-if="loaded && !error && !queue.length" class="muted">{{ t('appReviewEmpty') }}</p>
      <article v-for="a in queue" :key="a.appId" class="review-item" :data-review="a.appId">
        <header>
          <div>
            <RouterLink :to="`/apps/${a.appId}`"><strong>{{ a.name }}</strong></RouterLink>
            <small> · {{ a.publisherName }} · <span :data-status="a.status">{{ t('appStatus_' + a.status) }}</span>
              <template v-if="a.removedBy === 'publisher'"> ({{ t('appByPublisher') }})</template>
              <template v-if="a.pendingVersions"> · {{ t('appPendingVersions', { n: a.pendingVersions }) }}</template></small>
          </div>
          <div class="review-actions">
            <el-button v-if="a.status === 'review'" size="small" type="primary" @click="decide(a, 'approve')">{{ t('appApprove') }}</el-button>
            <el-button v-if="a.status === 'review'" size="small" @click="decide(a, 'reject', true)">{{ t('appReject') }}</el-button>
            <el-button v-if="['published','hidden','review'].includes(a.status)" size="small" type="danger" plain @click="decide(a, 'remove', true)">{{ t('appRemove') }}</el-button>
            <el-button v-if="a.status === 'removed'" size="small" @click="decide(a, 'restore')">{{ t('appRestore') }}</el-button>
            <el-button size="small" text @click="toggle(a)">{{ open[a.appId] ? t('appCollapse') : t('appVersions') }}</el-button>
          </div>
        </header>
        <p v-if="a.summary" class="summary">{{ a.summary }}</p>
        <p v-if="a.reviewNote" class="note">{{ a.reviewNote }}</p>
        <ul v-if="open[a.appId]" class="versions">
          <li v-for="v in versions[a.appId] || []" :key="v.versionId">
            <span><strong>v{{ v.version }}</strong> · {{ t('appPlatform_' + v.platform) }} · {{ v.filename }} · {{ formatBytes(v.size) }} · <span :data-status="v.status">{{ t('appStatus_' + v.status) }}</span></span>
            <span class="review-actions">
              <el-button v-if="v.status === 'review'" size="small" type="primary" plain @click="decideVersion(a, v, 'approve')">{{ t('appApprove') }}</el-button>
              <el-button v-if="v.status === 'review'" size="small" @click="decideVersion(a, v, 'reject', true)">{{ t('appReject') }}</el-button>
              <el-button v-if="['published','review'].includes(v.status)" size="small" type="danger" text @click="decideVersion(a, v, 'block', true)">{{ t('appBlock') }}</el-button>
            </span>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import ListState from '@/components/list-state.vue';
import { reviewQueue, reviewApp, reviewVersion, appDetail } from '@/request/apps';
import { goBack } from '@/utils/go-back.js';
import { formatBytes } from '@/utils/file-utils.js';

const { t } = useI18n();
const router = useRouter();
const queue = ref([]), loaded = ref(false), loading = ref(false), error = ref('');
const open = reactive({}), versions = reactive({});

async function load() {
  loading.value = true;
  try { queue.value = await reviewQueue(); loaded.value = true; error.value = ''; } catch { error.value = loaded.value ? 'stale' : 'failed'; } finally { loading.value = false; }
}
async function loadVersions(a) { try { versions[a.appId] = (await appDetail(a.appId)).versions; } catch {} }
function toggle(a) { open[a.appId] = !open[a.appId]; if (open[a.appId]) loadVersions(a); }
// Rejecting, removing and blocking need a reason the publisher will see.
async function reason(needed) {
  if (!needed) return '';
  try { const { value } = await ElMessageBox.prompt(t('appReason'), { inputValidator: (v) => !!v?.trim() || t('appReason') }); return value.trim(); } catch { return null; }
}
async function decide(a, action, needsReason = false) {
  const note = await reason(needsReason); if (note === null) return;
  try { await reviewApp(a.appId, action, note); await load(); if (open[a.appId]) loadVersions(a); } catch {}
}
async function decideVersion(a, v, action, needsReason = false) {
  const note = await reason(needsReason); if (note === null) return;
  try { await reviewVersion(a.appId, v.versionId, action, note); await Promise.all([load(), loadVersions(a)]); } catch {}
}
const back = () => goBack(router, '/me');
load();
</script>

<style scoped>
.review { height:100%; overflow-y:auto; box-sizing:border-box; }
.detail-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; height:52px; padding:0 8px; background:var(--el-bg-color); border-bottom:1px solid var(--el-border-color-lighter); font-weight:600; }
.detail-back { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:10px; background:none; color:var(--el-text-color-primary); cursor:pointer; }
.review-body { display:flex; flex-direction:column; gap:12px; padding:20px max(16px, calc((100% - 960px) / 2)) 40px; }
.review-item { padding:14px 16px; border-radius:14px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); }
.review-item header { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.review-item small { color:var(--el-text-color-secondary); }
.review-actions { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.summary { margin:8px 0 0; font-size:13px; }
.note { margin:6px 0 0; font-size:12px; color:var(--el-color-danger); }
.versions { list-style:none; margin:10px 0 0; padding:0; border-top:1px solid var(--el-border-color-extra-light); }
.versions li { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:8px 0; font-size:13px; }
.muted { color:var(--el-text-color-secondary); }
</style>
