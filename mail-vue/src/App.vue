<template>
  <el-config-provider :locale="elementLocale"><router-view /><AppInstall /><LinkBrowser /></el-config-provider>
</template>
<script setup>
import { useUserPresence } from '@/composables/use-user-presence';
import {tabUnread,useTabBadge} from '@/composables/use-tab-badge';
import {useFerdiumBadge} from '@/composables/use-ferdium-badge';
import { watch } from 'vue';
import AppInstall from '@/components/app-install.vue';
import LinkBrowser from '@/components/link-browser.vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingStore } from '@/store/setting';
import { elementLocale } from '@/i18n';
import('@/icons/index.js');
const route = useRoute(), { t, locale, te } = useI18n(), settings = useSettingStore();
useTabBadge();
useUserPresence();
useFerdiumBadge(tabUnread);
watch([locale, () => route.meta.title, () => settings.settings.title, tabUnread], () => {
  const title = route.meta.title && te(route.meta.title) ? t(route.meta.title) : '';
  const base=[title, settings.settings.title].filter(Boolean).join(' · ');
  document.title = (tabUnread.value ? `(${tabUnread.value>99?'99+':tabUnread.value}) ` : '') + base;
}, { immediate: true });
</script>
