<template>
  <el-dialog class="account-dialog" v-model="accountShow" :title="t('userAccount')" @closed="resetAccountList" >
    <el-table :data="accountList" style="height: 480px" v-loading="accountLoading" element-loading-background="transparent" :empty-text="accountLoading ? '' : null">
      <el-table-column property="email" :label="t('emailAccount')" >
        <template #default="props">
          <div class="email-row">{{ props.row.email }}</div>
        </template>
      </el-table-column>
      <el-table-column property="address" :label="t('tabStatus')"  :width="locale === 'en' ? 75 : 65" >
        <template #default="props">
          <el-tag type="primary" disable-transitions v-if="props.row.isDel === 0">{{$t('active')}}</el-tag>
          <el-tag type="info" disable-transitions v-if="props.row.isDel === 1">{{$t('deleted')}}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('action')" :width="locale === 'en' ? 75 : 65" >
        <template #default="props">
          <el-dropdown trigger="click">
            <el-button type="primary" size="small">{{t('action')}}</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="deleteAccount(props.row)">{{ $t('delete') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>
    <div class="account-pagination">
      <el-pagination
          :disabled="accountLoading"
          background

          layout="prev, pager, next"
          :pager-count="3"
          :total="accountParams.total"
          @current-change="accountCurChange"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userAllAccount, userDeleteAccount } from '@/request/user.js';

// Lists a user's mail addresses and deletes them one at a time.
const { t, locale } = useI18n();

const accountShow = ref(false);
const accountLoading = ref(false);
const accountList = reactive([]);
const accountParams = reactive({ size: 10, num: 0, total: 0, userId: 0 });

function getAccountList(loading = false) {
  accountLoading.value = loading;
  userAllAccount(accountParams.userId, accountParams.num, accountParams.size).then(({ list, total }) => {
    accountList.length = 0;
    accountList.push(...list);
    accountParams.total = total;
    accountLoading.value = false;
  });
}

function deleteAccount(account) {
  ElMessageBox.confirm(t('delConfirm', { msg: account.email }), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    userDeleteAccount(account.accountId).then(() => {
      getAccountList();
      ElMessage({ message: t('delSuccessMsg'), type: 'success', plain: true });
    });
  });
}

function accountCurChange(e) {
  accountParams.num = e;
  getAccountList();
}

function resetAccountList() {
  accountList.length = 0;
  accountParams.num = 0;
  accountParams.size = 10;
  accountParams.total = 0;
}

defineExpose({
  open(userId) {
    accountParams.userId = userId;
    getAccountList(true);
    accountShow.value = true;
  }
});
</script>

<style scoped lang="scss">
.email-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-pagination {
  display: flex;
  justify-content: end;
  width: 100%;
}
</style>
