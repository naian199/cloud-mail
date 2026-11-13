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
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
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

defineExpose({
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
