<template>
  <div class="large-file" :class="{ unavailable: !available }">
    <Icon icon="cloud-mail:file" width="26" aria-hidden="true" />
    <span class="large-file-detail">
      <strong :title="file.filename">{{ file.filename }}</strong>
      <small>{{ formatBytes(file.size) }} · {{ t(available ? 'largeAttStoredRemotely' : 'largeAttUnavailable') }}</small>
    </span>
    <el-button v-if="available" size="small" :loading="opening" @click="open">{{ t('largeAttDownload') }}</el-button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { formatBytes } from '@/utils/file-utils';
import { largeAttLink } from '@/request/large-att';

// A large attachment in a message. Downloads happen on Turbobit's own page; no preview.
const props = defineProps({ file: { type: Object, required: true } });
const { t } = useI18n();
const opening = ref(false), gone = ref(false);
const available = computed(() => props.file.status === 'ready' && !gone.value);

async function open() {
  if (opening.value) return;
  opening.value = true;
  // Open the tab inside the click so popup blockers allow it, then point it at the link.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const { url } = await largeAttLink(props.file.attId);
    if (tab) tab.location.href = url; else window.open(url, '_blank', 'noopener');
  } catch (error) {
    tab?.close();
    if (error?.code === 410) gone.value = true;
  } finally {
    opening.value = false;
  }
}
</script>

<style scoped>
.large-file { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-top: 6px; border-radius: 10px; background: var(--el-fill-color-light); min-width: 0; max-width: 360px; }
.large-file.unavailable { opacity: .65; }
.large-file-detail { display: grid; min-width: 0; flex: 1; }
.large-file-detail strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.large-file-detail small { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
