<template>
  <nav class="conversation-categories" :aria-label="t('navigationMenu')">
    <RouterLink v-for="item in categories" :key="item.id" :to="active === item.id ? route.fullPath : item.to" :class="{ 'category-active': active === item.id }" :aria-current="active === item.id ? 'page' : undefined" :aria-label="label(item)" :title="label(item)"><span class="category-label">{{ t(item.label) }}</span><span v-if="counts[item.id]" class="category-badge" aria-hidden="true">{{ counts[item.id]>99?n(99)+'+':n(counts[item.id]) }}</span></RouterLink>
  </nav>
</template>
<script setup>
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {useAccountStore} from '@/store/account';
import {categoryUnread} from '@/composables/use-category-unread';
const props = defineProps({ kind: { type: String, default: 'group' },accountId:{type:Number,default:0} });
const route = useRoute(), { t,n } = useI18n(),accounts=useAccountStore();
const counts=computed(()=>({...categoryUnread.value.categories,chat:0,external:0,...categoryUnread.value.accounts[props.accountId||accounts.currentAccountId]}));
const label=item=>t(item.label)+(counts.value[item.id]?` · ${n(counts.value[item.id])} ${t('chatUnread')}`:'');
const categories = [
  { id: 'chat', label: 'mailChatInternalGroup', to: '/mail-chat' },
  { id: 'external', label: 'mailChatExternalGroup', to: '/external-mail' },
  { id: 'group', label: 'roomGroup', to: { path: '/rooms', query: { kind: 'group' } } },
  { id: 'channel', label: 'roomChannel', to: { path: '/rooms', query: { kind: 'channel' } } }
];
const active = computed(() => route.name === 'rooms' ? props.kind : route.name === 'external-mail' ? 'external' : 'chat');
</script>
<style scoped>
.conversation-categories { display:flex; flex-shrink:0; gap:0; padding:0 4px; border-bottom:1px solid var(--el-border-color);container-type:inline-size; }
a { position:relative; display:flex;align-items:center;justify-content:center;gap:4px;flex:1;min-width:0;padding:10px 2px;color:var(--el-text-color-secondary);text-decoration:none;font-size:12px;white-space:nowrap;border-radius:6px 6px 0 0; }
.category-label{overflow:hidden;text-overflow:ellipsis;min-width:0;}
.category-badge{display:inline-flex;flex-shrink:0;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:var(--el-color-danger);color:#fff;font-size:10px;line-height:1;font-weight:600;}
@container(max-width:280px){a{gap:3px;}.category-badge{font-size:0;min-width:6px;width:6px;height:6px;padding:0;border-radius:50%;}}
a:hover { background:var(--el-fill-color-light); }.category-active { color:var(--el-color-primary); font-weight:600; }.category-active::after { content:''; position:absolute; height:3px; background:currentColor; inset-inline:8px; bottom:0; border-radius:3px 3px 0 0; }
a:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
</style>
