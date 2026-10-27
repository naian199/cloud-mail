<template>
 <section class="push-settings"><h3>{{ t('pushTitle') }}</h3><p class="hint">{{ t('pushIntro') }}</p>
 <p v-if="needsInstall" class="hint">{{ t('pushIosInstall') }} <el-button text @click="install">{{ t('appInstallMobileTitle') }}</el-button></p>
 <el-button v-if="!needsInstall&&!pushActive" type="primary" :loading="pushBusy" @click="enable">{{ t('pushEnable') }}</el-button>
 <el-button v-else-if="pushActive" :loading="pushBusy" @click="disable">{{ t('pushDisableDevice') }}</el-button>
 <p v-if="pushActive" role="status">{{ t('pushDeviceEnabled') }}</p><p v-if="error" role="alert">{{ t(error) }}</p>
 <el-switch :disabled="saving" :model-value="pushSettings.enabled" :active-text="t('pushAll')" @change="value=>save({enabled:value})" />
 <label>{{ t('pushPreview') }}<el-select :disabled="saving" :model-value="pushSettings.preview" @change="value=>save({preview:value})"><el-option v-for="value in ['full','sender','none']" :key="value" :value="value" :label="t('pushPreview_'+value)" /></el-select></label>
 <div class="push-categories"><el-checkbox v-for="kind in ['private','external','group','channel']" :key="kind" :disabled="saving" :model-value="pushSettings[kind]" @change="value=>save({[kind]:value})">{{ t('pushKind_'+kind) }}</el-checkbox></div>
 <p class="hint">{{ t('pushLimits') }}</p></section>
</template>
<script setup>
import {computed,onMounted,ref} from 'vue';import {useI18n} from 'vue-i18n';
import {pushSettings,pushActive,pushBusy,loadPushSettings,savePushSettings,enablePush,disablePush} from '@/composables/use-push-notifications';
import {installPlatform,standaloneApp} from '@/utils/app-install.mjs';import {useAppInstall} from '@/composables/use-app-install';
const {t,locale}=useI18n(),{install}=useAppInstall(),error=ref(''),saving=ref(false);
const needsInstall=computed(()=>installPlatform(navigator)==='ios'&&!standaloneApp(window,navigator));
async function enable(){error.value='';try{await enablePush(locale.value);}catch(reason){error.value=['pushUnsupported','pushDenied','pushDeviceLimit'].includes(reason.message)?reason.message:'pushError';}}
async function disable(){if(pushBusy.value)return;pushBusy.value=true;try{await disablePush();}catch{error.value='pushError';}finally{pushBusy.value=false;}}
async function save(patch){if(saving.value)return;saving.value=true;try{await savePushSettings(patch);}catch{error.value='pushError';}finally{saving.value=false;}}
onMounted(()=>loadPushSettings().catch(()=>{error.value='pushError';}));
</script>
<style scoped>.push-settings{display:flex;flex-direction:column;align-items:flex-start;gap:10px;border-top:1px solid var(--el-border-color);margin-top:20px;padding-top:12px}.push-settings h3,.push-settings p{margin:0}.push-settings label{display:flex;align-items:center;gap:10px;max-width:100%}.push-categories{display:flex;flex-wrap:wrap;gap:6px}.hint{font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}[role=alert]{color:var(--el-color-danger)}</style>
