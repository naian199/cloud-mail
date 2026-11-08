<template>
  <div v-if="!compact" class="sidebar-tools" :class="{ 'tools-collapsed': collapsed }">
    <button type="button" class="sidebar-toggle" aria-controls="conversation-sidebar" :aria-label="t(collapsed?'conversationExpand':'conversationCollapse')" :title="t(collapsed?'conversationExpand':'conversationCollapse')" :aria-expanded="!collapsed" @click="toggleSidebar"><Icon icon="cloud-mail:back" width="17" :class="{ reversed: collapsed }" /></button>
    <button v-if="collapsed" type="button" class="sidebar-search" :aria-label="t('omniPlaceholder')" :title="t('omniPlaceholder')" @click="search"><Icon icon="cloud-mail:search" width="20" /></button>
  </div>
</template>
<script setup>
import { nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useConversationSidebar } from '@/composables/use-conversation-sidebar';
const {t}=useI18n(),{compact,collapsed,toggle,expand}=useConversationSidebar();
const emit=defineEmits(['search','toggle']);
function toggleSidebar(){emit('toggle');toggle();}
async function search(){expand();await nextTick();emit('search');}
</script>
<style scoped>
.sidebar-tools {position:absolute;inset-block-start:0;inset-inline-end:0;width:32px;height:48px;z-index:3;}
.sidebar-tools button {display:grid;place-items:center;border:0;padding:0;background:transparent;color:var(--el-text-color-secondary);border-radius:6px;cursor:pointer;}
.sidebar-tools button:hover {background:var(--el-fill-color);color:var(--el-text-color-primary);}
.sidebar-tools button:focus-visible {outline:2px solid var(--el-color-primary);outline-offset:-2px;}
.sidebar-toggle {position:absolute;inset-block-start:8px;inset-inline-end:4px;width:28px;height:32px;}
.sidebar-toggle .reversed {transform:rotate(180deg);}
.tools-collapsed {position:relative;inset:auto;width:64px;height:80px;margin-top:-6px;}
.tools-collapsed .sidebar-toggle {inset-block-start:0;inset-inline-end:0;width:32px;height:40px;}
.sidebar-search {position:absolute;inset-block-end:0;inset-inline-start:12px;width:40px;height:40px;}
:global(html[dir="rtl"]) .sidebar-toggle svg {transform:rotate(180deg);}
:global(html[dir="rtl"]) .sidebar-toggle .reversed {transform:none;}
</style>
