import { inject, nextTick, onBeforeUnmount, provide, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { settingQuery, settingSet } from '@/request/setting.js';
import { useSettingStore } from '@/store/setting.js';
import { useAccountStore } from '@/store/account.js';
import { useUserStore } from '@/store/user.js';

const KEY = Symbol('sys-setting');

// Loading and saving of system settings, shared by the settings page and its dialogs.
export function provideSysSetting() {
  const { t } = useI18n();
  const settingStore = useSettingStore();
  const accountStore = useAccountStore();
  const userStore = useUserStore();
  const { settings: setting } = storeToRefs(settingStore);
  const settingLoading = ref(false);
  const clearS3Loading = ref(false);
  const settingReady = ref(false);
  const firstLoading = ref(true);
  const settingsLoadError = ref(false);
  const loadedHooks = new Set();
  const failedHooks = new Set();
  let backup = '{}';

  function getSettings() {
    if (settingsLoadError.value) firstLoading.value = true;
    settingsLoadError.value = false;
    settingReady.value = false;
    settingQuery().then((settingData) => {
      setting.value = settingData;
      settingStore.domainList = settingData.domainList;
      firstLoading.value = false;
      for (const hook of loadedHooks) hook();
      nextTick(() => {
        settingReady.value = true;
      });
    }).catch(() => {
      firstLoading.value = false;
      settingsLoadError.value = true;
    });
  }

  // Runs `reset` now and after every reload, so forms show the saved values.
  // Call from a component's setup: the hook is removed when it unmounts.
  function onSettingsLoaded(reset) {
    loadedHooks.add(reset);
    if (!firstLoading.value && !settingsLoadError.value) reset();
    onBeforeUnmount(() => loadedHooks.delete(reset));
  }

  // Runs before the failed change is rolled back, while `setting` still holds it.
  function onSaveFailed(hook) {
    failedHooks.add(hook);
    onBeforeUnmount(() => failedHooks.delete(hook));
  }

  function backupSetting() {
    backup = JSON.stringify(setting.value);
  }

  // Resolves true when saved, so a dialog can close itself; false when skipped or failed.
  function editSetting(settingForm, refreshStatus = true) {
    if (settingLoading.value) return Promise.resolve(false);
    settingLoading.value = true;
    return settingSet(settingForm).then(() => {
      settingLoading.value = false;
      ElMessage({ message: t('saveSuccessMsg'), type: 'success', plain: true });
      if (setting.value.manyEmail === 1) {
        accountStore.currentAccountId = userStore.user.account.accountId;
      }
      if (refreshStatus) getSettings();
      return true;
    }).catch(() => {
      for (const hook of failedHooks) hook();
      setting.value = { ...setting.value, ...JSON.parse(backup) };
      return false;
    }).finally(() => {
      settingLoading.value = false;
      clearS3Loading.value = false;
    });
  }

  function beforeChange() {
    if (!settingReady.value || settingLoading.value) return false;
    backupSetting();
    return true;
  }

  const context = {
    setting,
    settingStore,
    settingLoading,
    clearS3Loading,
    settingReady,
    firstLoading,
    settingsLoadError,
    getSettings,
    editSetting,
    beforeChange,
    onSettingsLoaded,
    onSaveFailed
  };
  provide(KEY, context);
  return context;
}

export function useSysSetting() {
  const context = inject(KEY);
  if (!context) throw new Error('useSysSetting() needs provideSysSetting() in an ancestor');
  return context;
}

// Splits comma separated input into unique values and appends the valid ones,
// replacing the raw tag that el-input-tag has just added.
export function addTags(list, raw, isValid, { skipExisting = true } = {}) {
  const values = Array.from(new Set(raw.split(/[,，]/).map((item) => item.trim()).filter(Boolean)));
  list.splice(list.length - 1, 1);
  for (const value of values) {
    if (isValid(value) && !(skipExisting && list.includes(value))) list.push(value);
  }
}
