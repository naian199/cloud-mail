<template>
  <div class="setting-dialogs">
    <el-dialog v-model="emailPrefixShow" :title="t('emailPrefix')"  @closed="resetEmailPrefix"  >
      <div class="email-prefix">
        <div>{{ t('atLeast') }}</div>
        <el-input-number v-model="minEmailPrefix" :min="1" :max="20" style="width: 150px" @keyup.enter="saveEmailPrefix" >
          <template #suffix>
            <span>{{ t('character') }}</span>
          </template>
        </el-input-number>
      </div>
      <div class="prefix-filter">
        <div style="margin-bottom: 10px;">{{ t('mustNotContain') }}</div>
        <el-input-tag style="margin-bottom: 10px;" v-model="emailPrefixFilter"  />
      </div>
      <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveEmailPrefix">{{ $t('save') }}</el-button>
    </el-dialog>
    <el-dialog v-model="editTitleShow" :title="$t('changeTitle')" width="340" @closed="editTitle = setting.title">
      <form @submit.prevent>
        <el-input type="text" :placeholder="$t('websiteTitle')" v-model="editTitle" @keyup.enter="saveTitle"/>
        <el-button type="primary" :loading="settingLoading" @click="saveTitle">{{ $t('save') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog
        v-model="showSetBackground"
        class="cut-dialog"
        @closed="closedSetBackground"
    >
      <template #header>
        <span style="font-size: 18px">
          {{ $t('backgroundTitle') }}
          <el-tooltip>
            <template #content>
              <span>{{ $t('backgroundWarning') }}</span>
            </template>
            <Icon class="title-icon  warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </span>
      </template>
      <el-input :placeholder="$t('backgroundUrlDesc')" v-model="backgroundUrl" v-if="!localUpShow"
                class="background-url" @keyup.enter="saveBackground"/>
      <el-image
          v-if="localUpShow"
          :preview-src-list="[backgroundImage]"
          show-progress
          class="cropper"
          fit="cover"
          :src="backgroundImage"
      ></el-image>
      <div class="cut-button">
        <el-button type="primary" link @click="openCut" v-if="!localUpShow">
          {{ $t('localUpload') }}
        </el-button>
        <el-button type="primary" link @click="localUpShow = false" v-if="localUpShow">
          {{ $t('imageLink') }}
        </el-button>
        <el-button type="primary" :loading="settingLoading" @click="saveBackground">{{ $t('save') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { setBackground } from '@/request/setting.js';
import { fileToBase64 } from '@/utils/file-utils.js';
import { useSysSetting } from '../use-sys-setting.js';

const { t } = useI18n();
const { setting, settingLoading, editSetting, onSettingsLoaded } = useSysSetting();

const emailPrefixShow = ref(false);
const minEmailPrefix = ref(0);
const emailPrefixFilter = ref([]);

const editTitleShow = ref(false);
const editTitle = ref('');

const showSetBackground = ref(false);
const backgroundUrl = ref('');
const backgroundImage = ref('');
const localUpShow = ref(false);
let backgroundFile = {};

onSettingsLoaded(() => {
  minEmailPrefix.value = setting.value.minEmailPrefix;
  backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : '';
  editTitle.value = setting.value.title;
  resetEmailPrefix();
});

function resetEmailPrefix() {
  minEmailPrefix.value = setting.value.minEmailPrefix;
  emailPrefixFilter.value = setting.value.emailPrefixFilter;
}

async function saveEmailPrefix() {
  if (await editSetting({ minEmailPrefix: minEmailPrefix.value, emailPrefixFilter: emailPrefixFilter.value }, true)) {
    emailPrefixShow.value = false;
  }
}

async function saveTitle() {
  if (await editSetting({ title: editTitle.value })) editTitleShow.value = false;
}

function closedSetBackground() {
  backgroundImage.value = '';
  localUpShow.value = false;
  backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : '';
}

function openCut() {
  const doc = document.createElement('input');
  doc.setAttribute('type', 'file');
  doc.setAttribute('accept', 'image/*');
  doc.click();
  doc.onchange = async (e) => {
    backgroundFile = e.target.files[0];
    backgroundImage.value = URL.createObjectURL(e.target.files[0]);
    localUpShow.value = true;
  };
}

async function saveBackground() {
  if (settingLoading.value) return;

  let image = '';

  if (localUpShow.value) {
    image = await fileToBase64(backgroundFile, true);
  } else {
    if (backgroundUrl.value && !backgroundUrl.value.startsWith('http')) {
      ElMessage({ message: t('imageLinkErrorMsg'), type: 'error', plain: true });
      return;
    }
    image = backgroundUrl.value;
  }
  settingLoading.value = true;

  setBackground(image).then((key) => {
    setting.value.background = key;
    showSetBackground.value = false;
    ElMessage({ message: t('saveSuccessMsg'), type: 'success', plain: true });
    localUpShow.value = false;
    backgroundImage.value = '';
  }).finally(() => {
    settingLoading.value = false;
  });
}

// The page's background card also clears this link after deleting the background.
function clearBackgroundUrl() {
  backgroundUrl.value = '';
}

defineExpose({
  openEmailPrefix: () => { emailPrefixShow.value = true; },
  openTitle: () => { editTitleShow.value = true; },
  openBackground: () => { showSetBackground.value = true; },
  clearBackgroundUrl
});
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
<style scoped lang="scss">
.title-icon.warning {
  position: relative;
  top: 2px;
  cursor: pointer;
  margin-left: 2px;
}

.cropper {
  border-radius: 4px;
  border: 1px solid #D4D7DE;
  height: 397px;
  width: 705px;
  @media (max-width: 767px) {
    width: calc(100vw - 60px);
    height: calc((100vw - 60px) * 9 / 16);
  }
}

.background-url {
  width: min(calc(100vw - 70px), 500px);
}

:deep(.cut-dialog.el-dialog) {
  width: fit-content !important;
  height: fit-content !important;
}

.cut-button {
  padding-top: 15px;
  width: 100%;
  display: flex;
  justify-content: space-between;

  .el-button {
    width: fit-content;
  }
}

.email-prefix {
  display: flex;
  justify-content: space-between;
}

.prefix-filter {
  display: flex;
  flex-direction: column;
}
</style>
