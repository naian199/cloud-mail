<template>
  <div
    ref="element"
    class="message-translation"
    :class="{ 'translation-empty': chatStyle && !opened && !result && !error }"
    @pointerdown.stop
    @contextmenu.stop
  >
    <el-button
      v-if="!chatStyle"
      text
      size="small"
      :aria-label="t('translateTitle')"
      @click="toggle"
      >{{ t('translateTitle') }}</el-button
    >
    <div v-if="opened" class="translation-controls">
      <p v-if="!config?.enabled" role="status">
        {{ t('translateNotEnabled') }}
        <router-link v-if="hasPerm('setting:set')" to="/system-settings">{{
          t('translateConfigure')
        }}</router-link>
      </p>
      <template v-else>
        <el-select v-model="target" filterable :aria-label="t('translateTarget')">
          <el-option
            v-for="language in languages"
            :key="language.code"
            :label="language.name"
            :value="language.google"
          />
        </el-select>
        <p class="privacy">{{ t(chatStyle ? 'translatePrivacy' : 'translateExternalPrivacy') }}</p>
        <el-checkbox v-model="consent">{{ t('translateConsent') }}</el-checkbox>
        <el-button :loading="loading" :disabled="!consent" @click="translate">{{
          t('translateAction')
        }}</el-button>
      </template>
      <p v-if="error" role="alert">{{ t(error) }}</p>
    </div>
    <p v-if="error && !opened" role="alert">{{ t(error) }}</p>
    <div v-if="result && !hidden" class="translated-text" dir="auto">
      <strong>{{ t('translateResult', { language: result.language }) }}</strong>
      <p>{{ result.text }}</p>
      <small v-if="result.truncated">{{ t('translateTruncated') }}</small>
      <el-button text size="small" @click="hidden = true">{{ t('translateHide') }}</el-button>
    </div>
    <el-button v-else-if="result" text size="small" @click="hidden = false">{{
      t('translateShow')
    }}</el-button>
  </div>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { hasPerm } from '@/perm/perm';
import { languages } from '@/i18n';
import http from '@/axios';
import {
  autoTranslation,
  saveAutoTranslation,
  scheduleAutoTranslation
} from '@/composables/use-auto-translation';
const props = defineProps({ emailId: Number, text: String, chatStyle: Boolean, incoming: Boolean });
const { t, locale } = useI18n();
const element = ref(null);
const visible = ref(false);
let observer,
  generation = 0,
  queued = '';
const opened = ref(false),
  config = ref(null),
  consent = ref(false),
  loading = ref(false),
  error = ref(''),
  result = ref(null),
  hidden = ref(false);
const target = ref(languages.find((language) => language.code === locale.value)?.google || 'en');
const cache = new Map();
let controller,
  stopped = false;
async function toggle() {
  opened.value = !opened.value;
  if (opened.value) {
    error.value = '';
    try {
      config.value = await http.get('/mail-chat/translation/config', { noMsg: true });
    } catch {
      error.value = 'serviceUnavailable';
    }
  }
}
defineExpose({
  open: async () => {
    if (!opened.value) await toggle();
    element.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
});
async function translate(automatic = false) {
  if ((!consent.value && automatic !== true) || loading.value) return;
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
    const data = await http.post(
      '/mail-chat/translate',
      { emailId: props.emailId, target: selected },
      { noMsg: true, signal: controller.signal, timeout: 20000 }
    );
    if (stopped || revision !== generation) return;
    const value = {
      ...data,
      language: languages.find((language) => language.google === selected)?.name || selected
    };
    cache.set(selected, value);
    result.value = value;
  } catch (failure) {
    if (!stopped && revision === generation)
      error.value =
        failure?.errorKey ||
        (String(failure?.message).startsWith('translateError')
          ? failure.message
          : 'translateErrorProvider');
    if (
      automatic === true &&
      !stopped &&
      revision === generation &&
      ['translateErrorQuota', 'translateErrorDisabled', 'translateErrorKey'].includes(error.value)
    ) {
      autoTranslation.enabled = false;
      saveAutoTranslation();
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
  [() => autoTranslation.enabled, () => autoTranslation.target, visible, () => props.text],
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
.message-translation {
  margin-top: 8px;
  min-width: 0;
}
.translation-empty {
  margin-top: 0;
  height: 1px;
}
.translation-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.el-select {
  width: 200px;
  max-width: 100%;
}
.privacy,
.translation-controls p {
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
:deep(.el-checkbox) {
  height: auto;
  align-items: flex-start;
}
:deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.5;
}
.translated-text {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color);
  padding-top: 10px;
}
.translated-text p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-top: 8px;
}
</style>
