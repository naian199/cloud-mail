<template>
  <div class="setting-dialogs">
    <el-dialog v-model="aiCodeFilterShow" class="forward-dialog" @closed="resetAiCodeFilter">
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('codeRecognitionRules') }}</span>
          <el-tooltip effect="dark" :content="$t('codeRecognitionRulesDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <el-form>
        <el-form-item :label="t('senderRules')" label-position="top">
          <el-input-tag v-model="aiCodeFilter" @add-tag="aiCodeFilterAddTag"/>
        </el-form-item>
      </el-form>
      <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveAiCodeFilter">{{ $t('save') }}</el-button>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { isDomain, isEmail } from '@/utils/verify-utils.js';
import { addTags, useSysSetting } from '../use-sys-setting.js';

const { t } = useI18n();
const { setting, settingLoading, editSetting, onSettingsLoaded } = useSysSetting();

const aiCodeFilterShow = ref(false);
const aiCodeFilter = ref([]);

onSettingsLoaded(resetAiCodeFilter);

function resetAiCodeFilter() {
  aiCodeFilter.value = setting.value.aiCodeFilter ? setting.value.aiCodeFilter.split(',') : [];
}

function aiCodeFilterAddTag(val) {
  addTags(aiCodeFilter.value, val, (value) => isEmail(value) || isDomain(value));
}

async function saveAiCodeFilter() {
  if (await editSetting({ aiCodeFilter: aiCodeFilter.value + '' })) aiCodeFilterShow.value = false;
}

defineExpose({ open: () => { aiCodeFilterShow.value = true; } });
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
