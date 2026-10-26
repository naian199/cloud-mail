<template>
  <div class="conversation-resize" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="t('conversationWidth')" :aria-valuemin="260" :aria-valuemax="420" :aria-valuenow="width" @pointerdown="start" @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="drag = null" @keydown="key" @dblclick="ui.conversationWidth = 300"></div>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '@/store/ui';
const { t } = useI18n(), ui = useUiStore(), drag = ref(null);
const clamp = value => Math.min(420, Math.max(260, Number(value) || 300));
const width = computed(() => clamp(ui.conversationWidth));
function start(event) {
  if (event.button !== 0 || !event.isPrimary) return;
  event.preventDefault();
  drag.value = { id: event.pointerId, x: event.clientX, width: width.value, rtl: document.documentElement.dir === 'rtl' };
  event.currentTarget.setPointerCapture(event.pointerId);
}
function move(event) {
  if (drag.value?.id !== event.pointerId) return;
  event.preventDefault();
  const delta = event.clientX - drag.value.x;
  ui.conversationWidth = clamp(drag.value.width + (drag.value.rtl ? -delta : delta));
}
function stop(event) {
  if (drag.value?.id !== event.pointerId) return;
  drag.value = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}
function key(event) {
  const rtl = document.documentElement.dir === 'rtl';
  if (event.key === 'Home') ui.conversationWidth = 260;
  else if (event.key === 'End') ui.conversationWidth = 420;
  else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) ui.conversationWidth = clamp(width.value + ((event.key === 'ArrowRight') !== rtl ? 1 : -1) * (event.shiftKey ? 50 : 10));
  else return;
  event.preventDefault();
}
</script>
<style scoped>
.conversation-resize { position:absolute; top:0; bottom:0; inset-inline-end:-4px; width:8px; z-index:15; cursor:col-resize; touch-action:none; outline:none; }
.conversation-resize:hover,.conversation-resize:focus-visible { background:color-mix(in srgb, var(--el-color-primary) 45%, transparent); }
@media (max-width:767px), (max-width:1024px) and (max-height:500px) and (pointer:coarse) { .conversation-resize { display:none; } }
</style>
