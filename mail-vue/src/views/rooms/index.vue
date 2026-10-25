<template>
  <section class="rooms" :class="{ 'has-active': active }">
    <aside class="room-list">
      <div class="room-tools"><strong>{{ t('roomTitle') }}</strong><el-button :aria-label="t('roomCreate')" @click="newOpen = true">＋</el-button></div>
      <div class="room-filters"><el-input v-model="search" clearable :placeholder="t('roomName')" /><el-select v-model="filter"><el-option :label="t('roomTitle')" value="all" /><el-option :label="t('roomGroup')" value="group" /><el-option :label="t('roomChannel')" value="channel" /></el-select></div>
      <div class="room-entries">
        <button v-for="room in filtered" :key="room.id" class="room-entry" :class="{ selected: activeId === room.id }" @click="choose(room.id)">
          <span class="room-symbol">{{ room.kind === 'channel' ? '#' : '☷' }}</span>
          <span class="room-summary"><strong>{{ room.name }}</strong><small>{{ room.status === 'invited' ? t('roomInvited') : room.preview || t(room.kind === 'channel' ? 'roomChannel' : 'roomGroup') }}</small></span>
          <span v-if="room.unread" class="room-unread">{{ room.unread > 99 ? '99+' : room.unread }}</span>
        </button>
        <el-empty v-if="!loading && !filtered.length" :description="t('roomEmpty')" :image-size="70" />
      </div>
    </aside>
    <main v-if="active" class="room-thread">
      <header class="room-heading">
        <el-button class="back" text :aria-label="t('chatBack')" @click="choose(null)"><Icon icon="cloud-mail:back" width="22" /></el-button>
        <div class="room-heading-name"><strong>{{ active.name }}</strong><small>{{ t(active.kind === 'channel' ? 'roomChannel' : 'roomGroup') }} · {{ t('roomTextOnly') }}</small></div>
        <el-popover v-model:visible="translationStatus.settingsOpen" trigger="click" :width="300"><template #reference><el-button text :aria-label="t('translateAuto')" :title="t(translationStatus.error || 'translateAuto')"><Icon icon="cloud-mail:translate" width="20" /></el-button></template><AutoTranslationSettings /></el-popover>
        <el-button v-if="active.status === 'joined'" text :aria-label="t('roomMembers')" @click="openMembers"><Icon icon="cloud-mail:group" width="22" /></el-button>
      </header>
      <div v-if="active.status === 'invited'" class="room-invitation"><p>{{ t('roomInvited') }}</p><p>{{ t('roomOwner') }} · {{ active.ownerName || active.ownerUsername || active.ownerId }}</p><el-button type="primary" :loading="acting" @click="respond(true)">{{ t('mailChatAccept') }}</el-button><el-button :disabled="acting" @click="respond(false)">{{ t('mailChatDecline') }}</el-button></div>
      <template v-else>
        <div ref="scroll" class="room-messages" @scroll="onScroll">
          <el-button v-if="hasOlder" text :loading="olderLoading" @click="older">{{ t('chatOlder') }}</el-button>
          <el-empty v-if="!messageLoading && !messages.length" :description="t('chatStartConversation')" :image-size="60" />
          <article v-for="message in messages" :key="message.id" class="room-message" :class="{ mine: message.senderId === userId }" :data-message-id="message.id">
            <UserAvatar :profile="senders[message.senderId]" :email="senders[message.senderId]?.username || ''" :size="30" />
            <div class="room-bubble"><small>{{ senderName(message.senderId) }}</small><p>{{ message.body }}</p><MessageTranslation :text="message.body" :incoming="message.senderId !== userId" chat-style :translate-remote="(target, signal) => translateRoomMessage(message.roomId, message.id, target, signal)" /><time>{{ time(message.createdAt) }}</time></div>
          </article>
        </div>
        <el-button v-if="!atBottom" class="room-newest" round @click="bottom">{{ t('chatNewest') }}</el-button>
        <form v-if="canPost" class="room-composer" @submit.prevent="send">
          <VoiceInput :context="active.id" :disabled="sending || messageLoading" @text="insertVoice" />
          <el-input v-model="drafts[active.id]" type="textarea" :autosize="{minRows:1,maxRows:4}" resize="none" maxlength="20000" :placeholder="t('mailChatCompactInput')" :aria-label="t('mailChatInput')" @keydown="composerKey" />
          <el-button type="primary" native-type="submit" :loading="sending" :disabled="!drafts[active.id]?.trim() || messageLoading" :aria-label="t('chatSend')"><Icon icon="cloud-mail:send" width="20" /></el-button>
        </form>
        <p v-else class="room-readonly">{{ t('roomChannelReadOnly') }}</p>
      </template>
    </main>
    <div v-else class="empty-room"><el-empty :description="t('roomEmpty')" /></div>
    <el-dialog v-model="newOpen" :title="t('roomCreate')" width="min(420px, 94vw)">
      <form class="room-form" @submit.prevent="create">
        <el-radio-group v-model="newRoom.kind"><el-radio-button value="group">{{ t('roomGroup') }}</el-radio-button><el-radio-button value="channel">{{ t('roomChannel') }}</el-radio-button></el-radio-group>
        <el-input v-model="newRoom.name" maxlength="80" :placeholder="t('roomName')" :aria-label="t('roomName')" />
        <p>{{ t('roomInviteHint') }}</p>
        <el-button type="primary" native-type="submit" :loading="creating" :disabled="!newRoom.name.trim()">{{ t('roomCreate') }}</el-button>
      </form>
    </el-dialog>
    <el-dialog v-model="membersOpen" :title="t('roomMembers')" width="min(460px, 94vw)">
      <template v-if="active?.status === 'joined'">
        <form v-if="canManage" class="room-form" @submit.prevent="rename"><el-input v-model="editName" maxlength="80" :aria-label="t('roomName')" /><el-button native-type="submit" :loading="acting">{{ t('save') }}</el-button></form>
        <form v-if="canManage" class="room-form room-invite-form" @submit.prevent="invite"><el-input v-model="inviteName" :aria-label="t('contactUsername')" placeholder="@username" maxlength="25" /><el-button native-type="submit" :loading="acting" :disabled="!inviteName.trim()">{{ t('roomInvite') }}</el-button></form>
        <p v-if="canManage">{{ t('roomInviteHint') }}</p>
        <div class="member-list"><div v-for="member in members" :key="member.userId" class="member-row"><UserAvatar :profile="member" :email="member.username || ''" :size="30" /><div class="member-name"><strong>{{ member.displayName || member.username || t('roomMember') + ' ' + member.userId }}</strong><small>{{ member.username ? '@' + member.username + ' · ' : '' }}{{ t(member.status === 'invited' ? 'roomInvited' : member.role === 'owner' ? 'roomOwner' : member.role === 'admin' ? 'roomAdmin' : 'roomMember') }}</small></div><el-button v-if="active.role === 'owner' && member.role !== 'owner' && member.status === 'joined'" text :disabled="acting" @click="role(member)">{{ t(member.role === 'admin' ? 'roomMember' : 'roomAdmin') }}</el-button><el-button v-if="member.role !== 'owner' && (active.role === 'owner' || active.role === 'admin' && member.role === 'member')" text type="danger" :disabled="acting" @click="kick(member)">{{ t('delete') }}</el-button></div></div>
        <el-button v-if="active.role !== 'owner'" type="danger" :loading="acting" @click="leave">{{ t('roomLeave') }}</el-button><el-button v-else type="danger" :loading="acting" @click="remove">{{ t('delete') }}</el-button>
      </template>
    </el-dialog>
  </section>
</template>
<script setup>
import { computed, reactive, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/store/user';
import { useUiStore } from '@/store/ui';
import { useMailSync } from '@/composables/use-mail-sync';
import { translationStatus } from '@/composables/use-auto-translation';
import { randomUUID } from '@/utils/uuid';
import UserAvatar from '@/components/user-avatar.vue';
import VoiceInput from '@/components/voice-input.vue';
import MessageTranslation from '@/components/message-translation.vue';
import AutoTranslationSettings from '@/components/auto-translation-settings.vue';
import { listRooms, createRoom, renameRoom, deleteRoom, roomMembers, inviteMember, setMemberRole, removeMember, respondRoom, leaveRoom, roomMessages, sendRoomMessage, readRoom, translateRoomMessage } from '@/request/rooms';

const { t }=useI18n(), route=useRoute(), router=useRouter(), ui=useUiStore();
const userId=useUserStore().user.userId;
const rooms=ref([]), activeId=ref(typeof route.query.room==='string'?route.query.room:null), messages=ref([]), senders=reactive({}), drafts=reactive({});
const active=computed(()=>rooms.value.find(room=>room.id===activeId.value));
const canManage=computed(()=>active.value?.status==='joined' && ['owner','admin'].includes(active.value.role));
const canPost=computed(()=>active.value?.status==='joined' && (active.value.kind==='group' || canManage.value));
const search=ref(''),filter=ref('all'), loading=ref(true), messageLoading=ref(false), hasOlder=ref(false), olderLoading=ref(false), sending=ref(false), atBottom=ref(true), scroll=ref(null);
const filtered=computed(()=>rooms.value.filter(room=>(filter.value==='all'||room.kind===filter.value)&&room.name.toLowerCase().includes(search.value.toLowerCase())));
const newOpen=ref(false), creating=ref(false), newRoom=reactive({kind:'group',name:''});
const membersOpen=ref(false), members=ref([]), editName=ref(''), inviteName=ref(''), acting=ref(false);
let stopped=false, version=0, busy=false, dirty=false;
const pending=new Map();
const readProgress=new Map();
watch(active,value=>{ui.mobileChatFocused=!!value;},{immediate:true});
function senderName(id) { return senders[id]?.displayName || senders[id]?.username || `${t('roomMember')} ${id}`; }
function time(value) { return new Date(value.replace(' ','T')+'Z').toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
async function choose(id) { if(stopped)return;const query={...route.query}; if(id)query.room=id;else delete query.room; await router.replace({query}); }
function reset() { version++; messages.value=[];members.value=[];Object.keys(senders).forEach(key=>delete senders[key]);hasOlder.value=false;atBottom.value=true;membersOpen.value=false;messageLoading.value=!!activeId.value; }
watch(()=>route.query.room,id=>{activeId.value=typeof id==='string'?id:null;reset();refresh();});
function merge(data) { Object.assign(senders,data.senders);const map=new Map(messages.value.map(message=>[message.id,message]));data.messages.forEach(message=>map.set(message.id,message));messages.value=[...map.values()].sort((a,b)=>a.id-b.id); }
async function bottom() { await nextTick();if(scroll.value){scroll.value.scrollTop=scroll.value.scrollHeight;atBottom.value=true;} }
async function markRead() { const id=active.value?.id,last=messages.value.at(-1)?.id;if(id && last && active.value.status==='joined' && atBottom.value && !document.hidden && (readProgress.get(id)||0)<last){readProgress.set(id,last);try{await readRoom(id,last);}catch(error){if(readProgress.get(id)===last)readProgress.delete(id);throw error;}} }
function onScroll() { const element=scroll.value;if(element)atBottom.value=element.scrollHeight-element.scrollTop-element.clientHeight<50;if(atBottom.value)markRead().catch(()=>{}); }
async function refresh() {
  if(stopped)return;
  if(busy){dirty=true;return;}
  busy=true;
  try {
    do {
      dirty=false;
      const id=activeId.value,mine=version,stick=atBottom.value;
      const list=await listRooms();if(stopped)return;rooms.value=list;
      if(id!==activeId.value||mine!==version){dirty=true;continue;}
      if(id&&!active.value){reset();await choose(null);continue;}
      if(active.value?.status==='joined') {
        let more;
        do {
          const after=messages.value.at(-1)?.id;
          const data=await roomMessages(id,after?{after}:{});
          if(stopped||mine!==version||id!==activeId.value)break;
          merge(data);if(!after)hasOlder.value=data.hasMore;more=!!after&&data.hasMore;
        } while(more);
        if(!stopped&&mine===version&&id===activeId.value) {
          if(stick)await bottom();await markRead();
          if(membersOpen.value)members.value=await roomMembers(id);
        }
      } else messages.value=[];
    } while(dirty&&!stopped);
  } catch { /* Existing API notifications explain failures; reconciliation retries. */ }
  finally {busy=false;loading.value=false;messageLoading.value=false;}
}
useMailSync(refresh);onMounted(refresh);
async function older() {
  if(olderLoading.value||!active.value||!messages.value.length)return;
  olderLoading.value=true;const id=activeId.value,mine=version,element=scroll.value,height=element.scrollHeight,top=element.scrollTop;
  try {const data=await roomMessages(id,{before:messages.value[0].id});if(mine!==version||stopped)return;merge(data);hasOlder.value=data.hasMore;await nextTick();element.scrollTop=top+element.scrollHeight-height;}catch{}finally{olderLoading.value=false;}
}
function composerKey(event){if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();send();}}
function insertVoice(text){const id=activeId.value;if(!canPost.value||!id)return;const value=(drafts[id]||'')+text;if(value.length<=20000)drafts[id]=value;}
async function send() {
  if(sending.value||!canPost.value)return;
  const id=activeId.value,original=drafts[id]||'',body=original.trim();if(!body)return;
  let request=pending.get(id);if(!request||request.body!==body){request={body,clientId:randomUUID()};pending.set(id,request);}
  sending.value=true;
  try {await sendRoomMessage(id,body,request.clientId);pending.delete(id);if(drafts[id]===original)drafts[id]='';if(activeId.value===id)atBottom.value=true;await refresh();}catch{}finally{sending.value=false;}
}
async function create(){if(creating.value)return;creating.value=true;try{const room=await createRoom({...newRoom});newOpen.value=false;newRoom.name='';await refresh();await choose(room.id);}catch{}finally{creating.value=false;}}
async function openMembers(){if(!active.value)return;editName.value=active.value.name;members.value=[];membersOpen.value=true;const id=activeId.value;try{const data=await roomMembers(id);if(id===activeId.value&&!stopped)members.value=data;}catch{}}
async function action(task){if(acting.value||!active.value)return;const id=activeId.value;acting.value=true;try{await task(id);await refresh();if(id===activeId.value&&active.value?.status==='joined'&&membersOpen.value)members.value=await roomMembers(id);}catch{}finally{acting.value=false;}}
function rename(){return action(id=>renameRoom(id,editName.value));}
function invite(){return action(async id=>{await inviteMember(id,inviteName.value);inviteName.value='';});}
function role(member){return action(id=>setMemberRole(id,member.userId,member.role==='admin'?'member':'admin'));}
async function kick(member){const selected=activeId.value;try{await ElMessageBox.confirm(t('roomRemoveConfirm'),t('delete'));if(selected===activeId.value&&!stopped)await action(id=>removeMember(id,member.userId));}catch{}}
function respond(accept){return action(id=>respondRoom(id,accept));}
async function leave(){const selected=activeId.value;try{await ElMessageBox.confirm(t('roomLeave'),active.value.name);if(selected===activeId.value&&!stopped)await action(id=>leaveRoom(id));}catch{}}
async function remove(){const selected=activeId.value;try{await ElMessageBox.confirm(t('roomDeleteConfirm'),active.value.name);if(selected===activeId.value&&!stopped)await action(id=>deleteRoom(id));}catch{}}
onBeforeUnmount(()=>{stopped=true;version++;ui.mobileChatFocused=false;translationStatus.settingsOpen=false;});
</script>
<style scoped>
.rooms{height:100%;min-height:0;min-width:0;display:grid;grid-template-columns:300px minmax(0,1fr);overflow:hidden;}
.room-list,.room-thread{min-height:0;min-width:0;display:flex;flex-direction:column;}
.room-list{border-inline-end:1px solid var(--el-border-color);background:var(--el-bg-color);}
.room-tools{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;gap:8px;}
.room-filters{display:grid;gap:6px;padding:0 12px 10px;}
.room-entries{flex:1;overflow:auto;min-height:0;}
.room-entry{display:flex;align-items:center;gap:10px;width:calc(100% - 12px);margin:3px 6px;padding:10px;border:0;border-radius:10px;background:transparent;color:var(--el-text-color-primary);text-align:start;cursor:pointer;}
.room-entry.selected{background:var(--el-color-primary-light-8);}
.room-symbol{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:var(--el-color-primary-light-9);color:var(--el-color-primary);font-size:23px;flex-shrink:0;}
.room-summary,.room-heading-name,.member-name{display:grid;gap:4px;min-width:0;flex:1;}
.room-summary strong,.room-summary small,.room-heading-name strong,.member-name strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.room-summary small,.room-heading-name small,.member-name small{color:var(--el-text-color-secondary);font-size:11px;}
.room-unread{border-radius:12px;background:var(--el-color-primary);color:white;padding:2px 6px;font-size:11px;}
.room-thread{position:relative;background:var(--el-fill-color-extra-light);}
.room-heading{display:flex;align-items:center;gap:6px;padding:6px 12px;min-height:52px;flex-shrink:0;border-bottom:1px solid var(--el-border-color);background:var(--el-bg-color);}
.room-messages{flex:1;min-height:0;overflow:auto;padding:12px clamp(10px,2vw,30px);overscroll-behavior:contain;}
.room-message{display:flex;align-items:flex-end;gap:8px;margin:10px 0;}
.room-message.mine{flex-direction:row-reverse;}
.room-bubble{max-width:min(85%,640px);padding:8px 11px;border-radius:12px;background:var(--el-bg-color-overlay);min-width:0;overflow-wrap:anywhere;}
.mine .room-bubble{background:var(--el-color-primary-light-9);}
.room-bubble>small,.room-bubble time{font-size:11px;color:var(--el-text-color-secondary);}
.room-bubble p{white-space:pre-wrap;margin:4px 0;}
.room-bubble time{display:block;text-align:end;}
.room-composer{display:grid;grid-template-columns:34px minmax(0,1fr) 42px;align-items:end;gap:6px;border-top:1px solid var(--el-border-color);padding:6px 10px max(6px,env(safe-area-inset-bottom));background:var(--el-bg-color);flex-shrink:0;}
.room-composer>.el-button:not(.voice-trigger){width:42px;height:40px;padding:0;margin:0;}
.room-composer :deep(textarea){padding:9px 12px;line-height:22px;border-radius:14px;}
.room-newest{position:absolute;bottom:72px;right:16px;}
.room-readonly{padding:12px;text-align:center;font-size:12px;background:var(--el-bg-color);margin:0;}
.room-invitation,.empty-room{padding:20px;text-align:center;}
.room-form{display:grid;gap:10px;margin-bottom:14px;}
.room-invite-form{grid-template-columns:minmax(0,1fr) auto;}
.member-list{max-height:45dvh;overflow:auto;margin:12px 0;}
.member-row{display:flex;align-items:center;gap:8px;padding:8px 0;}
.back{display:none;}
@media(max-width:767px){.rooms{grid-template-columns:minmax(0,1fr);}.has-active .room-list,.empty-room{display:none;}.back{display:inline-flex;}.room-composer :deep(textarea){font-size:16px;}.room-heading{padding-inline:6px;}.room-bubble{max-width:85%;}.member-row{flex-wrap:wrap;}}
</style>
