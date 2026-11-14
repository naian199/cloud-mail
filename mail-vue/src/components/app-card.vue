<template>
  <!-- A shared app link. The server reveals nothing about apps the viewer cannot see. -->
  <RouterLink v-if="card?.available" class="app-card" :to="`/apps/${appId}`" :data-app-card="appId">
    <span class="app-card-icon" aria-hidden="true">{{ initial }}</span>
    <span class="app-card-copy">
      <small>{{ t('navStore') }}<template v-if="card.publisherName"> · {{ card.publisherName }}</template></small>
      <strong>{{ card.name }}</strong>
      <span v-if="card.summary" class="app-card-summary">{{ card.summary }}</span>
      <span v-if="card.downloadable" class="app-card-meta"><span v-for="p in card.platforms" :key="p" class="app-chip">{{ t('appPlatform_' + p) }}</span><span v-if="card.latestVersion">v{{ card.latestVersion }}</span></span>
      <span v-else class="app-card-meta">{{ t('appNoVersions') }}</span>
    </span>
  </RouterLink>
  <div v-else-if="card" class="app-card app-card-off" :data-app-card="appId" role="note">
    <span class="app-card-icon" aria-hidden="true">?</span>
    <span class="app-card-copy"><small>{{ t('navStore') }}</small><strong>{{ t('appUnavailable') }}</strong></span>
  </div>
  <div v-else class="app-card app-card-loading" aria-busy="true"><span class="app-card-icon"></span><span class="app-card-copy"><small>{{ t('navStore') }}</small></span></div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { appCard } from '@/request/apps';

const props = defineProps({ appId: { type: Number, required: true } });
const emit = defineEmits(['resize']);
const { t } = useI18n();
const card = ref(null);
const initial = computed(() => Array.from(card.value?.name || '?')[0]?.toUpperCase());
watch(() => props.appId, async (id) => {
  card.value = null;
  try { card.value = await appCard(id); } catch { card.value = { available: false }; }
  emit('resize');
}, { immediate: true });
</script>

<style scoped>
.app-card { display:flex; gap:12px; align-items:flex-start; max-width:340px; margin-top:6px; padding:12px; box-sizing:border-box; border-radius:14px; border:1px solid var(--el-border-color-lighter);
  background:var(--el-bg-color); color:var(--el-text-color-primary); text-decoration:none; }
a.app-card:hover { border-color:var(--el-color-primary-light-5); }
.app-card-icon { display:grid; place-items:center; flex-shrink:0; width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#8b5cf6); color:#fff; font-weight:700; font-size:20px; }
.app-card-off .app-card-icon, .app-card-loading .app-card-icon { background:var(--el-fill-color); color:var(--el-text-color-placeholder); }
.app-card-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
.app-card-copy small { color:var(--el-text-color-secondary); font-size:11px; }
.app-card-copy strong { font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.app-card-summary { font-size:12px; color:var(--el-text-color-regular); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.app-card-meta { display:flex; flex-wrap:wrap; gap:4px; align-items:center; font-size:11px; color:var(--el-text-color-secondary); }
.app-chip { padding:1px 7px; border-radius:9px; background:var(--el-fill-color-light); }
</style>
