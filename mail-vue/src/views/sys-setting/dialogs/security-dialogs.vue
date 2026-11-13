<template>
  <div class="setting-dialogs">
    <el-dialog v-model="turnstileShow" :title="$t('addTurnstileSecret')" width="340"
               @closed="turnstileForm.secretKey = '';turnstileForm.siteKey = ''">
      <form @submit.prevent>
        <el-input type="text" placeholder="Site Key" v-model="turnstileForm.siteKey" @keyup.enter="saveTurnstileKey"/>
        <el-input show-password autocomplete="new-password" type="password" style="margin-top: 15px" placeholder="Secret Key" v-model="turnstileForm.secretKey" @keyup.enter="saveTurnstileKey"/>
        <el-button type="primary" :loading="settingLoading" @click="saveTurnstileKey">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog v-model="oauthSettingShow" :title="$t('oauthSetting') + ' - ' + oauthForm.label" width="340"
               @closed="oauthForm.clientId = ''; oauthForm.clientSecret = ''; oauthForm.switch = 1">
      <div class="dialog-content">
        <el-input type="text" :placeholder="$t('clientId')" v-model="oauthForm.clientId"/>
        <el-input show-password autocomplete="new-password" type="password" style="margin-top: 15px" :placeholder="$t('clientSecret')" v-model="oauthForm.clientSecret"/>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-switch v-model="oauthForm.switch" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                     :inactive-text="$t('disable')"/>
          <el-button type="primary" :loading="settingLoading" @click="saveOauth">{{ $t('save') }}</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog v-model="regVerifyCountShow" :title="$t('rulesVerifyTitle',{count: regVerifyCount})"
               @closed="regVerifyCount = setting.regVerifyCount">
      <form @submit.prevent>
        <el-input-number type="text" v-model="regVerifyCount" :min="1" @keyup.enter="saveRegVerifyCount">
        </el-input-number>
        <el-button type="primary" :loading="settingLoading" @click="saveRegVerifyCount">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog v-model="addVerifyCountShow" :title="$t('rulesVerifyTitle',{count: addVerifyCount})"
               @closed="addVerifyCount = setting.addVerifyCount">
      <form @submit.prevent>
        <el-input-number type="text" v-model="addVerifyCount" :min="1" @keyup.enter="saveAddVerifyCount"/>
        <el-button type="primary" :loading="settingLoading" @click="saveAddVerifyCount">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useSysSetting } from '../use-sys-setting.js';

const { setting, settingLoading, editSetting, onSettingsLoaded } = useSysSetting();

const turnstileShow = ref(false);
const turnstileForm = reactive({ siteKey: '', secretKey: '' });
const oauthSettingShow = ref(false);
const oauthForm = reactive({ key: '', label: '', clientId: '', clientSecret: '', switch: 1 });
const regVerifyCountShow = ref(false);
const regVerifyCount = ref(1);
const addVerifyCountShow = ref(false);
const addVerifyCount = ref(1);

onSettingsLoaded(() => {
  addVerifyCount.value = setting.value.addVerifyCount;
  regVerifyCount.value = setting.value.regVerifyCount;
});

// Saves and, when the save succeeds, closes the dialog `show` controls.
async function save(form, show) {
  if (await editSetting(form)) show.value = false;
}

function saveTurnstileKey() {
  save({ siteKey: turnstileForm.siteKey, secretKey: turnstileForm.secretKey }, turnstileShow);
}

function openOauthSetting(p) {
  oauthForm.key = p.key;
  oauthForm.label = p.label;
  oauthForm.clientId = setting.value[p.key + 'ClientId'] || '';
  oauthForm.clientSecret = setting.value[p.key + 'ClientSecret'] || '';
  oauthForm.switch = setting.value[p.key + 'Switch'] ?? 1;
  oauthSettingShow.value = true;
}

function saveOauth() {
  save({
    [oauthForm.key + 'ClientId']: oauthForm.clientId,
    [oauthForm.key + 'ClientSecret']: oauthForm.clientSecret,
    [oauthForm.key + 'Switch']: oauthForm.switch
  }, oauthSettingShow);
}

function saveRegVerifyCount() {
  if (!regVerifyCount.value) regVerifyCount.value = 1;
  save({ regVerifyCount: regVerifyCount.value }, regVerifyCountShow);
}

function saveAddVerifyCount() {
  if (!addVerifyCount.value) addVerifyCount.value = 1;
  save({ addVerifyCount: addVerifyCount.value }, addVerifyCountShow);
}

defineExpose({
  openTurnstile: () => { turnstileShow.value = true; },
  openOauthSetting,
  openRegVerifyCount: () => { if (!settingLoading.value) regVerifyCountShow.value = true; },
  openAddVerifyCount: () => { if (!settingLoading.value) addVerifyCountShow.value = true; }
});
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
