<template>
  <div class="setting-dialogs">
    <el-dialog v-model="resendTokenFormShow" :title="$t('resendToken')" width="340" @closed="resendTokenForm.token = ''">
      <form @submit.prevent>
        <el-select style="margin-bottom: 15px" v-model="resendTokenForm.domain" placeholder="Select">
          <el-option
              v-for="item in settingStore.domainList"
              :key="item"
              :label="item"
              :value="item"
          />
        </el-select>
        <el-input show-password autocomplete="new-password" type="password" :placeholder="$t('addResendTokenDesc')" v-model="resendTokenForm.token" @keyup.enter="saveResendToken"/>
        <el-button type="primary" :loading="settingLoading" @click="saveResendToken">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog class="resend-table" v-model="showResendList" :title="$t('resendTokenList')">
      <el-table :data="resendList">
        <el-table-column :min-width="emailColumnWidth" property="key" :label="$t('domain')"
                         :show-overflow-tooltip="true"/>
        <el-table-column :width="tokenColumnWidth" property="value" label="Token" fixed="right"
                         :show-overflow-tooltip="true"/>
      </el-table>
    </el-dialog>
    <el-dialog v-model="blackFormShow" class="forward-dialog" @closed="resetBlackList">
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('blackList') }}</span>
          <el-tooltip effect="dark" :content="$t('blackListDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <el-form>
        <el-form-item :label="t('blackFromDesc')" label-position="top">
          <el-input-tag v-model="blackListForm.blackFrom" @add-tag="banEmailAddTag"  />
        </el-form-item>
        <el-form-item :label="t('blackSubjectDesc')" label-position="top">
          <el-input-tag v-model="blackListForm.blackSubject"/>
        </el-form-item>
        <el-form-item :label="t('blackContentDesc')" label-position="top">
          <el-input-tag v-model="blackListForm.blackContent"/>
        </el-form-item>
      </el-form>
      <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveBlackList">{{ $t('save') }}</el-button>
    </el-dialog>
    <el-dialog v-model="autoCleanShow" :title="t('autoClean')" class="forward-dialog" @closed="resetAutoClean">
      <el-form>
        <el-form-item :label="t('autoCleanDays')" label-position="top">
          <el-input-number v-model="autoCleanDays" :min="0" :max="3650" style="width: 100%"/>
        </el-form-item>
        <el-form-item :label="t('autoCleanExclude')" label-position="top">
          <el-input-tag
              tag-type="warning"
              :placeholder="$t('autoCleanExcludeDesc')"
              v-model="autoCleanExclude"
              @add-tag="autoCleanExcludeAddTag"
          />
        </el-form-item>
      </el-form>
      <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveAutoClean">{{ $t('save') }}</el-button>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { setBlackList } from '@/request/setting.js';
import { getTextWidth } from '@/utils/text.js';
import { isDomain, isEmail } from '@/utils/verify-utils.js';
import { addTags, useSysSetting } from '../use-sys-setting.js';

const { t } = useI18n();
const { setting, settingStore, settingLoading, editSetting, getSettings, onSettingsLoaded } = useSysSetting();

const resendTokenFormShow = ref(false);
const resendTokenForm = reactive({ domain: '', token: '' });
const showResendList = ref(false);
const emailColumnWidth = ref(0);
const tokenColumnWidth = ref(0);
const blackFormShow = ref(false);
const blackListForm = ref({ blackSubject: [], blackContent: [], blackFrom: [] });
const autoCleanShow = ref(false);
const autoCleanDays = ref(0);
const autoCleanExclude = ref([]);

onSettingsLoaded(() => {
  resendTokenForm.domain = setting.value.domainList[0];
  resetBlackList();
});

function saveResendToken() {
  const settingForm = { resendTokens: {} };
  const domain = resendTokenForm.domain.slice(1);
  settingForm.resendTokens[domain] = resendTokenForm.token;
  editSetting(settingForm).then((saved) => {
    if (saved) resendTokenFormShow.value = false;
  });
}

const compareByLengthAndUpperCase = (a, b, key) => {
  const getUpperCaseCount = (str) => (str.match(/[A-Z]/g) || []).length;
  if (a[key].length === b[key].length) {
    return getUpperCaseCount(a[key]) > getUpperCaseCount(b[key]) ? a : b;
  }
  return a[key].length > b[key].length ? a : b;
};

const resendList = computed(() => {
  const list = Object.keys(setting.value.resendTokens).map((key) => ({
    key,
    value: setting.value.resendTokens[key]
  }));
  if (list.length > 0) {
    const key = list.reduce((a, b) => compareByLengthAndUpperCase(a, b, 'key')).key;
    emailColumnWidth.value = getTextWidth(key) + 30;
    const value = list.reduce((a, b) => compareByLengthAndUpperCase(a, b, 'value')).value;
    tokenColumnWidth.value = getTextWidth(value) + 30;
  }
  return list;
});

function resetBlackList() {
  blackListForm.value.blackFrom = setting.value.blackFrom ? setting.value.blackFrom.split(',') : [];
  blackListForm.value.blackContent = setting.value.blackContent ? setting.value.blackContent.split(',') : [];
  blackListForm.value.blackSubject = setting.value.blackSubject ? setting.value.blackSubject.split(',') : [];
}

function banEmailAddTag(val) {
  addTags(blackListForm.value.blackFrom, val, (value) => isEmail(value) || isDomain(value));
}

function saveBlackList() {
  const form = {
    blackContent: blackListForm.value.blackContent + '',
    blackSubject: blackListForm.value.blackSubject + '',
    blackFrom: blackListForm.value.blackFrom + ''
  };
  settingLoading.value = true;
  setBlackList(form).then(() => {
    getSettings();
    ElMessage({ message: t('setSuccess'), type: 'success', plain: true });
    blackFormShow.value = false;
  }).finally(() => {
    settingLoading.value = false;
  });
}

function resetAutoClean() {
  autoCleanDays.value = setting.value.autoCleanDays ?? 0;
  autoCleanExclude.value = setting.value.autoCleanExclude
      ? setting.value.autoCleanExclude.split(',').filter(Boolean)
      : [];
}

function autoCleanExcludeAddTag(val) {
  addTags(autoCleanExclude.value, val, isEmail);
}

async function saveAutoClean() {
  const saved = await editSetting({
    autoCleanDays: autoCleanDays.value,
    autoCleanExclude: autoCleanExclude.value.join(',')
  }, true);
  if (saved) autoCleanShow.value = false;
}

defineExpose({
  openResendForm: () => { resendTokenFormShow.value = true; },
  openResendList: () => { showResendList.value = true; },
  openBlackList: () => { blackFormShow.value = true; },
  openAutoClean: () => {
    resetAutoClean();
    autoCleanShow.value = true;
  }
});
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
<style scoped lang="scss">
:deep(.resend-table.el-dialog) {
  min-height: 300px;
  width: 500px !important;
  @media (max-width: 540px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.resend-table .el-dialog__header) {
  padding-bottom: 5px;
}

:deep(.el-table__inner-wrapper:before) {
  background: var(--el-bg-color);
}
</style>
