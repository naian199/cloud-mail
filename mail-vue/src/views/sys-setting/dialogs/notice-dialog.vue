<template>
  <div class="setting-dialogs">
    <el-dialog top="5vh" v-model="noticePopupShow" :title="$t('noticePopup')" class="notice-popup"
               @closed="resetNoticeForm">
      <form @submit.prevent>
        <el-input v-model="noticeForm.noticeTitle" :placeholder="t('titleDesc')" @keyup.enter="saveNoticePopup"/>
        <div class="notice-line-item">
          <el-select v-model="noticeForm.noticeType">
            <template #prefix>
              <span style="margin-right: 10px">{{ $t('icon') }}</span>
            </template>
            <el-option key="none" label="None" value="none"/>
            <el-option key="primary" label="Primary" value="primary"/>
            <el-option key="success" label="Success" value="success"/>
            <el-option key="warning" label="Warning" value="warning"/>
            <el-option key="info" label="Info" value="info"/>
          </el-select>
          <el-select v-model="noticeForm.noticePosition">
            <template #prefix>
              <span style="margin-right: 10px">{{ $t('position') }}</span>
            </template>
            <el-option key="top-left" :label="t('topLeft')" value="top-left"/>
            <el-option key="top-right" :label="t('topRight')" value="top-right"/>
            <el-option key="bottom-left" :label="t('bottomLeft')" value="bottom-left"/>
            <el-option key="bottom-right" :label="t('bottomRight')" value="bottom-right"/>
          </el-select>
          <el-input-number v-model="noticeForm.noticeWidth">
            <template #prefix>
              {{ $t('width') }}
            </template>
            <template #suffix>
              px
            </template>
          </el-input-number>
          <el-input-number v-model="noticeForm.noticeOffset">
            <template #prefix>
              {{ $t('offset') }}
            </template>
            <template #suffix>
              px
            </template>
          </el-input-number>
          <el-input-number v-model="noticeForm.noticeDuration">
            <template #prefix>
              {{ $t('duration') }}
            </template>
            <template #suffix>
              ms
            </template>
          </el-input-number>
        </div>
        <div class="notice-popup-item">
          <el-input
              v-model="noticeForm.noticeContent"
              :autosize="{ minRows: 15, maxRows: 25 }"
              type="textarea"
              :placeholder="t('noticeContentDesc')"
          />
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <el-switch v-model="noticeForm.notice" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                     :inactive-text="$t('disable')"/>
          <div>
            <el-button @click="uiStore.previewNotice({...noticeForm})">
              {{ $t('preview') }}
            </el-button>
            <el-button :loading="settingLoading" type="primary" @click="saveNoticePopup">
              {{ $t('save') }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '@/store/ui.js';
import { useSysSetting } from '../use-sys-setting.js';

const { t } = useI18n();
const uiStore = useUiStore();
const { setting, settingLoading, editSetting, onSettingsLoaded } = useSysSetting();

const noticePopupShow = ref(false);
const noticeForm = reactive({
  noticeTitle: '',
  noticeContent: '',
  noticeType: '',
  noticeDuration: '',
  noticePosition: '',
  noticeOffset: 0,
  notice: 0,
  noticeWidth: 0
});

onSettingsLoaded(resetNoticeForm);

function resetNoticeForm() {
  noticeForm.notice = setting.value.notice;
  noticeForm.noticeContent = setting.value.noticeContent;
  noticeForm.noticeDuration = setting.value.noticeDuration;
  noticeForm.noticeTitle = setting.value.noticeTitle;
  noticeForm.noticePosition = setting.value.noticePosition;
  noticeForm.noticeType = setting.value.noticeType;
  noticeForm.noticeOffset = setting.value.noticeOffset;
  noticeForm.noticeWidth = setting.value.noticeWidth;
}

async function saveNoticePopup() {
  noticeForm.noticeOffset = noticeForm.noticeOffset || 0;
  noticeForm.noticeWidth = noticeForm.noticeWidth || 0;
  noticeForm.noticeDuration = noticeForm.noticeDuration || 0;
  if (await editSetting({ ...noticeForm })) noticePopupShow.value = false;
}

defineExpose({ open: () => { noticePopupShow.value = true; } });
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
<style scoped lang="scss">
.notice-popup-item {
  margin-top: 15px;
}

.notice-line-item {
  margin-top: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;

  > * {
    width: 100%;
  }

  @media (max-width: 840px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 580px) {
    grid-template-columns: 1fr;
  }
}

:deep(.notice-popup.el-dialog) {
  min-height: 300px;
  width: 820px !important;
  @media (max-width: 860px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}
</style>
