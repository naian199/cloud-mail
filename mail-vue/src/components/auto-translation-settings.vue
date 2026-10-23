<template>
  <div class="auto-translation-settings">
    <el-switch
      :model-value="autoTranslation.enabled"
      :loading="checking"
      :active-text="t('translateAuto')"
      @change="change"
    />
    <el-select
      v-model="autoTranslation.target"
      filterable
      :aria-label="t('translateTarget')"
      @change="saveAutoTranslation"
    >
      <el-option
        v-for="language in languages"
        :key="language.code"
        :label="language.name"
        :value="language.google"
      />
    </el-select>
    <p v-if="error" role="status">{{ t(error) }}</p>
    <el-dialog
      v-model="confirming"
      :title="t('translateAuto')"
      width="min(440px, 92vw)"
      append-to-body
    >
      <p>{{ t('translateAutoConsent') }}</p>
      <template #footer>
        <el-button @click="confirming = false">{{ t('translateHide') }}</el-button>
        <el-button type="primary" @click="enable">{{ t('translateAutoEnable') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { languages } from '@/i18n';
import {
  autoTranslation,
  saveAutoTranslation,
  translationAvailability
} from '@/composables/use-auto-translation';
const { t, locale } = useI18n();
if (!languages.some((language) => language.google === autoTranslation.target)) {
  autoTranslation.target =
    languages.find((language) => language.code === locale.value)?.google || 'en';
}
const checking = ref(false),
  confirming = ref(false),
  error = ref('');
async function change(value) {
  error.value = '';
  if (!value) {
    autoTranslation.enabled = false;
    saveAutoTranslation();
    return;
  }
  checking.value = true;
  try {
    const config = await translationAvailability();
    if (!config.enabled) {
      error.value = 'translateNotEnabled';
      return;
    }
    confirming.value = true;
  } catch {
    error.value = 'serviceUnavailable';
  } finally {
    checking.value = false;
  }
}
function enable() {
  autoTranslation.enabled = true;
  saveAutoTranslation();
  confirming.value = false;
}
</script>
<style scoped>
.auto-translation-settings {
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color);
}
.el-select {
  width: 100%;
  margin-top: 4px;
}
p {
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
