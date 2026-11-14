<template>
  <el-container class="layout" :class="{ 'phone-shell': phone, 'with-tabbar': showTabbar, 'mobile-chat-focused': uiStore.mobileChatFocused, 'sidebar-collapsible': !compactSidebar && chatRoute, 'conversation-sidebar-collapsed': sidebarCollapsed && chatRoute }" :style="{ '--chat-viewport-height': 'var(--app-viewport-height, 100dvh)', '--chat-viewport-top': 'var(--app-viewport-top, 0px)', '--conversation-width': conversationWidth + 'px' }">
    <Rail v-if="!phone" />
    <el-container class="main-container">
      <el-main>
        <el-header v-if="!chatRoute && !ownHeader"><Header :toolbar="!phone" /></el-header>
        <MailTabs v-if="mailSection && !(phone && route.name === 'content')" />
        <Main />
      </el-main>
      <Tabbar v-if="showTabbar" />
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>

<script setup>
import { useConversationSidebar } from '@/composables/use-conversation-sidebar';
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import Rail from '@/layout/rail/index.vue'
import Tabbar from '@/layout/tabbar/index.vue'
import MailTabs from '@/layout/mail-tabs/index.vue'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import {useUiStore} from "@/store/ui.js";
import writer from '@/layout/write/index.vue'
import { useMessageAlerts } from '@/composables/use-message-alerts';
import { useBreakpoint } from '@/composables/use-breakpoint.js';
import { sectionOf } from '@/composables/use-site-nav';

useMessageAlerts();

const uiStore = useUiStore();
const route = useRoute();
const chatRoute = computed(() => ['chat-all', 'mail-chat', 'external-mail', 'rooms'].includes(route.name));
const mailSection = computed(() => sectionOf(route.name) === 'mail');
// Pages that draw their own title bar.
const ownHeader = computed(() => ['apps', 'app-detail', 'app-publish', 'app-review', 'me'].includes(route.name));
const {collapsed:sidebarCollapsed,compact:compactSidebar}=useConversationSidebar();
const conversationWidth = computed(() => sidebarCollapsed.value ? 64 : Math.min(420, Math.max(260, Number(uiStore.conversationWidth) || 300)));
uiStore.asideShow = false;
const { isPhone: phone } = useBreakpoint();
// The on-screen keyboard shrinks the visual viewport; hide the tab bar while it is up.
const keyboard = ref(false);
function measureKeyboard() {
  const vv = window.visualViewport;
  keyboard.value = !!vv && window.innerHeight - vv.height > 150;
}
const detail = computed(() => uiStore.mobileChatFocused || ['content', 'app-detail', 'app-publish', 'app-review'].includes(route.name));
const showTabbar = computed(() => phone.value && !detail.value && !keyboard.value);
const writerRef = ref({})
onMounted(() => {
  uiStore.writerRef = writerRef
  window.visualViewport?.addEventListener('resize', measureKeyboard);
})
onBeforeUnmount(() => window.visualViewport?.removeEventListener('resize', measureKeyboard));
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

.layout.with-tabbar { padding-bottom: 0; }

.main-container {
  flex-direction: column;
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
.layout { --nav-toggle-space: 12px; }
.layout :deep(.header-btn) { padding-inline-start: var(--nav-toggle-space); }
.layout :deep(.mail-chat .contact-controls .search) { margin-inline-start: var(--nav-toggle-space); width: calc(100% - 12px - var(--nav-toggle-space)); }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .layout.mobile-chat-focused :deep(.mail-chat .thread-header), .layout.mobile-chat-focused :deep(.rooms .room-heading) { padding-inline-start: 4px; }
}
</style>

<style>
.navigation-drawer{--nav-bg:#f8fafd;--nav-ink:#25334a;--nav-muted:#64748b;--nav-line:#e4eaf2;--nav-hover:#edf2f9;--nav-active:#e7f1ff;--nav-accent:#216bd5;background:var(--nav-bg)!important;color:var(--nav-ink);border-inline-end:1px solid var(--nav-line);}
html.dark .navigation-drawer{--nav-bg:#191f2b;--nav-ink:#e3e9f4;--nav-muted:#909db3;--nav-line:#2a3344;--nav-hover:#252e3f;--nav-active:#233a58;--nav-accent:#7bb5ff;}
.navigation-drawer .el-drawer__header{padding:22px 18px 18px;margin:0;border-bottom:1px solid var(--nav-line);color:var(--nav-ink);}
.navigation-drawer .el-drawer__body{padding:0;min-height:0;overflow:hidden;}.navigation-drawer #main-navigation{height:100%;}
.navigation-drawer .el-drawer__footer{padding:12px;flex-shrink:0;border-top:1px solid var(--nav-line);background:var(--nav-bg);padding-bottom:max(12px,env(safe-area-inset-bottom));}
.navigation-brand{width:100%;display:flex;align-items:center;gap:11px;min-width:0;}.navigation-brand img{border-radius:10px;flex-shrink:0;}.navigation-brand>div{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;}.navigation-brand strong{font-size:15px;line-height:1.3;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.navigation-brand span{font-size:11px;line-height:1.5;color:var(--nav-muted);}
.navigation-close{display:grid;place-items:center;padding:0;flex-shrink:0;width:44px;height:44px;border:0;border-radius:9px;background:none;color:var(--nav-muted);cursor:pointer;}.navigation-close:hover{background:var(--nav-hover);color:var(--nav-ink);}.navigation-close:focus-visible{outline:2px solid var(--nav-accent);outline-offset:2px;}
</style>

<style scoped>
.layout.sidebar-collapsible :deep(.contact-controls .search),.layout.sidebar-collapsible :deep(.room-controls .search) {width:calc(100% - 48px - var(--nav-toggle-space));margin-inline-end:48px;}
</style>
