<template>
  <el-scrollbar class="scroll" v-loading="!!navigationTarget" :element-loading-text="$t('navigationOpening')">
    <div class="navigation-content">
      <el-menu ref="primaryMenu" class="primary-menu" @select="navigate" :collapse="false" :default-active="route.meta.name" :default-openeds="isManagementPage ? ['management'] : []">
        <el-menu-item-group :title="$t('navigationMessages')">
        <el-menu-item index="mail-chat"
                      :class="route.meta.name === 'mail-chat' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:chat" width="20" height="20" />
          <span class="menu-name">{{$t('mailChatTitle')}}</span>
        <span v-if="navUnread.chat" class="navigation-unread" :aria-label="$n(navUnread.chat)+' '+$t('chatUnread')">{{ navUnread.chat>99 ? $n(99)+'+' : $n(navUnread.chat) }}</span></el-menu-item>
        <el-menu-item index="external-mail" :class="route.meta.name === 'external-mail' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:external-mail" width="20" height="20" /><span class="menu-name">{{$t('mailChatExternalGroup')}}</span>
        <span v-if="navUnread.external" class="navigation-unread" :aria-label="$n(navUnread.external)+' '+$t('chatUnread')">{{ navUnread.external>99 ? $n(99)+'+' : $n(navUnread.external) }}</span></el-menu-item>
        <el-menu-item index="rooms" :class="route.meta.name === 'rooms' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:group" width="20" height="20" /><span class="menu-name">{{$t('roomTitle')}}</span>
        <span v-if="navUnread.rooms" class="navigation-unread" :aria-label="$n(navUnread.rooms)+' '+$t('chatUnread')">{{ navUnread.rooms>99 ? $n(99)+'+' : $n(navUnread.rooms) }}</span></el-menu-item>
        </el-menu-item-group>
        <el-menu-item-group :title="$t('navigationMail')">
        <el-menu-item index="email"
                      :class="route.meta.name === 'email' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:inbox" width="20" height="20" />
          <span class="menu-name">{{$t('inbox')}}</span>
        </el-menu-item>
        <el-menu-item index="send" v-if="hasPerm('email:send')"
                      :class="route.meta.name === 'send' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:send" width="20" height="20" />
          <span class="menu-name">{{$t('sent')}}</span>
        </el-menu-item>
        <el-menu-item index="draft" v-if="hasPerm('email:send')"
                      :class="route.meta.name === 'draft' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:file" width="19" height="19" />
          <span class="menu-name">{{$t('drafts')}}</span>
        </el-menu-item>
        <el-menu-item index="star"
                      :class="route.meta.name === 'star' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:star" width="20" height="20" />
          <span class="menu-name">{{$t('starred')}}</span>
        </el-menu-item>
        </el-menu-item-group>
      </el-menu>
      <el-menu v-if="canManage" ref="menu" class="footer-menu" @select="navigate" :default-active="route.meta.name" :default-openeds="isManagementPage ? ['management'] : []">
        <el-sub-menu v-if="canManage" index="management" class="management-menu" :class="{ 'management-active': isManagementPage }">
          <template #title>
            <Icon icon="cloud-mail:settings" width="20" height="20" />
            <span class="menu-name">{{$t('manage')}}</span>
          </template>
          <el-menu-item index="analysis" v-if="hasPerm('analysis:query')"
                        :class="route.meta.name === 'analysis' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:analytics" width="20" height="20" />
            <span class="menu-name">{{$t('analytics')}}</span>
          </el-menu-item>
          <el-menu-item index="user" v-if="hasPerm('user:query')"
                        :class="route.meta.name === 'user' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:group" width="20" height="20" />
            <span class="menu-name">{{$t('allUsers')}}</span>
          </el-menu-item>
          <el-menu-item index="all-email" v-if="hasPerm('all-email:query')"
                        :class="route.meta.name === 'all-email' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:external-mail" width="20" height="20" />
            <span class="menu-name">{{$t('allMail')}}</span>
          </el-menu-item>
          <el-menu-item index="role" v-if="hasPerm('role:query')"
                        :class="route.meta.name === 'role' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:lock" width="20" height="20" />
            <span class="menu-name">{{$t('permissions')}}</span>
          </el-menu-item>
          <el-menu-item index="reg-key" v-if="hasPerm('reg-key:query')"
                        :class="route.meta.name === 'reg-key' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:key" width="20" height="20" />
            <span class="menu-name">{{$t('inviteCode')}}</span>
          </el-menu-item>
          <el-menu-item index="sys-setting" v-if="hasPerm('setting:query')"
                        :class="route.meta.name === 'sys-setting' ? 'choose-item' : ''">
            <Icon icon="cloud-mail:settings" width="18" height="18" />
            <span class="menu-name">{{$t('SystemSettings')}}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import {categoryUnread} from '@/composables/use-category-unread';
import {useAccountStore} from '@/store/account';
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";
import {computed, ref, watch} from 'vue';
import {hasPerm,syncPermissionRoutes} from '@/perm/perm.js';
import {useUserStore} from '@/store/user';
import {useI18n} from 'vue-i18n';
import {isNavigationFailure,NavigationFailureType} from 'vue-router';
import {useUiStore} from '@/store/ui';
const ui = useUiStore();
const accounts=useAccountStore();
const navUnread=computed(()=>{
 const summary=categoryUnread.value,mailbox=summary.accounts[accounts.currentAccountId]||{};
 return {chat:Number(mailbox.chat)||0,external:Number(mailbox.external)||0,rooms:(Number(summary.categories.group)||0)+(Number(summary.categories.channel)||0)};
});

const settingStore = useSettingStore();
const route = useRoute();
const menu = ref(null),primaryMenu=ref(null),navigationTarget=ref('');
const user=useUserStore(),{t}=useI18n();
async function navigate(name){
 if(navigationTarget.value)return;
 syncPermissionRoutes(router,user.user.permKeys||[]);
 if(!router.hasRoute(name)){ElMessage.warning(t('navigationUnavailable'));restoreActive();return;}
 navigationTarget.value=name;
 try{
  const failure=await router.push({name});
  if(!failure||isNavigationFailure(failure,NavigationFailureType.duplicated))ui.asideShow=false;
  else restoreActive();
 }catch{restoreActive();/* Router error handler reports the failure and recovers stale assets. */}
 finally{navigationTarget.value='';}
}
function restoreActive(){menu.value?.updateActiveIndex(route.meta.name);primaryMenu.value?.updateActiveIndex(route.meta.name);}
const managementPages = ['analysis', 'user', 'all-email', 'role', 'reg-key', 'sys-setting'];
const canManage = computed(() => ['all-email:query', 'user:query', 'role:query', 'setting:query', 'analysis:query', 'reg-key:query'].some(hasPerm));
const isManagementPage = computed(() => managementPages.includes(route.meta.name));
watch(() => route.meta.name, () => {
  if (isManagementPage.value) menu.value?.open('management');
}, { flush: 'post' });

</script>

<style scoped>
.scroll{height:100%;min-height:0;}.navigation-content{padding:8px 12px 22px;box-sizing:border-box;min-height:100%;}.el-menu{border:0;width:100%;background:transparent;--el-menu-bg-color:transparent;--el-menu-text-color:var(--nav-ink);--el-menu-active-color:var(--nav-accent);--el-menu-hover-bg-color:var(--nav-hover);--el-menu-item-height:44px;}
:deep(.el-menu-item-group__title){padding:18px 12px 8px;font-size:11px;line-height:1.5;font-weight:500;color:var(--nav-muted);letter-spacing:.02em;}.el-menu-item{position:relative;display:flex;gap:12px;height:44px;line-height:1.4;margin:3px 0;padding:0 12px!important;border-radius:10px;min-width:0!important;color:var(--nav-ink);font-size:13px;}.el-menu-item>svg{flex-shrink:0;width:20px;height:20px;}.menu-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:none;}.el-menu-item:hover{background:var(--nav-hover);}.el-menu-item.choose-item,.el-menu-item.is-active{background:var(--nav-active);color:var(--nav-accent);font-weight:600;}.el-menu-item.is-active::before{content:'';position:absolute;inset-inline-start:0;top:13px;bottom:13px;width:3px;background:var(--nav-accent);border-radius:3px;}.el-menu-item:focus-visible{outline:2px solid var(--nav-accent);outline-offset:-2px;}
.footer-menu{margin-top:20px;padding-top:14px;border-top:1px solid var(--nav-line);}.management-menu :deep(.el-sub-menu__title){height:44px;line-height:1.4;border-radius:10px;padding:0 12px!important;gap:12px;color:var(--nav-muted);font-size:12px;font-weight:600;}.management-menu :deep(.el-sub-menu__title:hover){background:var(--nav-hover);}.management-menu :deep(.el-sub-menu__title>svg){flex-shrink:0;width:20px;height:20px;}.management-menu :deep(.el-sub-menu__icon-arrow){inset-inline-end:12px;font-size:11px;}.management-menu :deep(.el-menu){background:none;margin:6px 0 0 9px;padding-inline-start:10px;border:0;border-inline-start:1px solid var(--nav-line);}.management-menu .el-menu-item{height:40px;font-size:12px;padding-inline:12px!important;}.management-active :deep(.el-sub-menu__title){color:var(--nav-ink);}
.navigation-unread{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;margin-inline-start:auto;flex-shrink:0;border-radius:10px;background:var(--nav-accent);color:var(--nav-bg);font-size:11px;line-height:1;font-weight:600;font-variant-numeric:tabular-nums;}
</style>
