<template>
  <el-dialog class="account-dialog" v-model="detailsShow" :title="t('userDetails')"  >
    <div class="details">
      <div v-if="userDetails.platform || userDetails.username" class="oauth-details">
        <el-avatar :src="userDetails.avatar" :size="30" class="oauth-avatar"/>
        <span>{{ $t('username') }}：{{ userDetails.username }}</span>
        <span v-if="userDetails.trustLevel != null">
          {{ $t('trustLevel') }}：<el-tag type="success">{{ userDetails.trustLevel }}</el-tag>
        </span>
      </div>
      <div v-if="!columns.sendNumShow"><span
          class="details-item-title">{{ $t('tabSent') }}:</span>{{ $n(userDetails.sendEmailCount || 0) }}
      </div>
      <div v-if="!columns.accountNumShow"><span class="details-item-title">{{ $t('tabMailboxes') }}:</span>{{
          userDetails.accountCount
        }}
      </div>
      <div v-if="!columns.createTimeShow"><span class="details-item-title">{{ $t('tabRegisteredAt') }}:</span>{{
          tzDayjs(userDetails.createTime).format('YYYY-MM-DD HH:mm')
        }}
      </div>
      <div v-if="!columns.typeShow"><span class="details-item-title">{{ $t('perm') }}:</span>
        {{ roleName(userDetails.type) }}
      </div>
      <div v-if="!columns.statusShow">
        <span class="details-item-title">{{ $t('tabStatus') }}:</span>
        <el-tag disable-transitions v-if="userDetails.isDel === 1" type="info">{{ $t('deleted') }}</el-tag>
        <el-tag disable-transitions v-else-if="userDetails.status === 0" type="primary">{{ $t('active') }}
        </el-tag>
        <el-tag disable-transitions v-else-if="userDetails.status === 1" type="danger">{{ $t('banned') }}
        </el-tag>
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
        <el-tag style="margin-left: 10px" v-if="userDetails.sendAction.hasPerm">
          {{ formatSendType(userDetails) }}
        </el-tag>
        <el-button size="small" style="margin-left: 10px"
                   v-if="userDetails.sendAction.hasPerm && userDetails.sendAction.sendCount"
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

// Everything about a user, including the facts whose table columns are hidden at this width.
defineProps({
  // Which table columns are visible; hidden ones are shown here instead.
  columns: { type: Object, required: true },
  roleName: { type: Function, required: true }
});
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
  if (!user.sendAction.hasPerm) return t('unauthorized');
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

defineExpose({
  open(user) {
    userDetails.value = user;
    detailsShow.value = true;
  }
});
</script>

<style scoped lang="scss">
.details {
  padding: 0 10px 10px 10px;
  display: grid;
  gap: 10px;
  .details-item-title {
    white-space: pre;
    color: #909399;
    font-weight: bold;
    padding-right: 10px;
  }
}

.oauth-details {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
