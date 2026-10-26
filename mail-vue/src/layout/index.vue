<template>
  <el-container class="layout" :class="{ 'navigation-open': uiStore.asideShow, 'mobile-chat-focused': uiStore.mobileChatFocused, 'mobile-contacts-collapsed': uiStore.mobileContactsCollapsed }" :style="{ '--chat-viewport-height': viewportHeight + 'px', '--chat-viewport-top': viewportTop + 'px' }">
    <button type="button" class="global-navigation-toggle" :aria-label="$t('navigationMenu')" :title="$t('navigationMenu')" :aria-expanded="uiStore.asideShow" aria-controls="main-navigation" @click="uiStore.asideShow = !uiStore.asideShow">
      <Icon icon="cloud-mail:menu" width="20" height="20" />
    </button>
    <el-aside id="main-navigation"
        class="aside"
        :class="uiStore.asideShow ? 'aside-show' : 'el-aside-hide'">
      <Aside />
    </el-aside>
    <div
        :class="(uiStore.asideShow && isMobile)? 'overlay-show':'overlay-hide'"
        @click="uiStore.asideShow = false"
    ></div>
    <el-container class="main-container">
      <el-main>
        <el-header v-show="!uiStore.mobileContactsHeaderTarget && !(['mail-chat', 'external-mail'].includes(route.name) && uiStore.mobileChatFocused)">
          <Teleport :to="uiStore.mobileContactsHeaderTarget || 'body'" :disabled="!uiStore.mobileContactsHeaderTarget">
            <Header />
          </Teleport>
        </el-header>
        <Main />
      </el-main>
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>

<script setup>
import Aside from '@/layout/aside/index.vue'
import { Icon } from '@iconify/vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import {useUiStore} from "@/store/ui.js";
import writer from '@/layout/write/index.vue'
import { useMessageAlerts } from '@/composables/use-message-alerts';

useMessageAlerts();

const uiStore = useUiStore();
const route = useRoute();
const viewportHeight = ref(window.visualViewport?.height || window.innerHeight);
const viewportTop = ref(window.visualViewport?.offsetTop || 0);
function updateViewport() {
  const viewport = window.visualViewport;
  if (viewport && viewport.scale !== 1) return;
  viewportHeight.value = viewport?.height || window.innerHeight;
  viewportTop.value = viewport?.offsetTop || 0;
}

const writerRef = ref({})
const isMobile = ref(window.innerWidth < 1025)
const handleResize = () => {
  const mobile = window.innerWidth < 1025
  if (mobile !== isMobile.value) {
    uiStore.asideShow = !mobile
    isMobile.value = mobile
  }
}

onMounted(() => {
  uiStore.writerRef = writerRef

  window.addEventListener('resize', handleResize)
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('scroll', updateViewport)
  updateViewport()
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('scroll', updateViewport)
})
</script>

<style lang="scss" scoped>
.el-aside-hide {
  visibility: hidden;
  pointer-events: none;
  position: fixed;
  left: 0;
  height: 100%;
  z-index: 100;
  transform: translateX(-100%);
  transition: all 100ms ease;
}

.aside-show {
  -webkit-box-shadow: var(--aside-right-border);
  box-shadow: var(--aside-right-border);
  transform: translateX(0);
  transition: all 100ms ease;
  z-index: 101;
  @media (max-width: 1024px) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 101;
    height: 100%;
    background: var(--el-bg-color);
  }
}

.el-aside {
  width: auto;
  transition: all 100ms ease;
}

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

.overlay-show {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  transition: all 0.3s;
}

.overlay-hide {
  display: flex;
  pointer-events: none;
  opacity: 0;
}
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .layout {
    height: var(--chat-viewport-height, 100dvh);
    top: var(--chat-viewport-top, 0px);
  }
  .layout.mobile-chat-focused {
    padding-bottom: 0;
  }
  .mobile-chat-focused .el-header, .mobile-contacts-collapsed .el-header { display: none; }
}
</style>

<style scoped>
.global-navigation-toggle { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: calc(env(safe-area-inset-left, 0px) + 4px); width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 6px; background: var(--el-bg-color); color: var(--el-text-color-primary); z-index: 102; cursor: pointer; }
.global-navigation-toggle:hover { background: var(--el-fill-color); }
.global-navigation-toggle:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.layout:not(.navigation-open) :deep(.header-btn) { padding-inline-start: 52px; }
.layout:not(.navigation-open).mobile-chat-focused :deep(.mail-chat .contact-controls .search) { margin-inline-start: 52px; width: calc(100% - 64px); }
@media (max-width: 767px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse) {
  .layout.mobile-chat-focused :deep(.mail-chat .thread-header), .layout.mobile-chat-focused :deep(.rooms .room-heading) { padding-inline-start: 48px; }
}
</style>
