<template>
  <el-dialog class="dialog" v-model="setPwdShow" :title="$t('changePassword')" @closed="resetUserForm">
    <div class="dialog-box">
      <el-input v-model="userForm.password" type="password" :placeholder="$t('newPassword')" autocomplete="off" @keyup.enter="updatePwd">
      </el-input>
      <el-button class="btn" type="primary" :loading="settingLoading" @click="updatePwd"
      >{{ $t('save') }}
      </el-button>
    </div>
  </el-dialog>
  <el-dialog class="dialog" v-model="setTypeShow" :title="$t('changePerm')" @closed="resetUserForm">
    <div class="dialog-box">
      <el-input disabled :model-value="$t('admin')" v-if="userForm.type === 0"/>
      <el-select v-else v-model="userForm.type" placeholder="Select">
        <el-option v-for="item in roleList" :label="item.name" :value="item.roleId" :key="item.roleId"/>
      </el-select>
      <el-button :disabled="userForm.type === 0" class="btn" :loading="settingLoading" type="primary" @click="setType"
      >{{ $t('save') }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { userSetPwd, userSetType } from '@/request/user.js';

// Change a user's password or role.
defineProps({ roleList: { type: Array, required: true } });
const { t } = useI18n();

const setPwdShow = ref(false);
const setTypeShow = ref(false);
const settingLoading = ref(false);
const userForm = reactive({ password: null, type: -1, userId: 0 });
let chooseUser = {};

function resetUserForm() {
  userForm.password = null;
  userForm.userId = 0;
}

function updatePwd() {
  if (settingLoading.value) return;
  if (!userForm.password) {
    ElMessage({ message: t('emptyPwdMsg'), type: 'error', plain: true });
    return;
  }
  if (userForm.password.length < 6) {
    ElMessage({ message: t('pwdLengthMsg'), type: 'error', plain: true });
    return;
  }
  settingLoading.value = true;
  userSetPwd({ password: userForm.password, userId: userForm.userId }).then(() => {
    setPwdShow.value = false;
    ElMessage({ message: t('saveSuccessMsg'), type: 'success', plain: true });
  }).finally(() => {
    settingLoading.value = false;
  });
}

function setType() {
  if (settingLoading.value) return;
  settingLoading.value = true;
  userSetType({ type: userForm.type, userId: userForm.userId }).then(() => {
    // The row object comes from the page's list, so the table updates in place.
    chooseUser.type = userForm.type;
    setTypeShow.value = false;
    ElMessage({ message: t('saveSuccessMsg'), type: 'success', plain: true });
  }).finally(() => {
    settingLoading.value = false;
  });
}

defineExpose({
  openSetPwd(user) {
    userForm.userId = user.userId;
    setPwdShow.value = true;
  },
  openSetType(user) {
    chooseUser = user;
    userForm.userId = user.userId;
    userForm.type = user.type;
    setTypeShow.value = true;
  }
});
</script>

<style scoped lang="scss">
.dialog {
  .dialog-box {
    .el-button {
      width: 100%;
      margin-top: 15px;
    }
  }
}

.btn {
  width: 100%;
}
</style>
