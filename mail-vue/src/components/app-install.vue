<template>
  <aside v-if="showCard" class="app-install-card" :aria-label="t('appInstallTitle')">
    <button class="install-dismiss" type="button" :aria-label="t('appInstallLater')" @click="dismiss">×</button>
    <span class="install-mark" aria-hidden="true"><Icon icon="cloud-mail:install" width="21" /></span>
    <strong>{{ t(platform === 'ios' || platform === 'android' ? 'appInstallMobileTitle' : 'appInstallTitle') }}</strong>
    <p>{{ t('appInstallDescription') }}</p>
    <button class="install-primary" type="button" :disabled="busy" @click="install">{{ t(canPrompt ? 'appInstallNow' : 'appInstallGuide') }}</button>
  </aside>
  <el-dialog v-model="guide" :title="t('appInstallTitle')" width="min(420px,92vw)" append-to-body>
    <p>{{ t('appInstallDescription') }}</p>
    <ol class="install-steps">
      <template v-if="platform === 'ios'"><li>{{ t('appInstallIosShare') }}</li><li>{{ t('appInstallIosAdd') }}</li></template>
      <template v-else-if="platform === 'android'"><li>{{ t('appInstallAndroid') }}</li></template>
      <template v-else-if="platform === 'macos'"><li>{{ t('appInstallMac') }}</li></template>
      <template v-else><li>{{ t('appInstallDesktop') }}</li></template>
    </ol>
    <p class="install-guide-note">{{ t(platform === 'ios' ? 'appInstallIosFallback' : 'appInstallAvailability') }}</p>
    <template #footer><el-button type="primary" @click="guide=false">{{ t('confirm') }}</el-button></template>
  </el-dialog>
</template>
<script setup>
import {useI18n} from 'vue-i18n';
import {Icon} from '@iconify/vue';
import {useAppInstall} from '@/composables/use-app-install';
const {t}=useI18n();
const {platform,guide,busy,install,dismiss,canPrompt,showCard}=useAppInstall();
</script>
<style scoped>
.app-install-card{position:fixed;inset-inline-start:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:1800;width:216px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:14px;border:1px solid var(--el-border-color-light);border-radius:12px;background:var(--el-bg-color-overlay);color:var(--el-text-color-primary);box-shadow:0 6px 24px #0002;text-align:start;}
.install-dismiss{position:absolute;inset-inline-end:6px;top:4px;border:0;background:none;color:var(--el-text-color-secondary);font-size:19px;cursor:pointer;width:28px;height:28px;}
.install-mark{display:grid;place-items:center;width:30px;height:30px;background:#10834e;color:white;border-radius:9px;margin-bottom:8px;}
.app-install-card strong{display:block;font-size:14px;padding-inline-end:12px;}.app-install-card p{font-size:12px;line-height:1.5;margin:6px 0 10px;color:var(--el-text-color-secondary);}
.install-primary{border:0;border-radius:7px;background:#10834e;color:white;font:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:32px;width:100%;padding:6px 12px;}.install-primary:disabled{opacity:.6;cursor:wait;}.install-primary:focus-visible,.install-dismiss:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px;}
.install-steps{padding-inline-start:24px;line-height:1.8;}.install-guide-note{font-size:12px;color:var(--el-text-color-secondary);}
@media(max-width:767px), (max-width:1024px) and (max-height:500px) and (pointer:coarse){.app-install-card{inset-inline-start:auto;inset-inline-end:12px;bottom:calc(84px + env(safe-area-inset-bottom));width:240px;}}
</style>
