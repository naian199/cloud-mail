<template>
  <div ref="element" class="message-translation" :class="{ 'translation-empty': chatStyle && !result && !error && !loading }" @pointerdown.stop @contextmenu.stop>
    <el-button v-if="!result && (!chatStyle || loading)" text size="small" :loading="loading" :aria-label="t('translateTitle')" @click="translate()">{{ t('translateAction') }}</el-button>
    <el-button v-if="error" class="translation-error" text size="small" :title="t(error)" :aria-label="t(error)" @click="openSettings">{{ t('translateFailed') }}</el-button>
    <div v-if="result && !hidden" class="translated-text" dir="auto">
      <div class="translation-caption">
        <small>{{ t('translateResult', { language: result.language }) }}<template v-if="result.provider === 'local'"> · {{ t('translateLocal') }}</template></small>
        <el-button text size="small" @click="hidden = true">{{ t('translateHide') }}</el-button>
      </div>
      <p>{{ result.text }}</p>
      <small v-if="result.truncated">{{ t('translateTruncated') }}</small>
    </div>
    <el-button v-else-if="result" text size="small" @click="hidden = false">{{ t('translateShow') }}</el-button>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { languages } from '@/i18n';
import http from '@/axios';
import { translateLocally } from '@/utils/local-translation.mjs';
import {
  autoTranslation,
  scheduleAutoTranslation,
  syncTranslationLanguage,
  translationStatus
} from '@/composables/use-auto-translation';
const props = defineProps({ emailId: Number, text: String, chatStyle: Boolean, incoming: Boolean });
const { t, locale } = useI18n();
const element = ref(null);
const visible = ref(false);
let observer,
  generation = 0,
  queued = '';
const loading = ref(false),
  error = ref(''),
  result = ref(null),
  hidden = ref(false);
const target = ref(autoTranslation.target || languages.find((language) => language.code === locale.value)?.google || 'en');
watch(locale, syncTranslationLanguage, { immediate: true });
const cache = new Map();
let controller,
  stopped = false;
function openSettings() { translationStatus.settingsOpen = true; }
defineExpose({ open: () => translate() });
async function translate(automatic = false) {
  if (loading.value) return;
  target.value = autoTranslation.target;
  error.value = '';
  hidden.value = false;
  if (cache.has(target.value)) {
    result.value = cache.get(target.value);
    return;
  }
  loading.value = true;
  controller = new AbortController();
  const selected = target.value;
  const revision = generation;
  try {
    const local = await translateLocally(props.text, selected, controller.signal);
    if (stopped || revision !== generation) return;
    if (!local && !autoTranslation.cloudConsent) {
      if (automatic !== true) openSettings();
      return;
    }
    if (!local && automatic === true && translationStatus.error) return;
    const data = local || await http.post(
      '/mail-chat/translate',
      { emailId: props.emailId, target: selected },
      { noMsg: true, signal: controller.signal, timeout: 20000 }
    );
    if (stopped || revision !== generation) return;
    if (!local) translationStatus.error = '';
    if (data.text?.trim() === props.text?.trim()) return;
    const value = {
      ...data,
      language: languages.find((language) => language.google === selected)?.name || selected
    };
    cache.set(selected, value);
    result.value = value;
  } catch (failure) {
    if (!stopped && revision === generation) {
      const key = failure?.errorKey || (String(failure?.message).startsWith('translateError') ? failure.message : 'translateErrorProvider');
      translationStatus.error = key;
      if (automatic !== true) error.value = key;
    }
  } finally {
    if (!stopped && revision === generation) loading.value = false;
  }
}
watch([() => props.text, () => autoTranslation.target], () => {
  generation++;
  controller?.abort();
  loading.value = false;
  queued = '';
  cache.clear();
  result.value = null;
  error.value = '';
});
function eligible() {
  return (
    !stopped &&
    autoTranslation.enabled &&
    props.incoming &&
    visible.value &&
    document.visibilityState === 'visible'
  );
}
function queueAutomatic() {
  if (!eligible() || !props.text?.trim() || !autoTranslation.target) return;
  const selected = autoTranslation.target;
  const revision = generation;
  const identity = `${revision}:${selected}`;
  if (queued === identity) return;
  queued = identity;
  scheduleAutoTranslation(
    () => eligible() && revision === generation && autoTranslation.target === selected,
    async () => {
      target.value = selected;
      await translate(true);
    }
  ).finally(() => {
    if (queued === identity) queued = '';
  });
}
watch(
  [() => autoTranslation.enabled, () => autoTranslation.target, () => autoTranslation.cloudConsent, () => translationStatus.error, visible, () => props.text],
  queueAutomatic
);
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    visible.value = entries[0]?.isIntersecting === true;
  });
  observer.observe(element.value);
  document.addEventListener('visibilitychange', queueAutomatic);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', queueAutomatic);
  stopped = true;
  controller?.abort();
  cache.clear();
});
</script>
<style scoped>
.message-translation { margin-top: 4px; min-width: 0; }
.translation-empty { margin-top: 0; height: 1px; }
.message-translation > .el-button { height: 22px; padding: 0 2px; font-size: 11px; }
.translation-error { color: var(--el-text-color-secondary); }
.translated-text { border-top: 1px solid var(--el-border-color-lighter); padding-top: 4px; }
.translation-caption { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--el-text-color-secondary); }
.translation-caption small { font-size: 11px; }
.translation-caption .el-button { height: 20px; padding: 0; font-size: 11px; }
.translated-text p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 2px 0 0; }
</style>
