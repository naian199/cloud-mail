<template>
  <div ref="root" class="universal-search">
    <el-input ref="input" v-model="term" class="search" clearable maxlength="100" :placeholder="t('omniPlaceholder')" :aria-label="t('omniPlaceholder')" :aria-expanded="active" :aria-controls="active ? 'universal-search-results' : undefined" @focus="setActive(true)" @keydown.esc.stop.prevent="close" @keydown.enter.prevent="focusFirst">
      <template #prefix><button v-if="active" class="search-back" type="button" :aria-label="t('cancel')" @click.stop="close"><Icon icon="cloud-mail:back" width="20" /></button><Icon v-else icon="cloud-mail:search" width="18" /></template>
    </el-input>
    <section v-if="active" id="universal-search-results" class="omni-results" :aria-label="t('omniPlaceholder')" :aria-busy="loading">
      <p class="omni-scope">{{ t('omniScope', {email: mailbox?.email || ''}) }}</p>
      <el-select v-if="availableAccounts.length>1" popper-class="omni-account-options" :model-value="account" :aria-label="t('mailChatMailbox')" @change="changeAccount"><el-option v-for="item in availableAccounts" :key="item.accountId" :value="item.accountId" :label="item.email" /></el-select>
      <p v-if="!query" class="omni-hint">{{ t('omniHint') }}</p>
      <p v-if="loading" class="omni-loading brand-loading-status" role="status"><BrandLoading :size="24" />{{ t('omniLoading') }}</p>
      <p v-if="data.indexing" class="omni-hint" role="status">{{ t('mailChatIndexing') }}</p>
      <p v-if="error" class="omni-error" role="alert">{{ t('omniError') }} <button type="button" @click="load()">{{ t('omniRetry') }}</button></p>
      <template v-if="query">
        <h3 v-if="data.friends.length">{{ t('mailChatContacts') }}</h3>
        <button v-for="person in data.friends" :key="'friend:'+person.id" class="omni-row" type="button" @click="person.status==='accepted'?openFriend(person):action('contacts')">
          <UserAvatar :profile="person" :email="person.email" :size="32" /><span><strong>{{ person.remark || person.displayName || person.username || person.email }}</strong><small>{{ person.status==='accepted' ? person.email : t('mailChatPending') }}</small></span>
        </button>
        <h3 v-if="data.users.length">{{ t('omniUsers') }}</h3>
        <div v-for="person in data.users" :key="person.username" class="omni-person"><UserAvatar :profile="person" :email="person.username" :size="32" /><span><strong>{{ person.displayName || person.username }}</strong><small>@{{ person.username }}</small></span><el-button text :disabled="!!adding || person.requested" @click="add(person)">{{ t(person.requested?'mailChatPending':'mailChatAddFriend') }}</el-button></div>
        <h3 v-if="data.conversations.length">{{ t('mailChatTitle') }}</h3>
        <button v-for="item in data.conversations" :key="item.key" class="omni-row" type="button" @click="openMail(item)"><UserAvatar :profile="item.profile" :email="item.peers[0]" :size="32" /><span><strong>{{ item.profile?.remark || item.profile?.displayName || item.peers.join(', ') }}</strong><small>{{ item.ourSubject || item.subject }}</small></span></button>
        <button v-if="data.moreConversations" type="button" class="omni-more" :disabled="loading || data.indexing" @click="load('conversations')">{{ t('omniMore') }}</button>
        <h3 v-if="data.rooms.length">{{ t('roomTitle') }}</h3>
        <button v-for="item in data.rooms" :key="item.id" type="button" class="omni-row" @click="openRoom(item)"><Icon :icon="item.kind==='channel'?'cloud-mail:external-mail':'cloud-mail:group'" width="28" /><span><strong>{{ item.name }}</strong><small>{{ t(item.status==='invited'?'roomInvited':item.kind==='channel'?'roomChannel':'roomGroup') }}</small></span></button>
        <h3 v-if="data.messages.length">{{ t('chatMessages') }}</h3>
        <button v-for="item in data.messages" :key="item.emailId" class="omni-row omni-message" type="button" @click="openMail(item,item.emailId)"><span><strong>{{ item.profile?.remark || item.profile?.displayName || item.peers.join(', ') }}</strong><small>{{ item.subject }}</small><p>{{ item.text }}</p><small v-if="item.files">{{ t('exploreFiles') }} · {{ item.files }}</small></span></button>
        <button v-if="data.moreMail" type="button" class="omni-more" :disabled="loading || data.indexing" @click="load('mail')">{{ t('omniMore') }}</button>
        <h3 v-if="data.roomMessages.length">{{ t('roomTitle') }} · {{ t('chatMessages') }}</h3>
        <button v-for="item in data.roomMessages" :key="item.id" class="omni-row omni-message" type="button" @click="openRoom(item,item.id)"><span><strong>{{ item.name }}</strong><p>{{ item.text }}</p></span></button>
        <button v-if="data.moreRoom" type="button" class="omni-more" :disabled="loading || data.indexing" @click="load('room')">{{ t('omniMore') }}</button>
        <p v-if="!loading && !error && !resultCount && !actions.length && !isEmail" class="omni-hint" role="status">{{ t('omniNoResults') }}</p>
      </template>
      <h3 v-if="actions.length || isEmail">{{ t('omniActions') }}</h3>
      <button v-if="isEmail" type="button" class="omni-row" @click="action('mail',query)"><Icon icon="cloud-mail:chat" width="24" /><span><strong>{{ t('mailChatOpenChat') }}</strong><small>{{ query }}</small></span></button>
      <button v-for="item in actions" :key="item.id" type="button" class="omni-row" @click="action(item.id)"><Icon :icon="item.icon" width="24" /><span>{{ t(item.label) }}</span></button>
    </section>
  </div>
</template>
<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useAccountStore } from '@/store/account';
import { useUserStore } from '@/store/user';
import { universalSearch, mailOpen } from '@/request/mail-chat';
import { requestFriendByUsername } from '@/request/chat';
import UserAvatar from './user-avatar.vue';
const props=defineProps({accountId:Number,accounts:{type:Array,default:()=>[]}});
const emit=defineEmits(['active','action','account']);
const {t}=useI18n(), router=useRouter(), route=useRoute(), accountStore=useAccountStore(), user=useUserStore();
const root=ref(null),input=ref(null),term=ref(''),active=ref(false),loading=ref(false),error=ref(false),adding=ref('');
const account=computed(()=>props.accountId || accountStore.currentAccountId || user.user.account.accountId);
const availableAccounts=computed(()=>props.accounts.length?props.accounts:[accountStore.currentAccount || user.user.account]);
const mailbox=computed(()=>availableAccounts.value.find(item=>item.accountId===account.value));
const query=computed(()=>term.value.trim());
const empty=()=>({friends:[],users:[],rooms:[],conversations:[],messages:[],roomMessages:[]});
const data=ref(empty());
const resultCount=computed(()=>['friends','users','rooms','conversations','messages','roomMessages'].reduce((count,key)=>count+data.value[key].length,0));
const isEmail=computed(()=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.value));
const commands=[{id:'mail',label:'mailChatNew',icon:'cloud-mail:chat'},{id:'contacts',label:'mailChatContacts',icon:'cloud-mail:group'},{id:'create',label:'roomCreate',icon:'cloud-mail:group'},{id:'profile',label:'settings',icon:'cloud-mail:settings'}];
const actions=computed(()=>commands.filter(item=>!query.value||t(item.label).toLocaleLowerCase().includes(query.value.toLocaleLowerCase())));
let timer,indexTimer,controller,sequence=0,disposed=false;
function setActive(value){active.value=value;emit('active',value);}
function close(){setActive(false);term.value='';input.value?.blur();}
function outside(event){if(active.value&&!root.value?.contains(event.target)&&!event.target.closest?.('.omni-account-options'))close();}
function focusFirst(){nextTick(()=>root.value?.querySelector('.omni-results button:not(:disabled)')?.focus());}
function changeAccount(value){accountStore.currentAccountId=value;accountStore.currentAccount=availableAccounts.value.find(item=>item.accountId===value);emit('account',value);}
async function load(section='all') {
  if(!query.value||!active.value||disposed)return;
  clearTimeout(indexTimer);controller?.abort();controller=new AbortController();const mine=++sequence,q=query.value,a=account.value;
  loading.value=true;error.value=false;
  try {
    const result=await universalSearch({accountId:a,search:q,section,...(section==='mail'?{beforeMail:data.value.beforeMail}:section==='room'?{beforeRoom:data.value.beforeRoom}:section==='conversations'?{beforeConversation:data.value.beforeConversation}:{})},controller.signal);
    if(disposed||mine!==sequence||q!==query.value||a!==account.value||!active.value)return;
    if(section==='all'){data.value=result;if(result.indexing)indexTimer=setTimeout(()=>load(),1200);}
    else {
      const fields=section==='mail'?['messages','moreMail','beforeMail']:section==='room'?['roomMessages','moreRoom','beforeRoom']:['conversations','moreConversations','beforeConversation'];
      const key=section==='mail'?'emailId':section==='room'?'id':'key';
      data.value[fields[0]]=[...new Map([...data.value[fields[0]],...result[fields[0]]].map(item=>[item[key],item])).values()];
      data.value[fields[1]]=result[fields[1]];data.value[fields[2]]=result[fields[2]];
    }
  } catch(reason){if(!disposed&&mine===sequence&&reason.name!=='CanceledError'&&reason.name!=='AbortError')error.value=true;}
  finally{if(mine===sequence)loading.value=false;}
}
watch([query,account,active],()=>{clearTimeout(timer);clearTimeout(indexTimer);controller?.abort();sequence++;loading.value=false;error.value=false;data.value=empty();if(active.value&&query.value){loading.value=true;timer=setTimeout(()=>load(),300);}});
async function openMail(item,message){const a=account.value;close();await router.push({path:item.category==='external'?'/external-mail':'/mail-chat',query:{accountId:a,conversation:item.key,...(message?{message}: {})}});}
async function openFriend(person){try{const a=account.value,item=await mailOpen({accountId:a,email:person.email});if(!disposed&&a===account.value)openMail({...item,category:'internal'});}catch{}}
function openRoom(item,message){close();router.push({path:'/rooms',query:{kind:item.kind,room:item.roomId||item.id,...(message?{message}:{})}});}
async function add(person){if(adding.value)return;adding.value=person.username;try{await requestFriendByUsername(person.username);person.requested=true;}catch{}finally{adding.value='';}}
function action(id,email='') {
  close();
  if(id==='profile')router.push('/settings');
  else if(id==='create')router.push({path:'/rooms',query:{kind:route.query.kind==='channel'?'channel':'group',create:'1'}});
  else if(['mail-chat','external-mail'].includes(route.name))emit('action',{id,email});
  else router.push({path:'/mail-chat',query:id==='contacts'?{contacts:'1'}:{compose:'1',...(email?{to:email}:{})}});
}
defineExpose({close});
onMounted(()=>document.addEventListener('pointerdown',outside,true));
onBeforeUnmount(()=>{disposed=true;sequence++;clearTimeout(timer);clearTimeout(indexTimer);controller?.abort();document.removeEventListener('pointerdown',outside,true);});
</script>
<style scoped>
.universal-search>.search { margin:0 12px 10px 52px; width:calc(100% - 64px); }
.search-back { display:grid; place-items:center; border:0; width:24px; height:28px; padding:0; background:none; color:var(--el-text-color-regular); cursor:pointer; }
.omni-results { position:absolute; inset:52px 0 0; z-index:25; overflow:auto; background:var(--el-bg-color); padding:4px 8px 12px; overscroll-behavior:contain; }
.omni-scope,.omni-hint,.omni-loading,.omni-error { margin:8px 6px; font-size:12px; color:var(--el-text-color-secondary); overflow-wrap:anywhere; }.omni-error{color:var(--el-color-danger);}
h3 { font-size:12px; color:var(--el-color-primary); font-weight:500; margin:16px 8px 5px; }
.omni-row { display:flex; gap:10px; align-items:center; width:100%; padding:10px 8px; border:0; border-radius:8px; background:transparent; color:var(--el-text-color-primary); text-align:start; font:inherit; cursor:pointer; }
.omni-row:hover,.omni-row:focus-visible { background:var(--el-fill-color-light); }.omni-row:focus-visible,.search-back:focus-visible { outline:2px solid var(--el-color-primary);outline-offset:-2px; }
.omni-row>span,.omni-person>span { flex:1;min-width:0;display:grid;gap:3px; }.omni-row strong,.omni-person strong { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
small { font-size:11px; color:var(--el-text-color-secondary); overflow-wrap:anywhere; }.omni-message p { margin:2px 0; font-size:12px; white-space:pre-wrap; overflow-wrap:anywhere; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.omni-row>svg { flex-shrink:0; }.omni-person { display:flex;align-items:center;gap:8px;padding:8px; }.omni-person :deep(.el-button) { padding:4px; max-width:90px; height:auto; white-space:normal; font-size:11px; }
.omni-more,.omni-error button { border:0; background:transparent; color:var(--el-color-primary); padding:8px; cursor:pointer; font:inherit; font-size:12px; }
</style>
