<template>
  <el-dialog v-model="showAdd" :title="$t('addUser')" @closed="resetAddForm">
    <div class="container">
      <el-input v-model="addForm.email" type="text" :placeholder="$t('emailAccount')" autocomplete="off" @keyup.enter="submit">
        <template #append>
          <div @click.stop="mySelect.toggleMenu()">
            <div inert>
              <el-select
                  ref="mySelect"
                  v-model="addForm.suffix"
                  :placeholder="$t('select')"
                  class="select"
              >
                <el-option
                    v-for="item in domainList"
                    :key="item"
                    :label="item"
                    :value="item"
                />
              </el-select>
            </div>
            <div>
              <span>{{ addForm.suffix }}</span>
              <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
            </div>
          </div>
        </template>
      </el-input>
      <el-input type="password" v-model="addForm.password" :placeholder="$t('password')" @keyup.enter="submit"/>
      <el-select v-model="addForm.type" :placeholder="$t('perm')">
        <el-option v-for="item in roleList" :label="item.name" :value="item.roleId" :key="item.roleId"/>
      </el-select>
      <el-button class="btn" type="primary" @click="submit" :loading="addLoading"
      >{{ $t('add') }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { userAdd } from '@/request/user.js';
import { useSettingStore } from '@/store/setting.js';
import { isEmail } from '@/utils/verify-utils.js';

// Create a user with an address on one of the site's domains.
defineProps({ roleList: { type: Array, required: true } });
const emit = defineEmits(['added']);
const { t } = useI18n();
const settingStore = useSettingStore();

const domainList = settingStore.domainList;
const showAdd = ref(false);
const addLoading = ref(false);
const mySelect = ref({});
const addForm = reactive({
  email: '',
  suffix: settingStore.domainList[0],
  password: '',
  type: null
});

function resetAddForm() {
  addForm.email = '';
  addForm.password = '';
}

function fail(key) {
  ElMessage({ message: t(key), type: 'error', plain: true });
}

function submit() {
  if (addLoading.value) return;
  if (!addForm.email) return fail('emptyEmailMsg');
  if (!isEmail(addForm.email + addForm.suffix)) return fail('notEmailMsg');
  if (!addForm.password) return fail('emptyPwdMsg');
  if (addForm.password.length < 6) return fail('pwdLengthMsg');
  if (!addForm.type) return fail('emptyRole');

  addLoading.value = true;
  const form = { ...addForm };
  form.email = form.email + form.suffix;
  userAdd(form).then(() => {
    addLoading.value = false;
    showAdd.value = false;
    ElMessage({ message: t('addSuccessMsg'), type: 'success', plain: true });
    emit('added');
  }).finally(() => {
    addLoading.value = false;
  });
}

defineExpose({ open: () => { showAdd.value = true; } });
</script>

<style scoped lang="scss">
.container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

.select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

.setting-icon {
  position: relative;
  top: 6px;
}

.btn {
  width: 100%;
}
</style>
