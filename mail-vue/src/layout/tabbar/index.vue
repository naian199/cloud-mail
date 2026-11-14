<template>
  <!-- Phone root navigation. Hidden while a conversation or message is open and while the
       on-screen keyboard is up, so detail views and the composer get the whole screen. -->
  <nav class="site-tabbar" :aria-label="t('navigationMenu')">
    <RouterLink v-for="item in tabs" :key="item.id" :to="item.to" class="tab" :class="{ active: active === item.id }"
      :aria-current="active === item.id ? 'page' : undefined" :data-nav="item.id">
      <span class="tab-icon"><Icon :icon="item.icon" width="23" aria-hidden="true" />
        <span v-if="item.count" class="tab-badge" :aria-label="n(item.count) + ' ' + t('chatUnread')">{{ badge(item.count, n) }}</span>
        <span v-else-if="item.dot" class="tab-dot" aria-hidden="true"></span></span>
      <span class="tab-label">{{ t(item.label) }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useSiteNav, badge } from '@/composables/use-site-nav';

const { t, n } = useI18n();
const { section, unread } = useSiteNav();
// Mail lives under "Me" on phones; its unread messages show as a count there.
const active = computed(() => (section.value === 'mail' ? 'me' : section.value));
const tabs = computed(() => [
  { id: 'chat', to: '/mail-chat', icon: 'cloud-mail:chat', label: 'navChat', count: unread.value.chat },
  { id: 'store', to: '/apps', icon: 'cloud-mail:store', label: 'navStore', count: 0 },
  { id: 'files', to: '/files', icon: 'cloud-mail:folder', label: 'cloudFileTitle', count: 0 },
  { id: 'me', to: '/me', icon: 'cloud-mail:me', label: 'navMe', count: unread.value.mail }
]);
</script>

<style scoped>
.site-tabbar { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); flex-shrink:0; height:calc(58px + env(safe-area-inset-bottom));
  padding-bottom:env(safe-area-inset-bottom); box-sizing:border-box; background:color-mix(in srgb, var(--el-bg-color) 94%, transparent);
  backdrop-filter:blur(12px); border-top:1px solid var(--el-border-color-lighter); }
.tab { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-width:0; color:var(--el-text-color-secondary);
  text-decoration:none; font-size:11px; -webkit-tap-highlight-color:transparent; }
.tab.active { color:var(--el-color-primary); font-weight:600; }
.tab:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-4px; border-radius:10px; }
.tab-icon { position:relative; display:grid; place-items:center; }
.tab-label { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 2px; }
.tab-badge { position:absolute; top:-5px; inset-inline-start:15px; min-width:17px; height:17px; padding:0 5px; box-sizing:border-box; border-radius:9px;
  background:#ef4444; color:#fff; font-size:10px; line-height:17px; font-weight:600; text-align:center; }
.tab-dot { position:absolute; top:-1px; inset-inline-start:19px; width:8px; height:8px; border-radius:50%; background:#ef4444; }
</style>
