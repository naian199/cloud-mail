<template>
  <el-container class="layout" :class="{ 'persistent-nav': persistentNav, 'navigation-open': uiStore.asideShow, 'mobile-chat-focused': uiStore.mobileChatFocused, 'sidebar-collapsible': !compactSidebar && chatRoute, 'conversation-sidebar-collapsed': sidebarCollapsed && chatRoute }" :style="{ '--chat-viewport-height': 'var(--app-viewport-height, 100dvh)', '--chat-viewport-top': 'var(--app-viewport-top, 0px)', '--conversation-width': conversationWidth + 'px' }">
    <el-aside v-if="persistentNav" width="260px" class="persistent-aside">
      <nav id="main-navigation" :aria-label="$t('navigationMenu')"><Aside /></nav>
      <div class="persistent-aside-footer"><Header compact drawer /></div>
    </el-aside>
    <template v-else>
    <button type="button" class="global-navigation-toggle" :aria-label="$t('navigationMenu')" :title="$t('navigationMenu')" :aria-expanded="uiStore.asideShow" aria-controls="main-navigation" aria-haspopup="dialog" @click="uiStore.asideShow = !uiStore.asideShow">
      <Icon icon="cloud-mail:menu" width="20" height="20" />
    </button>
    <el-drawer v-model="uiStore.asideShow" direction="ltr" size="min(280px, calc(100vw - 24px))" :with-header="false" :title="$t('navigationMenu')" class="navigation-drawer">
      <button class="navigation-close" type="button" :aria-label="$t('cancel')" @click="uiStore.asideShow = false"><Icon icon="cloud-mail:back" width="22" /></button>
      <nav id="main-navigation" :aria-label="$t('navigationMenu')"><Aside /></nav>
      <template #footer><Header compact drawer /></template>
    </el-drawer>
    </template>
    <el-container class="main-container">
      <el-main>
        <el-header v-if="!chatRoute"><Header :toolbar="false" /></el-header>
        <Main />
      </el-main>
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>

<script setup>
import { useConversationSidebar } from '@/composables/use-conversation-sidebar';
import Aside from '@/layout/aside/index.vue'
import { Icon } from '@iconify/vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {useUiStore} from "@/store/ui.js";
import writer from '@/layout/write/index.vue'
import { useMessageAlerts } from '@/composables/use-message-alerts';
import { useBreakpoint, BREAKPOINTS } from '@/composables/use-breakpoint.js';

useMessageAlerts();

const uiStore = useUiStore();
const route = useRoute();
const chatRoute = computed(() => ['mail-chat', 'external-mail', 'rooms'].includes(route.name));
const {collapsed:sidebarCollapsed,compact:compactSidebar}=useConversationSidebar();
const conversationWidth = computed(() => sidebarCollapsed.value ? 64 : Math.min(420, Math.max(260, Number(uiStore.conversationWidth) || 300)));
uiStore.asideShow = false;
watch(() => route.fullPath, () => { uiStore.asideShow = false; });
// Wide desktops keep navigation visible; narrower screens use the drawer.
const { width: viewportWidth } = useBreakpoint();
const persistentNav = computed(() => viewportWidth.value > BREAKPOINTS.laptop);
watch(persistentNav, (wide) => { if (wide) uiStore.asideShow = false; });
const writerRef = ref({})
onMounted(() => {
  uiStore.writerRef = writerRef

})
</script>

<style lang="scss" scoped>
.layout {
  height: 100%;
  height: 100dvh;
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.main-container {
  min-width: 0;
  min-height: 0;
  background: var(--el-bg-color);
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

.el-main {
  padding: 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.el-header {
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-bottom: solid 1px var(--el-border-color);
  padding: 0 0 0 0;
}

@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .layout {
    height: var(--app-viewport-height, 100dvh);
    top: var(--app-viewport-top, 0px);
  }
  .layout.mobile-chat-focused {
    padding-bottom: 0;
  }
}
</style>

<style scoped>
.global-navigation-toggle { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: calc(env(safe-area-inset-left, 0px) + 4px); width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 6px; background: var(--el-bg-color); color: var(--el-text-color-primary); z-index: 102; cursor: pointer; }
.global-navigation-toggle:hover { background: var(--el-fill-color); }
.global-navigation-toggle:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.layout { --nav-toggle-space: 52px; }
.layout.persistent-nav { --nav-toggle-space: 12px; }
.layout :deep(.header-btn) { padding-inline-start: var(--nav-toggle-space); }
.layout :deep(.mail-chat .contact-controls .search) { margin-inline-start: var(--nav-toggle-space); width: calc(100% - 12px - var(--nav-toggle-space)); }
.persistent-aside { display: flex; flex-direction: column; min-height: 0; background: var(--aside-backgound); border-inline-end: 1px solid var(--el-border-color); }
.persistent-aside #main-navigation { flex: 1; min-height: 0; }
.persistent-aside :deep(.title) { margin-inline-start: 10px; }
.persistent-aside-footer { padding: 8px 12px; border-top: 1px solid var(--el-border-color); background: var(--el-bg-color); }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .layout.mobile-chat-focused .global-navigation-toggle { display:none; }
  .layout.mobile-chat-focused :deep(.mail-chat .thread-header), .layout.mobile-chat-focused :deep(.rooms .room-heading) { padding-inline-start: 4px; }
}
</style>

<style>
.navigation-drawer .el-drawer__body { padding:0; min-height:0; overflow:hidden; }.navigation-drawer #main-navigation { height:100%; }
.navigation-drawer .el-drawer__footer { padding:8px 12px; border-top:1px solid var(--el-border-color); }
.navigation-close { position:absolute; top:4px; left:4px; width:40px; height:40px; z-index:1; display:grid; place-items:center; padding:0; border:0; border-radius:6px; background:var(--el-bg-color); color:var(--el-text-color-primary); cursor:pointer; }
.navigation-close:focus-visible { outline:2px solid var(--el-color-primary); }
</style>

<style scoped>
.layout.sidebar-collapsible :deep(.contact-controls .search),.layout.sidebar-collapsible :deep(.room-controls .search) {width:calc(100% - 48px - var(--nav-toggle-space));margin-inline-end:48px;}
.layout.conversation-sidebar-collapsed .global-navigation-toggle {width:32px;inset-inline-start:0;}
</style>
