<template>
  <div ref="host" class="link-preview-shell">
    <a v-if="available" class="chat-link-preview" :href="url" @click="openLinkBrowser(url, $event)" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" :aria-label="data.title || hostname">
      <div class="link-copy"><small>{{ data.siteName || hostname }}<span v-if="data.siteName && data.siteName !== hostname" class="link-domain"> · {{ hostname }}</span></small><strong v-if="data.title && data.title !== hostname">{{ data.title }}</strong><span v-if="data.description" class="link-description">{{ data.description }}</span></div>
      <div v-if="image || (pending && data.hasImage)" class="link-cover"><img v-if="image" :src="image" alt="" @error="clearImage" @load="$emit('resize')" /><BrandLoading v-else :size="32" /></div>
    </a>
    <span v-else-if="pending" class="link-preview-pending" role="status"><BrandLoading :size="18" /><span>{{ t('browserPreviewLoading') }}</span></span>
    <button v-else class="link-preview-retry" type="button" :title="failureText" :aria-label="failureText" @click="retry">↻ <span>{{ t('browserRetryPreview') }}</span></button>
  </div>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { openLinkBrowser } from '@/composables/use-link-browser';
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { fetchLinkPreview, fetchLinkPreviewImage } from '@/request/mail-chat';
const emit=defineEmits(['resize']);
const props=defineProps({url:{type:String,required:true},source:{type:Object,required:true}});
const { t } = useI18n();
const host=ref(null),data=ref({}),image=ref(''),pending=ref(true);
const available=computed(()=>!!(data.value.previewAvailable||data.value.description||image.value||(data.value.title&&data.value.title!==hostname.value)));
const failureText=computed(()=>t(data.value.reason==='blocked'?'linkPreviewBlocked':data.value.reason==='timeout'?'linkPreviewTimedOut':'linkPreviewFailed'));
const parsed=computed(()=>new URL(props.url)),hostname=computed(()=>parsed.value.hostname),path=computed(()=>parsed.value.pathname+parsed.value.search);
let observer,controller,attempted=false,visible=false,disposed=false,generation=0;
function clearImage(){if(image.value)URL.revokeObjectURL(image.value);image.value='';}
async function load(){
  if(attempted||disposed)return;attempted=true;pending.value=true;controller=new AbortController();const signal=controller.signal,mine=generation,params={...props.source,url:props.url};
  try{
    const result=await fetchLinkPreview(params,signal);if(disposed||signal.aborted||mine!==generation)return;data.value=result;await nextTick();emit('resize');
    if(result.hasImage){const blob=await fetchLinkPreviewImage(params,signal);if(!disposed&&!signal.aborted&&mine===generation){image.value=URL.createObjectURL(blob);await nextTick();emit('resize');}}
  }catch(reason){if(signal.aborted&&mine===generation){attempted=false;if(visible&&!disposed)queueMicrotask(load);}/* Keep a usable domain card when a site disallows previews. */}
  finally{if(!disposed&&mine===generation){pending.value=false;await nextTick();emit('resize');}}
}
function retry(){attempted=false;load();}
watch([()=>props.url,()=>props.source.emailId,()=>props.source.roomId,()=>props.source.messageId],()=>{generation++;controller?.abort();clearImage();data.value={};pending.value=true;attempted=false;if(visible)load();});
onMounted(()=>{
  if(!('IntersectionObserver'in window)){visible=true;load();return;}
  observer=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible)load();else controller?.abort();},{rootMargin:'80px 0px'});if(host.value)observer.observe(host.value);
});
onBeforeUnmount(()=>{disposed=true;generation++;observer?.disconnect();controller?.abort();clearImage();});
</script>
<style scoped>
.link-preview-shell {max-width:360px;min-width:0;}
.chat-link-preview {display:flex;flex-direction:column;gap:0;width:100%;max-width:360px;margin-top:8px;border-inline-start:3px solid var(--chat-accent,var(--el-color-primary));border-radius:4px 10px 10px 4px;background:color-mix(in srgb,var(--el-text-color-primary) 5%,transparent);color:inherit;text-decoration:none;overflow:hidden;}
.link-copy {display:grid;gap:5px;padding:9px 11px;min-width:0;}
.link-copy small {font-size:11px;font-weight:600;color:var(--chat-accent,var(--el-color-primary));overflow-wrap:anywhere;}
.link-domain {font-weight:400;opacity:.75;}
.link-copy strong {font-size:14px;line-height:1.4;font-weight:600;-webkit-line-clamp:2;}
.link-description {font-size:12px;line-height:1.5;opacity:.9;-webkit-line-clamp:3;}
.link-copy strong,.link-description {display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;}
.link-cover {display:grid;place-items:center;min-height:110px;background:#0001;}
.link-cover img {display:block;width:100%;max-height:220px;object-fit:cover;}
.link-preview-pending {display:inline-flex;align-items:center;gap:6px;margin-top:5px;font-size:11px;opacity:.7;}
.link-preview-retry {display:inline-flex;gap:4px;align-items:center;border:0;background:none;color:inherit;opacity:.55;font:inherit;font-size:11px;padding:4px 0 0;cursor:pointer;}
.link-preview-retry:hover,.link-preview-retry:focus-visible {opacity:1;color:var(--chat-accent,var(--el-color-primary));}
.chat-link-preview:focus-visible,.link-preview-retry:focus-visible {outline:2px solid var(--el-color-primary);outline-offset:2px;}
@media(max-width:480px){.chat-link-preview{max-width:100%;}.link-cover img{max-height:200px;}}
</style>
