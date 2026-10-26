<template>
  <el-dropdown trigger="click" :disabled="disabled" @command="command">
    <el-button class="voice-trigger" text :type="dictating ? 'danger' : 'default'" :aria-pressed="dictating" :disabled="disabled" :aria-label="t('voiceTools')" :title="t('voiceTools')"><Icon :icon="dictating ? 'cloud-mail:stop' : 'cloud-mail:microphone'" width="20" /></el-button>
    <template #dropdown><el-dropdown-menu><el-dropdown-item command="text">{{ t(dictating ? 'voiceStop' : 'voiceInput') }}</el-dropdown-item><el-dropdown-item command="record">{{ t('voiceMessage') }}</el-dropdown-item></el-dropdown-menu></template>
  </el-dropdown>
  <VoiceInput ref="dictation" hidden-trigger :context="context" :disabled="disabled" @text="emit('text',$event)" @listening="dictating=$event" />
  <el-dialog v-model="open" :title="t('voiceMessage')" width="min(420px,92vw)" append-to-body @closed="discard" :close-on-click-modal="false">
    <p v-if="recording" role="status">{{ t('voiceRecording') }} · {{ seconds }} / 120 s</p>
    <p v-else-if="!url && !error">{{ t('voiceStarting') }}</p>
    <audio v-if="url" :src="url" controls preload="metadata" style="width:100%" />
    <p class="voice-hint">{{ t('voiceRecordingHint') }}</p>
    <p v-if="cloudMode">{{ t('voiceCloudPrivacy') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template #footer>
      <el-button @click="close">{{ t('cancel') }}</el-button>
      <el-button v-if="recording" @click="stop">{{ t('voiceRecordStop') }}</el-button>
      <el-button v-else-if="url" @click="begin">{{ t('voiceAgain') }}</el-button>
      <el-button v-if="url" type="primary" :loading="busy" @click="confirm">{{ t(cloudMode ? 'voiceToText' : 'voiceAttach') }}</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import {ref,watch,onBeforeUnmount} from 'vue';
import {useI18n} from 'vue-i18n';
import {Icon} from '@iconify/vue';
import {ElMessage} from 'element-plus';
import VoiceInput from './voice-input.vue';
import {transcribeVoice} from '@/request/voice';
import {randomUUID} from '@/utils/uuid';
const props=defineProps({context:[String,Number],disabled:Boolean});
const emit=defineEmits(['text','attachment']);
const {t}=useI18n();
const dictating=ref(false);
const dictation=ref(),open=ref(false),recording=ref(false),seconds=ref(0),url=ref(''),error=ref(''),busy=ref(false),cloudMode=ref(false);
let stream,recorder,timer,blob,generation=0,controller;
function release(){clearInterval(timer);stream?.getTracks().forEach(track=>track.stop());stream=null;}
function discard(){generation++;controller?.abort();controller=null;const old=recorder;recorder=null;old?.state==='recording'&&old.stop();release();recording.value=false;busy.value=false;blob=null;if(url.value)URL.revokeObjectURL(url.value);url.value='';}
function close(){discard();open.value=false;}
function stop(){if(recorder?.state==='recording')recorder.stop();release();recording.value=false;}
async function begin(){
  discard();error.value='';seconds.value=0;const mine=generation;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){error.value=t('voiceRecordUnavailable');return;}
  try{
    const input=await navigator.mediaDevices.getUserMedia({audio:true});
    if(mine!==generation||!open.value||props.disabled){input.getTracks().forEach(track=>track.stop());return;}
    stream=input;
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
    if(!mime)throw Error('format');
    const session=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:64000}),chunks=[];let bytes=0;
    recorder=session;
    session.ondataavailable=event=>{if(mine!==generation)return;if(event.data.size){bytes+=event.data.size;if(bytes>5*1024*1024){ElMessage.error(t('voiceAudioLimit'));close();return;}chunks.push(event.data);}};
    session.onerror=()=>{if(mine===generation){error.value=t('voiceError');stop();}};
    session.onstop=()=>{if(mine!==generation)return;release();recording.value=false;blob=new Blob(chunks,{type:mime});if(blob.size){url.value=URL.createObjectURL(blob);}else error.value=t('voiceError');};
    session.start(250);recording.value=true;
    timer=setInterval(()=>{seconds.value++;if(seconds.value>=120)stop();},1000);
  }catch(err){if(mine!==generation)return;release();error.value=t(err.name==='NotAllowedError'?'voiceDenied':'voiceRecordUnavailable');}
}
function command(mode){
  if(props.disabled)return;
  if(mode==='text'&&(window.SpeechRecognition||window.webkitSpeechRecognition)){dictation.value.toggle();return;}
  dictation.value?.cancel();cloudMode.value=mode==='text';open.value=true;begin();
}
async function confirm(){
  if(!blob||busy.value||props.disabled)return;
  const mime=blob.type.split(';')[0],ext=mime==='audio/mp4'?'m4a':mime==='audio/ogg'?'ogg':'webm';
  const file=new File([blob],`voice-${randomUUID()}.${ext}`,{type:mime});
  if(!cloudMode.value){emit('attachment',file);close();return;}
  const mine=generation;busy.value=true;controller=new AbortController();
  try{const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});const result=await transcribeVoice({audio:{content,contentType:mime,filename:file.name}},controller.signal);if(mine===generation){emit('text',result.text);close();}}
  catch(err){if(mine===generation&&err.name!=='AbortError')error.value=t(err.message==='voiceQuota'?'voiceQuota':'voiceTranscribeError');}
  finally{if(mine===generation)busy.value=false;}
}
watch([()=>props.context,()=>props.disabled],close);
function visibility(){if(document.hidden)close();}
document.addEventListener('visibilitychange',visibility);
onBeforeUnmount(()=>{discard();document.removeEventListener('visibilitychange',visibility);});
</script>
<style scoped>.voice-trigger{margin:0;width:34px;height:40px;padding:0}.voice-hint{font-size:12px;color:var(--el-text-color-secondary)}</style>
