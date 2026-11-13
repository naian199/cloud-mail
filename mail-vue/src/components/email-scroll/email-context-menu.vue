<template>
  <el-dropdown
      ref="dropdownRef"
      @visible-change="visibleChange"
      :virtual-ref="triggerRef"
      :show-arrow="false"
      :popper-options="{
    modifiers: [{ name: 'offset', options: { offset: [0, 0] } }],
  }"
      virtual-triggering
      trigger="contextmenu"
      placement="bottom-start"
  >
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-if="rightClickEmail.code" @click="emit('copy-code', rightClickEmail.code)" >
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="fluent-color:clipboard-24" width="20" height="20" />
              <span>{{t('copyCode')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="['email'].includes(type)" @click="emit('read', rightClickEmail.emailId)" >
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="fluent:mail-read-20-regular" width="20" height="20" />
              <span>{{t('markAsRead')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="['email','star'].includes(type)" @click="uiStore.writerRef.openReply(rightClickEmail)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="la:reply" width="20" height="20"  />
              <span>{{t('reply')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="['email','send', 'star'].includes(type)" @click="uiStore.writerRef.openForward(rightClickEmail)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="iconoir:arrow-up-right" width="19" height="19"  />
              <span>{{t('forward')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="['email','send', 'star'].includes(type)" @click="emit('star', rightClickEmail)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="solar:star-line-duotone" width="19" height="19"/>
              <span>{{t('star')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="type === 'all-email'" @click="emit('search', 'user', rightClickEmail.userEmail)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="iconoir:search" width="20" height="20" />
              <span>{{t('searchUser')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="type === 'all-email' " @click="emit('search', 'account', rightClickEmail.toEmail)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="iconoir:search" width="20" height="20" />
              <span>{{t('searchEmail')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item v-if="type === 'all-email' " @click="emit('search', 'name', rightClickEmail.name)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="iconoir:search" width="20" height="20" />
              <span>{{t('searchSender')}}</span>
            </div>
          </template>
        </el-dropdown-item>
        <el-dropdown-item @click="emit('delete', rightClickEmail.emailId)">
          <template #default>
            <div class="right-dropdown-item">
              <Icon icon="uiw:delete" width="16" height="20" style="margin-left: 1px;margin-right: 3px" />
              <span>{{t('delete')}}</span>
            </div>
          </template>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useEventListener } from '@vueuse/core';
import { useUiStore } from '@/store/ui.js';

// Right-click menu for a message in the email list, opened at the pointer.
const props = defineProps({ type: String });
const emit = defineEmits(['copy-code', 'read', 'star', 'search', 'delete']);
const { t } = useI18n();
const uiStore = useUiStore();

const dropdownRef = ref(null);
const dropdownShow = ref(false);
// Briefly set after the menu opens or closes, so the click that closed it is not
// mistaken for a text selection in the row underneath.
const dropdownCloseLock = ref(false);
const rightClickEmail = ref({});
const position = ref(DOMRect.fromRect({ x: 0, y: 0 }));
const triggerRef = ref({
  getBoundingClientRect() {
    return position.value;
  }
});

useEventListener(window, 'wheel', () => {
  if (dropdownShow.value) {
    dropdownRef.value?.handleClose();
  }
}, { passive: true });

function visibleChange(e) {
  dropdownShow.value = e;
  dropdownCloseLock.value = true;
  setTimeout(() => {
    dropdownCloseLock.value = false;
  }, 1500);

  if (!e && rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false;
  }
}

function open(event, email) {
  if (props.type === 'draft') {
    return;
  }
  if (rightClickEmail.value.rightChecked) {
    rightClickEmail.value.rightChecked = false;
  }
  const { clientX, clientY } = event;
  position.value = DOMRect.fromRect({ x: clientX, y: clientY });
  event.preventDefault();
  dropdownRef.value?.handleOpen();

  rightClickEmail.value = email;
  rightClickEmail.value.rightChecked = true;
}

defineExpose({
  open,
  close: () => dropdownRef.value?.handleClose(),
  isOpen: dropdownShow,
  closeLocked: dropdownCloseLock
});
</script>

<style scoped lang="scss">
.right-dropdown-item {
  display: flex;
  gap: 10px;
}

:deep(.el-dropdown-menu__item:last-child) {
  padding-bottom: 10px;
}

:deep(.el-dropdown-menu__item:first-child) {
  padding-top: 10px;
}

:deep(.el-dropdown-menu__item) {
  padding-right: 14px;
  padding-left: 14px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
</style>
