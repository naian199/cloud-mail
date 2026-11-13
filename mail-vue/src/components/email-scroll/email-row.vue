<template>
  <div :class="['email-row', type, { 'right-checked': item.rightChecked }]"
       :data-checked="item.checked"
       @click="emit('open', item)"
       @contextmenu="emit('contextmenu', $event, item)"
  >
    <el-checkbox :class=" type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
                 v-model="item.checked"
                 :disabled="!item.checked && isSelectMax"
                 @click.stop></el-checkbox>
    <div @click.stop="emit('star', item)" class="pc-star" v-if="showStar">
      <Icon v-if="item.isStar" icon="fluent-color:star-16" width="20" height="20"/>
      <Icon v-else icon="solar:star-line-duotone" width="18" height="18"/>
    </div>
    <div v-if="!showStar"></div>
    <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

      <div class="email-sender" :style=" (showStatus ? 'gap: 10px;' : '') + ((item.unread === EmailUnreadEnum.UNREAD && showUnread)  ? 'font-weight: bold' : '')">
        <div class="email-status" v-if="showStatus">
          <el-tooltip effect="dark" :content="item.statusIcon.content">
            <Icon :icon="item.statusIcon.icon" :style="`color: ${item.statusIcon.color}`" width="20" height="20"/>
          </el-tooltip>
          <div class="del-status" v-if="item.isDel">
            <el-tooltip effect="dark" :content="item.isDelContent">
              <Icon class="icon" icon="mdi:email-remove" width="20" height="20"/>
            </el-tooltip>
          </div>
        </div>
        <div v-else></div>
        <span class="name">
          <span>
            <div class="unread" v-if="isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
            <slot name="name" :email="item"> {{ item.name }}</slot>
          </span>
          <span>
            <Icon v-if="item.isStar" icon="fluent-color:star-16" width="18" height="18"/>
          </span>
        </span>
        <span class="phone-time">{{ item.formatCreateTime }}</span>
      </div>
      <div>
        <div class="email-text">
          <span class="email-subject" :style="(item.unread === EmailUnreadEnum.UNREAD && showUnread)  ? 'font-weight: bold' : ''">
            <div class="unread" v-if="!isMobile && (item.unread === EmailUnreadEnum.UNREAD && showUnread) "/>
            <span v-if="item.code" class="code-tag" @click.stop="emit('copy-code', item.code)">[{{ t('codeLabel') }}{{ item.code }}]</span>
            <span class="subject-text">
              <slot name="subject" :email="item" >
                {{ item.subject || '\u200B' }}
              </slot>
            </span>
          </span>
          <span class="email-content">{{ item.listText || item.text || '\u200B' }}</span>
        </div>
        <div class="user-info" v-if="showUserInfo">
          <div class="user">
            <span>
              <Icon icon="mynaui:user" width="20" height="20"/>
            </span>
            <span>{{ item.userEmail }}</span>
          </div>
          <div class="account">
            <span>
              <Icon icon="mdi-light:email" width="20" height="20"/>
            </span>
            <span>{{ item.type === 0 ? item.toEmail : item.sendEmail }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="email-right" :style="showUserInfo ? 'align-self: start;':''">
      <span class="email-time" :style="(item.unread === EmailUnreadEnum.UNREAD && showUnread) ? 'font-weight: bold' : ''">{{ item.formatCreateTime }}</span>
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { EmailUnreadEnum } from '@/enums/email-enum.js';

// One message in the shared email list. The list owns selection, starring and
// the context menu; this row renders the message and reports what was clicked.
defineProps({
  item: { type: Object, required: true },
  type: String,
  showStar: Boolean,
  showStatus: Boolean,
  showUnread: Boolean,
  showUserInfo: Boolean,
  accountShow: Boolean,
  isMobile: Boolean,
  isSelectMax: Boolean
});
const emit = defineEmits(['open', 'contextmenu', 'star', 'copy-code']);
const { t } = useI18n();
</script>

<style scoped lang="scss">
.pc-star {
  display: flex;
  width: 40px;
}

@media (max-width: 1366px) {
  .pc-star {
    display: none;
  }
}

.del-status {
  color: var(--el-color-info);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  bottom: 1px;
}

.unread {
  height: 6px;
  width: 6px;
  background: var(--el-color-primary);
  margin-bottom: 2px;
  margin-right: 5px;
  border-radius: 50%;
  display: inline-block;
  justify-content: center;
}
</style>
