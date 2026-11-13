<template>
  <div class="setting-dialogs">
    <el-dialog v-model="r2DomainShow" :title="$t('addOsDomain')" width="340"
               @closed="r2DomainInput = setting.r2Domain">
      <form @submit.prevent>
        <el-input type="text" :placeholder="$t('domainDesc')" v-model="r2DomainInput" @keyup.enter="saveR2domain"/>
        <el-button type="primary" :loading="settingLoading" @click="saveR2domain">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog v-model="addS3Show" :title="t('s3Configuration')" width="340" @closed="resetAddS3Form">
      <form @submit.prevent>
        <el-input class="dialog-input" type="text" placeholder="Bucket" v-model="s3.bucket" @keyup.enter="saveS3"/>
        <el-input class="dialog-input" type="text" placeholder="Endpoint" v-model="s3.endpoint" @keyup.enter="saveS3"/>
        <el-input class="dialog-input" type="text" placeholder="Region" v-model="s3.region" @keyup.enter="saveS3"/>
        <el-input class="dialog-input" type="text" :placeholder="setting.s3AccessKey || 'Access Key'"
                  v-model="s3.s3AccessKey" @keyup.enter="saveS3"/>
        <el-input show-password autocomplete="new-password" style="margin-bottom: 10px" type="password" :placeholder="setting.s3SecretKey || 'Secret Key'" v-model="s3.s3SecretKey" @keyup.enter="saveS3"/>
        <div class="force-path-style">
          <div class="force-path-style-left">
            <span>ForcePathStyle</span>
            <el-tooltip effect="dark" :content="$t('forcePathStyleDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
          <el-switch :before-change="beforeChange" :active-value="0" :inactive-value="1"
                     v-model="s3.forcePathStyle"/>
        </div>
        <div class="s3-button">
          <el-button :loading="clearS3Loading" @click="clearS3">{{ t('clear') }}</el-button>
          <el-button type="primary" :loading="settingLoading && !clearS3Loading" @click="saveS3">{{ t('save') }}</el-button>
        </div>
      </form>
    </el-dialog>
    <el-dialog v-model="costactionShow" :title="t('largeAttTitle')" class="forward-dialog" @closed="costactionForm.token = ''; costactionResult = ''">
      <form class="costaction-form" @submit.prevent="saveCostaction">
        <p class="costaction-note">{{ t('largeAttNote') }}</p>
        <el-input v-model="costactionForm.token" show-password autocomplete="new-password" type="password"
                  :placeholder="t(setting.costactionTokenSet ? 'largeAttTokenKeep' : 'largeAttTokenPlaceholder')" :aria-label="t('largeAttToken')"/>
        <div class="costaction-actions">
          <el-button :loading="costactionTesting" @click="testCostaction">{{ t('largeAttTest') }}</el-button>
          <el-button v-if="setting.costactionTokenSet" text type="danger" @click="clearCostactionToken">{{ t('largeAttTokenClear') }}</el-button>
          <span v-if="costactionResult" role="status" :class="costactionResult">{{ t(costactionResult === 'ok' ? 'largeAttTestOk' : 'largeAttTestFailed') }}</span>
        </div>
        <label class="costaction-field"><span>{{ t('largeAttMinSize') }}</span><el-input-number v-model="costactionForm.minMb" :min="1" :max="10240"><template #suffix>MB</template></el-input-number></label>
        <label class="costaction-field"><span>{{ t('largeAttMaxSize') }}</span><el-input-number v-model="costactionForm.maxMb" :min="1" :max="10240"><template #suffix>MB</template></el-input-number></label>
        <label class="costaction-field"><span>{{ t('largeAttRoles') }}</span>
          <el-select v-model="costactionForm.roles" multiple :placeholder="t('largeAttRolesAdmin')">
            <el-option v-for="role in costactionRoles" :key="role.roleId" :label="role.name" :value="role.roleId"/>
          </el-select>
        </label>
        <el-button type="primary" native-type="submit" :loading="settingLoading">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { costactionTest } from '@/request/large-att.js';
import { roleSelectUse } from '@/request/role.js';
import { useSysSetting } from '../use-sys-setting.js';

const { t } = useI18n();
const { setting, settingLoading, clearS3Loading, editSetting, beforeChange, onSettingsLoaded } = useSysSetting();

const r2DomainShow = ref(false);
const r2DomainInput = ref('');
const addS3Show = ref(false);
const s3 = reactive({
  bucket: '',
  endpoint: '',
  region: '',
  s3AccessKey: '',
  s3SecretKey: '',
  forcePathStyle: 1
});

onSettingsLoaded(() => {
  r2DomainInput.value = setting.value.r2Domain;
  resetAddS3Form();
});

function resetAddS3Form() {
  s3.bucket = setting.value.bucket;
  s3.endpoint = setting.value.endpoint;
  s3.region = setting.value.region;
  s3.s3AccessKey = '';
  s3.s3SecretKey = '';
  s3.forcePathStyle = setting.value.forcePathStyle;
}

async function saveR2domain() {
  if (await editSetting({ r2Domain: r2DomainInput.value })) r2DomainShow.value = false;
}

async function clearS3() {
  const form = {
    bucket: '',
    endpoint: '',
    region: '',
    s3AccessKey: '',
    s3SecretKey: '',
    forcePathStyle: 1
  };
  clearS3Loading.value = true;
  if (await editSetting(form)) addS3Show.value = false;
}

async function saveS3() {
  const form = {
    bucket: s3.bucket,
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: s3.forcePathStyle
  };
  if (s3.s3AccessKey) form.s3AccessKey = s3.s3AccessKey;
  if (s3.s3SecretKey) form.s3SecretKey = s3.s3SecretKey;
  if (await editSetting(form)) addS3Show.value = false;
}

// Large attachments (CostAction/Turbobit). The token is write-only: the page only learns whether one is saved.
const MB = 1024 * 1024;
const costactionShow = ref(false), costactionTesting = ref(false), costactionResult = ref(''), costactionRoles = ref([]);
const costactionForm = reactive({ token: '', minMb: 10, maxMb: 100, roles: [] });

function openCostaction() {
  costactionForm.token = '';
  costactionForm.minMb = Math.round((setting.value.costactionMinSize || 10 * MB) / MB);
  costactionForm.maxMb = Math.round((setting.value.costactionMaxSize || 100 * MB) / MB);
  costactionForm.roles = String(setting.value.costactionRoles || '').split(',').filter(Boolean).map(Number);
  costactionResult.value = '';
  roleSelectUse().then(list => { costactionRoles.value = list; }).catch(() => {});
  costactionShow.value = true;
}

async function testCostaction() {
  costactionTesting.value = true;
  try {
    costactionResult.value = (await costactionTest(costactionForm.token.trim())).ok ? 'ok' : 'failed';
  } catch {
    costactionResult.value = 'failed';
  } finally {
    costactionTesting.value = false;
  }
}

async function saveCostaction() {
  if (costactionForm.minMb > costactionForm.maxMb) {
    ElMessage({ message: t('largeAttSizeOrder'), type: 'warning', plain: true });
    return;
  }
  const saved = await editSetting({
    costactionToken: costactionForm.token.trim(),
    costactionMinSize: costactionForm.minMb * MB,
    costactionMaxSize: costactionForm.maxMb * MB,
    costactionRoles: costactionForm.roles.join(',')
  });
  if (saved) costactionShow.value = false;
}

function clearCostactionToken() {
  ElMessageBox.confirm(t('largeAttTokenClearConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => editSetting({ costactionTokenClear: true, costactionStatus: 1 })).catch(() => {});
}

defineExpose({
  openCostaction,
  openR2Domain: () => { r2DomainShow.value = true; },
  openS3: () => { addS3Show.value = true; }
});
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
<style scoped lang="scss">
.s3-button {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 15px;

  .el-button {
    margin-left: 0;
  }
}

.costaction-form { display: grid; gap: 12px; }
.costaction-note { margin: 0; font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); }
.costaction-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.costaction-actions .ok { color: var(--el-color-success); }
.costaction-actions .failed { color: var(--el-color-danger); }
.costaction-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }
.costaction-field .el-select { width: 220px; }
.costaction-form .el-button { width: auto; margin-top: 0; }
.costaction-form > .el-button--primary { width: 100%; }

.dialog-input {
  margin-bottom: 15px;
}

.force-path-style {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  .force-path-style-left {
    padding-left: 2px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
  }
}
</style>
