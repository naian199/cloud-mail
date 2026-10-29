<template>
  <el-dialog :model-value="!!browsingUrl" :title="t('browserTitle')" fullscreen :show-close="false" :close-on-click-modal="false" destroy-on-close class="link-browser" @close="closeLinkBrowser">
    <template #header>
      <div class="browser-toolbar">
        <el-button text :aria-label="t('cancel')" @click="closeLinkBrowser">✕</el-button>
        <div class="browser-address"><strong>{{ hostname }}</strong><span :title="browsingUrl" translate="no">{{ t('browserOriginalLink') }} · {{ browsingUrl }}</span></div>
        <el-button text :disabled="!canEmbed" :aria-label="t('browserReload')" @click="reload">↻</el-button>
        <a :href="browsingUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="browser-external">{{ t('browserExternal') }} ↗</a>
      </div>
    </template>
    <div class="browser-notice">{{ t('browserNotice') }}</div>
    <div class="browser-stage">
      <div v-if="pending" class="browser-pending" role="status"><BrandLoading :size="48" />{{ t('browserLoading') }}</div>
      <div v-if="slow || !canEmbed" class="browser-fallback" role="status"><p>{{ t(canEmbed ? 'browserSlow' : 'browserHttp') }}</p><a :href="browsingUrl" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">{{ t('browserExternal') }} ↗</a></div>
      <iframe v-if="browsingUrl && canEmbed" :key="frameKey" :src="browsingUrl" :title="hostname" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'" @load="frameLoaded" @error="frameFailed"></iframe>
    </div>
  </el-dialog>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { browsingUrl, closeLinkBrowser } from '@/composables/use-link-browser';
const { t } = useI18n(), route = useRoute();
const frameKey = ref(0), pending = ref(false), slow = ref(false);
const hostname = computed(() => browsingUrl.value ? new URL(browsingUrl.value).hostname : '');
const canEmbed = computed(() => browsingUrl.value.startsWith('https:'));
let timeout;
function reload() {
  clearTimeout(timeout); frameKey.value++; slow.value = false; pending.value = !!browsingUrl.value && canEmbed.value;
  if (pending.value) timeout = setTimeout(() => {pending.value=false;slow.value=true;}, 10000);
}
// A cross-origin load event is not proof the site permitted embedding. Keep the external option visible.
function frameLoaded() { clearTimeout(timeout); pending.value = false; }
function frameFailed() { clearTimeout(timeout); pending.value = false; slow.value = true; }
watch(browsingUrl, reload);
watch(() => route.fullPath, closeLinkBrowser);
onBeforeUnmount(() => clearTimeout(timeout));
</script>
<style>
.link-browser.el-dialog {display:flex;flex-direction:column;padding:0;overflow:hidden;}
.link-browser .el-dialog__header {padding:8px 12px;margin:0;border-bottom:1px solid var(--el-border-color);}
.link-browser .el-dialog__body {display:flex;flex:1;min-height:0;flex-direction:column;padding:0;}
.browser-toolbar {display:flex;align-items:center;gap:8px;}
.browser-address {flex:1;min-width:0;display:grid;gap:2px;}
.browser-address strong {font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.browser-address span {font-size:11px;color:var(--el-text-color-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.browser-external {font-size:12px;white-space:nowrap;color:var(--el-color-primary);}
.browser-notice {padding:8px 14px;background:var(--el-fill-color-light);font-size:12px;color:var(--el-text-color-secondary);}
.browser-stage {flex:1;min-height:0;position:relative;display:flex;flex-direction:column;background:var(--el-bg-color);}
.browser-stage iframe {width:100%;flex:1;min-height:0;border:0;background:white;}
.browser-pending {position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:var(--el-bg-color);pointer-events:none;}
.browser-fallback {padding:16px;display:grid;gap:10px;font-size:13px;}
.browser-fallback a {color:var(--el-color-primary);}
@media(max-width:600px){.link-browser .el-dialog__header{padding:8px 4px;}.browser-toolbar{gap:4px;}.browser-external{font-size:11px;}.browser-notice{padding:8px;font-size:11px;}}
</style>
