<template>
  <div class="language-picker">
    <el-select
      :model-value="setting.lang"
      filterable
      :loading="loading"
      :disabled="loading"
      :aria-label="t('language')"
      @change="change"
    >
      <el-option
        v-for="language in languages"
        :key="language.code"
        :label="language.name"
        :value="language.code"
        ><span dir="auto">{{ language.name }}</span></el-option
      >
    </el-select>
    <p v-if="hint && !['zh', 'en'].includes(setting.lang)" class="draft-hint">
      {{ t('languageDraft') }}
    </p>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { useSettingStore } from '@/store/setting';
import { useUserStore } from '@/store/user';
import { languages, activateLanguage } from '@/i18n';
import { saveLocale } from '@/request/my';
const props = defineProps({ hint: { type: Boolean, default: false } });
const { t } = useI18n(),
  setting = useSettingStore(),
  user = useUserStore(),
  loading = ref(false);
async function change(code) {
  loading.value = true;
  try {
    if (!(await activateLanguage(code))) return;
    setting.lang = code;
    setting.languageManual = true;
    if (localStorage.getItem('token')) {
      try {
        await saveLocale(code);
        if (user.user) user.user.locale = code;
      } catch {
        ElMessage.warning(t('languageSaveError'));
      }
    }
  } catch {
    ElMessage.error(t('languageLoadError'));
  } finally {
    loading.value = false;
  }
}
</script>
<style scoped>
.language-picker {
  min-width: 0;
  max-width: 360px;
}
.el-select {
  width: 220px;
  max-width: 100%;
}
.draft-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
</style>
