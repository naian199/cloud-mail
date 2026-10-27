<template>
  <el-config-provider :locale="elementLocale"><router-view /><AppInstall /></el-config-provider>
</template>
<script setup>
import { watch } from 'vue';
import AppInstall from '@/components/app-install.vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSettingStore } from '@/store/setting';
import { elementLocale } from '@/i18n';
import('@/icons/index.js');
const route = useRoute(), { t, locale, te } = useI18n(), settings = useSettingStore();
watch([locale, () => route.meta.title], () => {
  const title = route.meta.title && te(route.meta.title) ? t(route.meta.title) : '';
  document.title = [title, settings.settings.title].filter(Boolean).join(' · ');
}, { immediate: true });
</script>
