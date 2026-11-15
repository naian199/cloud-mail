<template>
  <el-dialog class="account-dialog" v-model="detailsShow" :title="t('userDetails')" width="min(520px, calc(100% - 28px))" @closed="$emit('closed')">
    <div class="details">
      <div class="account-identity">
        <UserAvatar :email="userDetails.email" :size="42" aria-hidden="true" />
        <div>
          <strong><bdi>{{ userDetails.email }}</bdi><OfficialBadge :profile="userDetails" /></strong>
          <small v-if="userDetails.identityUsername"><bdi>@{{ userDetails.identityUsername }}</bdi></small>
        </div>
      </div>
      <div>
        <span class="details-item-title">{{ $t('tabRole') }}</span>
        {{ roleName(userDetails.type) }}
      </div>
      <div>
        <span class="details-item-title">{{ $t('tabStatus') }}</span>
        <el-tag v-if="userDetails.isDel === 1" type="info" round>{{ $t('selectDeleted') }}</el-tag>
        <el-tag v-else-if="userDetails.status === 0" type="success" round>{{ $t('active') }}</el-tag>
        <el-tag v-else-if="userDetails.status === 1" type="danger" round>{{ $t('banned') }}</el-tag>
      </div>
      <div>
        <span class="details-item-title">{{ $t('tabRegisteredAt') }}</span>
        <bdi>{{ userDetails.createTime ? tzDayjs(userDetails.createTime).format('YYYY-MM-DD HH:mm') : $t('unknown') }}</bdi>
      </div>
      <div v-if="userDetails.username || userDetails.trustLevel != null" class="oauth-details">
        <el-avatar v-if="userDetails.avatar" :src="userDetails.avatar" :size="28" referrerpolicy="no-referrer" />
        <span v-if="userDetails.username">{{ $t('username') }} <bdi>{{ userDetails.username }}</bdi></span>
        <span v-if="userDetails.trustLevel != null">
          {{ $t('trustLevel') }} <el-tag type="success">{{ userDetails.trustLevel }}</el-tag>
        </span>
      </div>
      <div><span class="details-item-title">{{ $t('registrationIp') }}:</span>{{
          userDetails.createIp || $t('unknown')
        }}
      </div>
      <div><span class="details-item-title">{{ $t('recentIP') }}:</span>{{
          userDetails.activeIp || $t('unknown')
        }}
      </div>
      <div><span class="details-item-title">{{ $t('recentActivity') }}:</span>{{
          userDetails.activeTime ? tzDayjs(userDetails.activeTime).format('YYYY-MM-DD') : $t('unknown')
        }}
      </div>
      <div><span
          class="details-item-title">{{ $t('loginDevice') }}:</span>{{ userDetails.device || $t('unknown') }}
      </div>
      <div><span class="details-item-title">{{ $t('loginSystem') }}:</span>{{ userDetails.os || $t('unknown') }}
      </div>
      <div><span
          class="details-item-title">{{ $t('browserLogin') }}:</span>{{ userDetails.browser || $t('unknown') }}
      </div>
      <div>
        <span class="details-item-title">{{ $t('sendEmail') }}:</span>
        <span>{{ formatSendCount(userDetails) }}</span>
        <el-tag style="margin-left: 10px" v-if="userDetails.sendAction?.hasPerm">
          {{ formatSendType(userDetails) }}
        </el-tag>
        <el-button size="small" style="margin-left: 10px"
                   v-if="hasPerm('user:reset-send') && userDetails.sendAction?.hasPerm && userDetails.sendAction.sendCount"
                   @click="resetSendCount(userDetails)" type="primary">{{ $t('reset') }}
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userRestSendCount } from '@/request/user.js';
import { tzDayjs } from '@/utils/day.js';
import { hasPerm } from '@/perm/perm.js';
import UserAvatar from '@/components/user-avatar.vue';
import OfficialBadge from '@/components/official-badge.vue';

defineProps({ roleName: { type: Function, required: true } });
const { t } = useI18n();

const detailsShow = ref(false);
const userDetails = ref({});

function formatSendType(user) {
  if (user.sendAction.sendType === 'day') return t('daily');
  if (user.sendAction.sendType === 'count') return t('total');
  if (user.sendAction.sendType === 'ban') return t('sendBanned');
  if (user.sendAction.sendType === 'internal') return t('sendInternal');
}

function formatSendCount(user) {
  if (!user.sendAction?.hasPerm) return t('unauthorized');
  if (!user.sendAction.sendCount) return t('unlimited');
  return user.sendCount + '/' + user.sendAction.sendCount;
}

function resetSendCount(user) {
  ElMessageBox.confirm(t('reSendConfirm', { msg: user.email }), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    userRestSendCount(user.userId).then(() => {
      ElMessage({ message: t('reSuccessMsg'), type: 'success', plain: true });
      user.sendCount = 0;
    });
  });
}

defineEmits(['closed']);
defineExpose({
  open(user) {
    userDetails.value = user;
    detailsShow.value = true;
  },
  close() {
    detailsShow.value = false;
  },
  get shown() { return detailsShow.value; }
});
</script>

<style scoped lang="scss">
.details {
  padding: 0 2px 10px;
  overflow-wrap: anywhere;
  display: grid;
  gap: 10px;
  .details-item-title {
    white-space: pre;
    color: var(--el-text-color-secondary);
    font-weight: bold;
    padding-inline-end: 10px;
  }
}

.account-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-block-end: 6px;
  padding-block-end: 15px;
  color: var(--el-text-color-primary);

  small {
    display: block;
    margin-block-start: 3px;
    color: var(--el-text-color-secondary);
  }
}

.oauth-details {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
