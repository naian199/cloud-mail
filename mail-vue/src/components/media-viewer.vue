<template>
  <el-dialog :model-value="!!current" fullscreen :show-close="false" :title="t('mediaOpen')" class="chat-media-viewer" @close="$emit('close')" @keydown="navigateKey">
    <template #header>
      <div class="media-toolbar">
        <strong>{{ current?.file.filename }}</strong>
        <span role="status">{{ index + 1 }} / {{ items.length }}</span>
        <el-button text :disabled="!current?.file.attId && !/^(blob:|data:image\/)/.test(current?.src || '')" @click="$emit('download', current)">{{ t('videoDownload') }}</el-button>
        <el-button text :aria-label="t('cancel')" @click="$emit('close')">✕</el-button>
      </div>
    </template>
    <div v-if="current" class="media-stage">
      <el-button class="media-prev" circle :disabled="index <= 0" :aria-label="t('mediaPrevious')" @click="step(-1)"><Icon icon="cloud-mail:back" width="24" /></el-button>
      <div class="media-content" :key="current.id">
        <VideoAttachment v-if="current.kind === 'video'" expanded :file="current.file" :cache-key="current.cacheKey" :load="current.load" @download="$emit('download', current)" />
        <img v-else-if="current.src" :src="current.src" :alt="current.file.filename" referrerpolicy="no-referrer" />
        <span v-else class="brand-loading-status" role="status"><BrandLoading :size="48" />{{ t('mailChatImageLoading') }}</span>
      </div>
      <el-button class="media-next" circle :disabled="index >= items.length - 1" :aria-label="t('mediaNext')" @click="step(1)"><Icon icon="cloud-mail:back" width="24" /></el-button>
    </div>
  </el-dialog>
</template>
<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import VideoAttachment from './video-attachment.vue';
const props = defineProps({ items: { type: Array, required: true }, activeId: { type: String, default: '' } });
const emit = defineEmits(['close', 'navigate', 'download']);
const { t } = useI18n();
const index = computed(() => props.items.findIndex(item => item.id === props.activeId));
const current = computed(() => props.items[index.value]);
function step(delta) { const item = props.items[index.value + delta]; if (item) emit('navigate', item.id); }
function navigateKey(event) {
  if (event.target.closest('video,input,textarea')) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
}
</script>
<style>
.chat-media-viewer.el-dialog { display:flex; flex-direction:column; padding:0; background:#101820; color:#f3f5f7; --el-text-color-primary:#f3f5f7; --el-text-color-regular:#d1d7df; --el-text-color-secondary:#b1bac7; }
.chat-media-viewer .el-dialog__header { margin:0; padding:10px 16px; border-bottom:1px solid #ffffff20; }
.chat-media-viewer .el-dialog__body { flex:1; min-height:0; padding:12px; overflow:auto; color:inherit; }
.chat-media-viewer .media-toolbar { display:flex; align-items:center; gap:12px; }
.chat-media-viewer .media-toolbar strong { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chat-media-viewer .media-toolbar span { font-size:12px; white-space:nowrap; }
.chat-media-viewer .media-stage { display:grid; grid-template-columns:40px minmax(0,1fr) 40px; align-items:center; gap:12px; min-height:100%; }
.chat-media-viewer .media-content { display:flex; justify-content:center; min-width:0; }
.chat-media-viewer .media-content>img { display:block; max-width:100%; max-height:calc(100dvh - 100px); object-fit:contain; }
.chat-media-viewer .media-next svg { transform:rotate(180deg); }
.chat-media-viewer .el-button { color:#f3f5f7; background:transparent; border-color:#ffffff40; margin:0; }
@media(max-width:600px) { .chat-media-viewer .el-dialog__header { padding:8px; } .chat-media-viewer .media-toolbar { gap:6px; } .chat-media-viewer .media-toolbar strong { font-size:12px; } .chat-media-viewer .media-stage { grid-template-columns:28px minmax(0,1fr) 28px; gap:4px; } .chat-media-viewer .media-stage>.el-button { width:28px; height:28px; } .chat-media-viewer .el-dialog__body { padding:6px; } }
</style>
