<template>
  <el-button class="voice-trigger" text :type="listening ? 'danger' : 'default'" :disabled="disabled" :aria-label="t(listening ? 'voiceStop' : 'voiceInput')" :aria-pressed="listening" :title="t(!supported ? 'voiceUnavailable' : listening ? 'voiceStop' : 'voiceInput')" @click="toggle">
    <Icon :icon="listening ? 'cloud-mail:stop' : 'cloud-mail:microphone'" width="20" />
  </el-button>
  <el-dialog v-model="confirming" :title="t('voiceInput')" width="min(420px, 92vw)" append-to-body>
    <p>{{ t('voicePrivacy') }}</p>
    <template #footer><el-button @click="confirming = false">{{ t('cancel') }}</el-button><el-button type="primary" @click="accept">{{ t('voiceInput') }}</el-button></template>
  </el-dialog>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { languages } from '@/i18n';
const props = defineProps({ context: [String,Number], disabled: Boolean });
const emit = defineEmits(['text']);
const { t, locale } = useI18n();
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supported = !!Recognition && window.isSecureContext;
const listening = ref(false), confirming = ref(false);
let consent = false, recognition, generation = 0;
try { consent = localStorage.getItem('cloud-mail:voice-consent') === 'yes'; } catch {}
function cancel() {
  generation++;
  const old = recognition;
  recognition = null;
  listening.value = false;
  try { old?.abort(); } catch {}
}
function start() {
  if (props.disabled || !supported || listening.value) return;
  const current = ++generation;
  try {
    const session = new Recognition();
    recognition = session;
    session.lang = languages.find(language => language.code === locale.value)?.html || navigator.language;
    session.continuous = true;
    session.interimResults = false;
    session.onresult = event => {
      if (current !== generation || props.disabled) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0]?.transcript?.trim();
          if (text) emit('text', text + (/^(zh|ja|ko)/.test(session.lang) ? '' : ' '));
        }
      }
    };
    session.onerror = event => {
      if (current !== generation) return;
      cancel();
      if (event.error !== 'aborted') ElMessage.error(t(['not-allowed','service-not-allowed','audio-capture'].includes(event.error) ? 'voiceDenied' : 'voiceError'));
    };
    session.onend = () => {
      if (current === generation) { recognition = null; listening.value = false; }
    };
    session.start();
    listening.value = true;
  } catch { cancel(); ElMessage.error(t('voiceError')); }
}
function toggle() {
  if (listening.value) { try { recognition?.stop(); } catch { cancel(); } return; }
  if (!supported) { ElMessage.warning(t('voiceUnavailable')); return; }
  if (!consent) { confirming.value = true; return; }
  start();
}
function accept() {
  confirming.value = false;
  consent = true;
  try { localStorage.setItem('cloud-mail:voice-consent','yes'); } catch {}
  start();
}
watch([() => props.context, () => props.disabled, locale], cancel);
function visibility() { if (document.hidden) cancel(); }
document.addEventListener('visibilitychange',visibility);
onBeforeUnmount(() => { cancel(); document.removeEventListener('visibilitychange',visibility); });
</script>
<style scoped>
.voice-trigger { margin: 0; width: 34px; height: 40px; padding: 0; }
</style>
