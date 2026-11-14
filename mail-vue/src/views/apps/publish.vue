<template>
  <div class="publish">
    <div class="detail-bar">
      <button type="button" class="detail-back" :aria-label="t('navBack')" @click="back"><Icon icon="cloud-mail:back" width="22" /></button>
      <span>{{ t('appPublishTitle') }}</span>
    </div>
    <div class="publish-body">
      <aside class="publish-list">
        <el-button type="primary" class="publish-new" @click="openNew"><Icon icon="cloud-mail:upload" width="16" />&nbsp;{{ t('appNew') }}</el-button>
        <ListState :state="listError" @retry="loadMine" />
        <button v-for="a in mine" :key="a.appId" type="button" class="mine" :class="{ active: a.appId === currentId }" :data-mine="a.appId" @click="openApp(a.appId)">
          <strong>{{ a.name }}</strong>
          <small :data-status="a.status">{{ t('appStatus_' + a.status) }}<template v-if="a.latestVersion"> · v{{ a.latestVersion }}</template></small>
        </button>
        <p v-if="mineLoaded && !mine.length && !listError" class="muted">{{ t('appMineEmpty') }}</p>
      </aside>

      <section v-if="editing" class="publish-editor">
        <h2>{{ currentId ? t('appEdit') : t('appNew') }}</h2>
        <p v-if="current && current.status !== 'draft'" class="status-line" :data-status="current.status">{{ t('appStatus_' + current.status) }}<template v-if="current.reviewNote"> · {{ current.reviewNote }}</template></p>
        <el-form label-position="top" @submit.prevent="save">
          <el-form-item :label="t('appName')"><el-input v-model="form.name" maxlength="60" name="app-name" /></el-form-item>
          <el-form-item :label="t('appSummary')"><el-input v-model="form.summary" maxlength="140" name="app-summary" /></el-form-item>
          <el-form-item :label="t('appCategory')"><el-select v-model="form.category"><el-option v-for="c in categories" :key="c" :label="t('appCategory_' + c)" :value="c" /></el-select></el-form-item>
          <el-form-item :label="t('appSource')"><el-input v-model="form.sourceUrl" maxlength="500" placeholder="https://" name="app-source" /></el-form-item>
          <el-form-item :label="t('appAbout')"><el-input v-model="form.description" type="textarea" :rows="4" maxlength="4000" /></el-form-item>
          <el-button type="primary" native-type="submit" :loading="saving" :disabled="!form.name.trim() || current?.status === 'removed'">{{ t('save') }}</el-button>
          <span v-if="currentId && current?.status !== 'draft' && current?.status !== 'removed'" class="muted">&nbsp;{{ t('appEditReviewNote') }}</span>
        </el-form>

        <template v-if="currentId">
          <h2>{{ t('appVersions') }}</h2>
          <ul class="versions">
            <li v-for="v in versions" :key="v.versionId">
              <span><strong>v{{ v.version }}</strong> · {{ t('appPlatform_' + v.platform) }} · {{ v.filename }}</span>
              <span class="v-side"><span :data-status="v.status">{{ t('appStatus_' + v.status) }}</span>
                <el-button v-if="['review','published'].includes(v.status)" size="small" text type="danger" @click="withdraw(v)">{{ t('appWithdraw') }}</el-button></span>
              <small v-if="v.reviewNote" class="v-note">{{ v.reviewNote }}</small>
            </li>
            <li v-if="!versions.length" class="muted">{{ t('appNoVersions') }}</li>
          </ul>

          <form v-if="current?.status !== 'removed'" class="version-form" @submit.prevent="addNewVersion">
            <h3>{{ t('appAddVersion') }}</h3>
            <div class="row">
              <el-input v-model="vform.version" maxlength="40" :placeholder="t('appVersion')" name="version" />
              <el-select v-model="vform.platform" :placeholder="t('appPlatform')"><el-option v-for="p in platforms" :key="p" :label="t('appPlatform_' + p)" :value="p" /></el-select>
            </div>
            <el-select v-model="vform.fileId" class="installer" :placeholder="t('appInstaller')" name="installer">
              <el-option v-for="f in installers" :key="f.fileId" :label="`${f.filename} · ${formatBytes(f.size)}`" :value="f.fileId" />
            </el-select>
            <div class="upload-line">
              <label v-if="large.config.value.enabled" class="el-button el-button--small"><input type="file" hidden @change="upload" />{{ t('appUploadInstaller') }}</label>
              <span class="muted">{{ large.config.value.enabled ? t('appInstallerHint') : t('appUploadDisabled') }}</span>
            </div>
            <div v-for="item in large.list()" :key="item.clientId" class="upload-item">{{ item.name }} · {{ item.status === 'ready' ? t('appVerified') : item.status === 'failed' ? t('largeAttFailed') : t('largeAttConfirming') }}</div>
            <el-input v-model="vform.notes" type="textarea" :rows="2" maxlength="2000" :placeholder="t('appReleaseNotes')" />
            <el-button native-type="submit" :loading="adding" :disabled="!vform.version.trim() || !vform.platform || !vform.fileId">{{ t('appAddVersion') }}</el-button>
          </form>

          <div class="actions">
            <el-button v-if="['draft','rejected','hidden'].includes(current?.status)" type="primary" :loading="acting" @click="act(submitApp)">{{ t('appSubmit') }}</el-button>
            <el-button v-if="current?.status === 'published'" :loading="acting" @click="act(hideApp)">{{ t('appHide') }}</el-button>
            <RouterLink :to="`/apps/${currentId}`">{{ t('appViewListing') }}</RouterLink>
          </div>
        </template>
      </section>
      <section v-else class="publish-editor muted">{{ t('appPublishHint') }}</section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import ListState from '@/components/list-state.vue';
import { myApps, myInstallers, createApp, updateApp, addVersion, submitApp, hideApp, withdrawVersion, appDetail } from '@/request/apps';
import { useLargeAttachments } from '@/composables/use-large-attachments';
import { useUserStore } from '@/store/user';
import { goBack } from '@/utils/go-back.js';
import { formatBytes } from '@/utils/file-utils.js';

const { t } = useI18n();
const route = useRoute(), router = useRouter(), user = useUserStore();
const platforms = ['android', 'ios', 'windows', 'macos', 'linux', 'web'];
const categories = ['tools', 'social', 'productivity', 'media', 'games', 'education', 'other'];
const mine = ref([]), mineLoaded = ref(false), listError = ref('');
const currentId = computed(() => Number(route.query.app) || 0);
const editing = computed(() => route.query.app !== undefined);
const current = computed(() => mine.value.find((a) => a.appId === currentId.value));
const form = reactive({ name: '', summary: '', category: 'tools', sourceUrl: '', description: '' });
const vform = reactive({ version: '', platform: '', fileId: null, notes: '' });
const versions = ref([]), installers = ref([]);
const saving = ref(false), adding = ref(false), acting = ref(false);
// Installers go through the same CostAction upload and server-side verification as chat files.
const large = useLargeAttachments({ t, accountId: () => user.user.account.accountId, draftKey: () => 'app-publish' });

async function loadMine() {
  try { mine.value = await myApps(); listError.value = ''; mineLoaded.value = true; } catch { listError.value = mineLoaded.value ? 'stale' : 'failed'; }
}
async function loadCurrent() {
  if (!currentId.value) { Object.assign(form, { name: '', summary: '', category: 'tools', sourceUrl: '', description: '' }); versions.value = []; return; }
  try {
    const data = await appDetail(currentId.value);
    Object.assign(form, { name: data.app.name, summary: data.app.summary, category: data.app.category, sourceUrl: data.app.sourceUrl, description: data.app.description });
    versions.value = data.versions;
  } catch {}
  try { installers.value = await myInstallers(); } catch {}
}
watch(currentId, loadCurrent, { immediate: true });
// Explicitly opening an app or the new-app form is a step of its own in history.
const openApp = (id) => router.push({ query: { app: String(id) } });
const openNew = () => router.push({ query: { app: '0' } });

async function save() {
  saving.value = true;
  try {
    if (currentId.value) { await updateApp(currentId.value, form); ElMessage.success(t('saveSuccessMsg')); }
    else { const { appId } = await createApp(form); await router.replace({ query: { app: String(appId) } }); }
    await loadMine();
  } catch {} finally { saving.value = false; }
}
async function upload(event) {
  large.choose(event);
  const done = setInterval(async () => {
    if (large.busy()) return;
    clearInterval(done);
    try {
      installers.value = await myInstallers();
      const last = large.list().filter((i) => i.status === 'ready').at(-1);
      if (last?.fileId) vform.fileId = last.fileId;
    } catch {}
  }, 800);
}
async function addNewVersion() {
  adding.value = true;
  try {
    await addVersion(currentId.value, { ...vform });
    Object.assign(vform, { version: '', platform: '', fileId: null, notes: '' });
    await Promise.all([loadCurrent(), loadMine()]);
  } catch {} finally { adding.value = false; }
}
async function act(fn) {
  acting.value = true;
  try { await fn(currentId.value); await Promise.all([loadCurrent(), loadMine()]); } catch {} finally { acting.value = false; }
}
async function withdraw(v) {
  try { await ElMessageBox.confirm(t('appWithdrawConfirm'), { type: 'warning' }); } catch { return; }
  try { await withdrawVersion(currentId.value, v.versionId); await loadCurrent(); } catch {}
}
const back = () => goBack(router, '/me');
loadMine();
</script>

<style scoped>
.publish { height:100%; overflow-y:auto; box-sizing:border-box; }
.detail-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; height:52px; padding:0 8px; background:var(--el-bg-color); border-bottom:1px solid var(--el-border-color-lighter); font-weight:600; }
.detail-back { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:10px; background:none; color:var(--el-text-color-primary); cursor:pointer; }
.detail-back:hover { background:var(--el-fill-color-light); }
.publish-body { display:grid; grid-template-columns:260px minmax(0, 1fr); gap:20px; padding:20px max(16px, calc((100% - 1080px) / 2)) 40px; }
.publish-list { display:flex; flex-direction:column; gap:8px; }
.publish-new { width:100%; }
.mine { display:flex; flex-direction:column; align-items:flex-start; gap:2px; padding:10px 12px; border-radius:12px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); color:inherit; text-align:start; cursor:pointer; font:inherit; }
.mine.active { border-color:var(--el-color-primary); background:var(--el-color-primary-light-9); }
.mine small { color:var(--el-text-color-secondary); }
.publish-editor { min-width:0; padding:18px; border-radius:16px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); }
.publish-editor h2 { margin:0 0 12px; font-size:17px; }
.publish-editor h2:not(:first-child) { margin-top:28px; }
.status-line { margin:-4px 0 12px; font-size:13px; color:var(--el-color-warning-dark-2); }
.versions { list-style:none; margin:0; padding:0; border-radius:12px; border:1px solid var(--el-border-color-lighter); }
.versions li { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px; padding:10px 14px; font-size:13px; }
.versions li + li { border-top:1px solid var(--el-border-color-extra-light); }
.v-side { display:flex; align-items:center; gap:8px; color:var(--el-text-color-secondary); }
.v-note { flex-basis:100%; color:var(--el-color-danger); }
.version-form { display:flex; flex-direction:column; gap:10px; margin-top:16px; padding:14px; border-radius:12px; background:var(--el-fill-color-lighter); }
.version-form h3 { margin:0; font-size:14px; }
.version-form .row { display:flex; gap:10px; }
.upload-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.upload-item { font-size:12px; color:var(--el-text-color-secondary); }
.actions { display:flex; align-items:center; gap:12px; margin-top:20px; }
.muted { color:var(--el-text-color-secondary); font-size:13px; }
@media (max-width: 767px) { .publish-body { grid-template-columns:1fr; } .version-form .row { flex-direction:column; } }
</style>
