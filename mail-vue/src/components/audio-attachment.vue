<template>
  <div class="voice-card">
    <audio ref="player" v-if="url" :src="url" controls preload="metadata" :aria-label="file.filename" />
    <el-button v-else :loading="loading" @click="play">{{ t('voicePlay') }}</el-button>
    <div class="voice-actions"><span :title="file.filename">{{ t('voiceMessage') }}</span><el-button text size="small" @click="download">{{ t('voiceDownload') }}</el-button><el-button text size="small" :loading="busy" @click="requestText">{{ t('voiceToText') }}</el-button></div>
    <p v-if="text" class="transcript" dir="auto">{{ text }}</p><p v-if="error" role="alert">{{ error }}</p>
    <el-dialog v-model="consentOpen" :title="t('voiceToText')" width="min(420px,92vw)" append-to-body><p>{{ t('voiceCloudPrivacy') }}</p><template #footer><el-button @click="consentOpen=false">{{ t('cancel') }}</el-button><el-button type="primary" @click="accept">{{ t('voiceToText') }}</el-button></template></el-dialog>
  </div>
</template>
<script setup>
import {ref,onBeforeUnmount,watch,nextTick} from 'vue';
import {useI18n} from 'vue-i18n';
import {audioMime} from '@/utils/video-files.mjs';
import {transcribeVoice} from '@/request/voice';
const props=defineProps({file:{type:Object,required:true},load:{type:Function,required:true},source:{type:Object,required:true}});
const player=ref();
const emit=defineEmits(['resize']);
const {t}=useI18n(),url=ref(''),loading=ref(false),busy=ref(false),text=ref(''),error=ref(''),consentOpen=ref(false);
let controller=new AbortController(),generation=0;
async function load(){if(url.value)return url.value;const mine=generation;const blob=await props.load({signal:controller.signal});if(mine!==generation)throw Error('stale');url.value=URL.createObjectURL(new Blob([blob],{type:audioMime(props.file)||blob.type}));return url.value;}
async function play(){if(loading.value)return;loading.value=true;try{await load();await nextTick();await player.value?.play();}catch{error.value=t('voiceError');}finally{loading.value=false;}}
async function download(){try{const href=await load();const a=document.createElement('a');a.href=href;a.download=props.file.filename;a.click();}catch{error.value=t('voiceError');}}
function requestText(){if(busy.value||text.value)return;let accepted=false;try{accepted=localStorage.getItem('cloud-mail:voice-cloud-consent')==='yes';}catch{}if(!accepted){consentOpen.value=true;return;}transcribe();}
function accept(){consentOpen.value=false;try{localStorage.setItem('cloud-mail:voice-cloud-consent','yes');}catch{}transcribe();}
async function transcribe(){const mine=generation;busy.value=true;error.value='';try{const result=await transcribeVoice(props.source,controller.signal);if(mine===generation)text.value=result.text;}catch(err){if(mine===generation)error.value=t(err.message==='voiceQuota'?'voiceQuota':'voiceTranscribeError');}finally{if(mine===generation)busy.value=false;}}
watch([text,url,error],async()=>{await nextTick();emit('resize');});
function reset(){generation++;controller.abort();controller=new AbortController();if(url.value)URL.revokeObjectURL(url.value);url.value='';text.value='';error.value='';busy.value=false;loading.value=false;consentOpen.value=false;}
watch(()=>JSON.stringify(props.source),reset);onBeforeUnmount(reset);
</script>
<style scoped>.voice-card{width:280px;max-width:100%;padding:4px}.voice-card>.el-button{height:40px}.voice-card audio{width:100%;height:40px;display:block}.voice-actions{display:flex;align-items:center;gap:6px}.voice-actions>span{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px}.voice-actions :deep(.el-button){margin:0;padding:3px}.transcript{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;margin:8px 0}.voice-card [role=alert]{font-size:12px;color:var(--el-color-danger)}</style>
