<template>
  <a ref="host" class="chat-link-preview" :href="url" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" :aria-label="data.title || hostname">
    <div class="link-copy"><small>{{ hostname }}</small><strong v-if="data.title && data.title !== hostname">{{ data.title }}</strong><span v-if="data.description">{{ data.description }}</span><span v-else>{{ path }}</span></div>
    <img v-if="image" :src="image" alt="" @error="clearImage" />
  </a>
</template>
<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { fetchLinkPreview, fetchLinkPreviewImage } from '@/request/mail-chat';
const emit=defineEmits(['resize']);
const props=defineProps({url:{type:String,required:true},source:{type:Object,required:true}});
const host=ref(null),data=ref({}),image=ref('');
const parsed=computed(()=>new URL(props.url)),hostname=computed(()=>parsed.value.hostname),path=computed(()=>parsed.value.pathname+parsed.value.search);
let observer,controller,attempted=false,visible=false,disposed=false,generation=0;
function clearImage(){if(image.value)URL.revokeObjectURL(image.value);image.value='';}
async function load(){
  if(attempted||disposed)return;attempted=true;controller=new AbortController();const signal=controller.signal,mine=generation,params={...props.source,url:props.url};
  try{
    const result=await fetchLinkPreview(params,signal);if(disposed||signal.aborted||mine!==generation)return;data.value=result;await nextTick();emit('resize');
    if(result.hasImage){const blob=await fetchLinkPreviewImage(params,signal);if(!disposed&&!signal.aborted&&mine===generation){image.value=URL.createObjectURL(blob);await nextTick();emit('resize');}}
  }catch(reason){if(signal.aborted&&mine===generation){attempted=false;if(visible&&!disposed)queueMicrotask(load);}/* Keep a usable domain card when a site disallows previews. */}
}
watch([()=>props.url,()=>props.source.emailId,()=>props.source.roomId,()=>props.source.messageId],()=>{generation++;controller?.abort();clearImage();data.value={};attempted=false;if(visible)load();});
onMounted(()=>{
  if(!('IntersectionObserver'in window)){visible=true;load();return;}
  observer=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible)load();else controller?.abort();},{rootMargin:'80px 0px'});if(host.value)observer.observe(host.value);
});
onBeforeUnmount(()=>{disposed=true;generation++;observer?.disconnect();controller?.abort();clearImage();});
</script>
<style scoped>
.chat-link-preview { display:flex; align-items:start; gap:10px; max-width:340px; margin-top:8px; padding:8px 9px; border-inline-start:3px solid var(--chat-accent,var(--el-color-primary)); border-radius:4px 9px 9px 4px; background:color-mix(in srgb,var(--el-text-color-primary) 5%,transparent); color:inherit; text-decoration:none; }
.link-copy { display:grid; gap:3px; min-width:0; flex:1; }.link-copy small { overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--chat-accent,var(--el-color-primary)); font-size:11px; }.link-copy strong { font-size:13px;font-weight:600; }
.link-copy span { font-size:12px;opacity:.85; }.link-copy strong,.link-copy span { display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere; }.link-copy strong { -webkit-line-clamp:2; }
img { display:block;flex-shrink:0;width:64px;height:64px;object-fit:cover;border-radius:6px; }.chat-link-preview:focus-visible { outline:2px solid var(--el-color-primary);outline-offset:2px; }
</style>
