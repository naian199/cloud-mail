<template>
  <div class="message-translation" @pointerdown.stop @contextmenu.stop>
    <el-button text size="small" :aria-label="t('translateTitle')" @click="toggle">{{
      t('translateTitle')
    }}</el-button>
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
import { ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { hasPerm } from '@/perm/perm';
import { languages } from '@/i18n';
import http from '@/axios';
const props = defineProps({ emailId: Number, text: String, chatStyle: Boolean });
const { t, locale } = useI18n();
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
async function translate() {
  if (!consent.value || loading.value) return;
  error.value = '';
  hidden.value = false;
  if (cache.has(target.value)) {
    result.value = cache.get(target.value);
    return;
  }
  loading.value = true;
  controller = new AbortController();
  const selected = target.value;
  try {
    const data = await http.post(
      '/mail-chat/translate',
      { emailId: props.emailId, target: selected },
      { noMsg: true, signal: controller.signal, timeout: 20000 }
    );
    if (stopped) return;
    const value = {
      ...data,
      language: languages.find((language) => language.google === selected)?.name || selected
    };
    cache.set(selected, value);
    result.value = value;
  } catch (failure) {
    if (!stopped)
      error.value =
        failure?.errorKey ||
        (String(failure?.message).startsWith('translateError')
          ? failure.message
          : 'translateErrorProvider');
  } finally {
    if (!stopped) loading.value = false;
  }
}
watch(
  () => props.text,
  () => {
    controller?.abort();
    cache.clear();
    result.value = null;
    error.value = '';
  }
);
onBeforeUnmount(() => {
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
