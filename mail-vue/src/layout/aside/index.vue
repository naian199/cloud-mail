<template>
  <el-scrollbar class="scroll">
    <div>
      <div class="title" >
        <Icon icon="mdi:email-outline" width="24" height="24" />
        <div>{{settingStore.settings.title}}</div>
      </div>
      <el-menu ref="menu" :collapse="false" :default-active="route.meta.name" :default-openeds="isManagementPage ? ['management'] : []" text-color="#fff" active-text-color="#fff" style="margin-top: 10px">
        <el-menu-item @click="router.push({name: 'mail-chat'})" index="mail-chat"
                      :class="route.meta.name === 'mail-chat' ? 'choose-item' : ''">
          <Icon icon="solar:letter-opened-linear" width="20" height="20" />
          <span class="menu-name" style="margin-left: 16px">{{$t('mailChatTitle')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'external-mail'})" index="external-mail" :class="route.meta.name === 'external-mail' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:external-mail" width="20" height="20" /><span class="menu-name" style="margin-left: 16px">{{$t('mailChatExternalGroup')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'rooms'})" index="rooms" :class="route.meta.name === 'rooms' ? 'choose-item' : ''">
          <Icon icon="cloud-mail:group" width="20" height="20" /><span class="menu-name" style="margin-left: 16px">{{$t('roomTitle')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'email'})" index="email"
                      :class="route.meta.name === 'email' ? 'choose-item' : ''">
          <Icon icon="hugeicons:mailbox-01" width="20" height="20" />
          <span class="menu-name" style="margin-left: 16px">{{$t('inbox')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'send'})" index="send" v-perm="'email:send'"
                      :class="route.meta.name === 'send' ? 'choose-item' : ''">
          <Icon icon="cil:send" width="20" height="20" />
          <span class="menu-name" style="margin-left: 16px">{{$t('sent')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'draft'})" index="draft" v-perm="'email:send'"
                      :class="route.meta.name === 'draft' ? 'choose-item' : ''">
          <Icon icon="ep:document" width="19" height="19" />
          <span class="menu-name" style="margin-left: 17px">{{$t('drafts')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'star'})" index="star"
                      :class="route.meta.name === 'star' ? 'choose-item' : ''">
          <Icon icon="solar:star-line-duotone" width="20" height="20" />
          <span class="menu-name" style="margin-left: 16px">{{$t('starred')}}</span>
        </el-menu-item>
        <el-menu-item @click="router.push({name: 'setting'})" index="setting"
                      :class="route.meta.name === 'setting' ? 'choose-item' : ''">
          <Icon icon="fluent:settings-48-regular" width="20" height="20" />
          <span class="menu-name" style="margin-left: 16px">{{$t('settings')}}</span>
        </el-menu-item>
        <el-sub-menu v-if="canManage" index="management" class="management-menu" :class="{ 'management-active': isManagementPage }">
          <template #title>
            <Icon icon="fluent:settings-48-regular" width="20" height="20" />
            <span class="menu-name" style="margin-left: 16px">{{$t('manage')}}</span>
          </template>
          <el-menu-item @click="router.push({name: 'analysis'})" index="analysis" v-perm="'analysis:query'"
                        :class="route.meta.name === 'analysis' ? 'choose-item' : ''">
            <Icon icon="fluent:data-pie-20-regular" width="24" height="24" />
            <span class="menu-name" style="margin-left: 13px">{{$t('analytics')}}</span>
          </el-menu-item>
          <el-menu-item @click="router.push({name: 'user'})" index="user" v-perm="'user:query'"
                        :class="route.meta.name === 'user' ? 'choose-item' : ''">
            <Icon icon="si:user-alt-2-line" width="20" height="20" />
            <span class="menu-name" style="margin-left: 16px">{{$t('allUsers')}}</span>
          </el-menu-item>
          <el-menu-item @click="router.push({name: 'all-email'})" index="all-email" v-perm="'all-email:query'"
                        :class="route.meta.name === 'all-email' ? 'choose-item' : ''">
            <Icon icon="fluent:mail-list-28-regular" width="22" height="22" />
            <span class="menu-name" style="margin-left: 15px">{{$t('allMail')}}</span>
          </el-menu-item>
          <el-menu-item @click="router.push({name: 'role'})" index="role" v-perm="'role:query'"
                        :class="route.meta.name === 'role' ? 'choose-item' : ''">
            <Icon icon="fluent:lock-closed-16-regular" width="22" height="22" />
            <span class="menu-name" style="margin-left: 15px">{{$t('permissions')}}</span>
          </el-menu-item>
          <el-menu-item @click="router.push({name: 'reg-key'})" index="reg-key" v-perm="'reg-key:query'"
                        :class="route.meta.name === 'reg-key' ? 'choose-item' : ''">
            <Icon icon="fluent:fingerprint-20-filled" width="22" height="22" />
            <span class="menu-name" style="margin-left: 15px">{{$t('inviteCode')}}</span>
          </el-menu-item>
          <el-menu-item @click="router.push({name: 'sys-setting'})" index="sys-setting" v-perm="'setting:query'"
                        :class="route.meta.name === 'sys-setting' ? 'choose-item' : ''">
            <Icon icon="eos-icons:system-ok-outlined" width="18" height="18" style="margin-left: 2px" />
            <span class="menu-name" style="margin-left: 17px">{{$t('SystemSettings')}}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import router from "@/router/index.js";
import { useRoute } from "vue-router";
import {Icon} from "@iconify/vue";
import {useSettingStore} from "@/store/setting.js";
import {computed, ref, watch} from 'vue';
import {hasPerm} from '@/perm/perm.js';

const settingStore = useSettingStore();
const route = useRoute();
const menu = ref(null);
const managementPages = ['analysis', 'user', 'all-email', 'role', 'reg-key', 'sys-setting'];
const canManage = computed(() => ['all-email:query', 'user:query', 'role:query', 'setting:query', 'analysis:query', 'reg-key:query'].some(hasPerm));
const isManagementPage = computed(() => managementPages.includes(route.meta.name));
watch(() => route.meta.name, () => {
  if (isManagementPage.value) menu.value?.open('management');
}, { flush: 'post' });

</script>

<style lang="scss" scoped>

.title {
  margin: 15px 10px;
  height: 45px;
  border-radius: 6px;
  display: flex;
  position: relative;
  font-size: 16px;
  font-weight: bold;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #ffffff;
  background: linear-gradient(135deg, #1890ff, #3a80dd);
  transition: all 0.3s ease;
  max-width: 240px;
  padding: 0 10px;
  > div {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: calc(240px - 20px - 30px);
  }

  :deep(.el-icon) {
    flex-shrink: 0;
    font-size: 20px;
  }

  .user-right-icon {
    align-self: center;
    position: absolute;
    font-size: 12px;
    right: 8px;
    color: #ffffff;
  }

}


.management-menu {
  margin-top: 12px;
  :deep(.el-sub-menu__title) {
    height: 40px;
    margin: 3px 10px;
    padding: 0 36px 0 10px !important;
    border-radius: 6px;
    color: #fff;
    &:hover { background: rgba(255, 255, 255, 0.08); }
  }
  :deep(.el-menu) {
    width: auto;
    margin: 4px 10px 6px 24px;
    border-inline-start: 1px solid rgba(128, 128, 128, 0.25);
  }
  .el-menu-item { margin: 3px 0 3px 6px !important; }
}
.management-active :deep(.el-sub-menu__title) {
  background: var(--aside-menu-active-background);
}

.el-menu-item {
  margin: 3px 10px !important;
  border-radius: 6px;
  height: 36px;
  padding: 10px !important;
}

.choose-item {
  font-weight: 400;
  background: var(--aside-menu-active-background) !important;
  backdrop-filter: blur(4px);
}

@media (hover: hover) {
  .el-menu-item:hover {
    background: rgba(255, 255, 255, 0.08) !important;
  }
}

.menu-name {
  user-select: none;
}


:deep(.el-scrollbar__wrap--hidden-default ) {
  background: var(--aside-backgound) !important;
}

:deep(.el-menu-item) {
  background: var(--aside-backgound);
}

:deep(.el-menu) {
  background: var(--aside-backgound);
}

.el-menu {
  border-right: 0;
  width: 260px;
}

:deep(.el-divider__text) {
  background: var(--aside-backgound);
  color: #FFFFFF;
}

.scroll {

}
</style>
