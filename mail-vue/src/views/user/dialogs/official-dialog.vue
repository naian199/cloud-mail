<template>
  <el-dialog v-model="officialOpen" :title="$t('officialManage')" width="min(440px,94vw)"><p>{{ officialTarget?.email }}</p><el-input v-model="officialForm.subject" :placeholder="$t('officialSubject')" maxlength="80" /><el-input v-model="officialForm.description" type="textarea" :placeholder="$t('officialDescription')" maxlength="240" style="margin-top:12px" /><p>{{ $t('officialExplanation') }}</p><el-button type="primary" :loading="officialBusy" @click="saveOfficial(true)">{{ $t('officialGrant') }}</el-button><el-button v-if="officialTarget?.officialVerified" type="danger" :loading="officialBusy" @click="saveOfficial(false)">{{ $t('officialRevoke') }}</el-button><h4>{{ $t('officialHistory') }}</h4><p v-for="(entry,index) in officialHistory" :key="index">{{ entry.createdAt }} · {{ $t(entry.active?'officialGrant':'officialRevoke') }} · {{ entry.subject }} · ID {{ entry.actorId }}</p></el-dialog>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import identityHttp from '@/axios';

// Grant or revoke a user's official badge, with the audit history.
const { t } = useI18n();
const officialOpen = ref(false), officialBusy = ref(false), officialTarget = ref(null), officialHistory = ref([]);
const officialForm = reactive({ subject: '', description: '' });

async function open(row) {
  officialTarget.value = row;
  officialForm.subject = row.officialSubject || '';
  officialForm.description = row.officialDescription || '';
  officialHistory.value = [];
  officialOpen.value = true;
  try { officialHistory.value = await identityHttp.get('/user/official/history', { params: { userId: row.userId } }); } catch {}
}

async function saveOfficial(active) {
  if (officialBusy.value) return;
  if (active && (!officialForm.subject.trim() || !officialForm.description.trim())) {
    ElMessage.error(t('officialRequired'));
    return;
  }
  officialBusy.value = true;
  try {
    const result = await identityHttp.put('/user/official', { userId: officialTarget.value.userId, active, ...officialForm });
    // The row object comes from the page's list, so its badge updates in place.
    Object.assign(officialTarget.value, result);
    officialOpen.value = false;
    ElMessage.success(t('saveSuccessMsg'));
  } catch {} finally { officialBusy.value = false; }
}

defineExpose({ open });
</script>
