<template>
  <nav class="conversation-categories" :aria-label="t('navigationMenu')">
    <RouterLink v-for="item in categories" :key="item.id" :to="active === item.id ? route.fullPath : item.to" :class="{ 'category-active': active === item.id }" :aria-current="active === item.id ? 'page' : undefined">{{ t(item.label) }}</RouterLink>
  </nav>
</template>
<script setup>
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
const props = defineProps({ kind: { type: String, default: 'group' } });
const route = useRoute(), { t } = useI18n();
const categories = [
  { id: 'chat', label: 'mailChatInternalGroup', to: '/mail-chat' },
  { id: 'external', label: 'mailChatExternalGroup', to: '/external-mail' },
  { id: 'group', label: 'roomGroup', to: { path: '/rooms', query: { kind: 'group' } } },
  { id: 'channel', label: 'roomChannel', to: { path: '/rooms', query: { kind: 'channel' } } }
];
const active = computed(() => route.name === 'rooms' ? props.kind : route.name === 'external-mail' ? 'external' : 'chat');
</script>
<style scoped>
.conversation-categories { display:flex; flex-shrink:0; gap:2px; padding:0 8px; border-bottom:1px solid var(--el-border-color); }
a { position:relative; flex:1; min-width:0; text-align:center; padding:10px 3px; color:var(--el-text-color-secondary); text-decoration:none; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-radius:6px 6px 0 0; }
a:hover { background:var(--el-fill-color-light); }.category-active { color:var(--el-color-primary); font-weight:600; }.category-active::after { content:''; position:absolute; height:3px; background:currentColor; inset-inline:8px; bottom:0; border-radius:3px 3px 0 0; }
a:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
</style>
