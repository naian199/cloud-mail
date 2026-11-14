<template>
  <!-- The mail workspace: external conversations and the classic mailbox views, side by side. -->
  <nav class="mail-tabs" :aria-label="t('navMail')">
    <RouterLink v-for="tab in tabs" :key="tab.name" :to="tab.to" class="mail-tab" :class="{ active: current === tab.name }"
      :aria-current="current === tab.name ? 'page' : undefined">
      {{ t(tab.label) }}<span v-if="tab.count" class="mail-tab-badge">{{ badge(tab.count, n) }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { hasPerm } from '@/perm/perm.js';
import { useSiteNav, badge } from '@/composables/use-site-nav';

const { t, n } = useI18n();
const route = useRoute();
const { unread } = useSiteNav();
// An open message belongs to the list it was opened from.
const current = computed(() => (route.name === 'content' ? (route.query.from === 'star' ? 'star' : 'email') : route.name));
const tabs = computed(() => [
  { name: 'external-mail', to: '/external-mail', label: 'mailChatExternalGroup', count: unread.value.mail },
  { name: 'email', to: '/inbox', label: 'inbox' },
  ...(hasPerm('email:send') ? [{ name: 'send', to: '/sent', label: 'sent' }, { name: 'draft', to: '/drafts', label: 'drafts' }] : []),
  { name: 'star', to: '/starred', label: 'starred' }
]);
</script>

<style scoped>
.mail-tabs { display:flex; gap:4px; flex-shrink:0; padding:8px 12px 0; overflow-x:auto; scrollbar-width:none; border-bottom:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); }
.mail-tabs::-webkit-scrollbar { display:none; }
.mail-tab { position:relative; display:inline-flex; align-items:center; gap:6px; padding:8px 12px 10px; white-space:nowrap; color:var(--el-text-color-secondary); text-decoration:none; font-size:13px; border-radius:8px 8px 0 0; }
.mail-tab:hover { color:var(--el-text-color-primary); background:var(--el-fill-color-light); }
.mail-tab.active { color:var(--el-color-primary); font-weight:600; }
.mail-tab.active::after { content:''; position:absolute; inset-inline:10px; bottom:0; height:3px; border-radius:3px 3px 0 0; background:currentColor; }
.mail-tab:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.mail-tab-badge { min-width:16px; height:16px; padding:0 5px; box-sizing:border-box; border-radius:8px; background:#ef4444; color:#fff; font-size:10px; line-height:16px; text-align:center; }
</style>
