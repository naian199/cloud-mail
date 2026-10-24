<template>
  <section class="translation-settings">
    <h3>{{ t('translateTitle') }}</h3>
    <p>{{ t('translateSetupHint') }}</p>
    <el-alert
      :title="t(configured ? 'translateKeySaved' : 'translateKeyMissing')"
      :type="configured ? 'success' : 'info'"
      :closable="false"
    />
    <el-switch v-model="form.enabled" :active-text="t('translateEnabled')" />
    <el-input
      v-model="form.apiKey"
      type="password"
      show-password
      autocomplete="new-password"
      :placeholder="t('translateKey')"
      :aria-label="t('translateKey')"
    />
    <small>{{ t('translateKeyHint') }}</small>
    <el-checkbox v-model="form.clearKey" @change="clearKey">{{
      t('translateClearKey')
    }}</el-checkbox>
    <label
      >{{ t('translateUserLimit')
      }}<el-input-number
        v-model="form.userLimit"
        :min="1"
        :max="1000"
        :aria-label="t('translateUserLimit')"
    /></label>
    <label
      >{{ t('translateSiteLimit')
      }}<el-input-number
        v-model="form.siteLimit"
        :min="1000"
        :max="1000000"
        :step="1000"
        :aria-label="t('translateSiteLimit')"
    /></label>
    <el-button type="primary" :loading="saving" :disabled="loading || testing" @click="save">{{
      t('save')
    }}</el-button>
    <small>{{ t('translateTestHint') }}</small>
    <el-button :loading="testing" :disabled="loading || saving || !configured || !!form.apiKey || form.clearKey" @click="testConnection">{{ t('translateTest') }}</el-button>
    <el-alert v-if="testResult" :title="t(testResult)" :type="testResult === 'translateTestSuccess' ? 'success' : 'error'" :closable="false" role="status" />
  </section>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import http from '@/axios';
const { t } = useI18n();
const form = reactive({
  enabled: false,
  apiKey: '',
  clearKey: false,
  userLimit: 20,
  siteLimit: 50000
});
const configured = ref(false),
  saving = ref(false),
  testing = ref(false),
  testResult = ref(''),
  loading = ref(true);
function clearKey(value) {
  if (value) {
    form.enabled = false;
    form.apiKey = '';
  }
}
onMounted(async () => {
  try {
    const data = await http.get('/setting/translation');
    Object.assign(form, data);
    configured.value = data.configured;
  } catch {
  } finally {
    loading.value = false;
  }
});
async function save() {
  saving.value = true;
  testResult.value = '';
  try {
    const data = await http.put('/setting/translation', {
      enabled: form.enabled,
      apiKey: form.apiKey,
      clearKey: form.clearKey,
      userLimit: form.userLimit,
      siteLimit: form.siteLimit
    });
    configured.value = data.configured;
    form.apiKey = '';
    form.clearKey = false;
    ElMessage.success(t('saveSuccessMsg'));
  } catch {
  } finally {
    saving.value = false;
  }
}
async function testConnection() {
  testing.value = true;
  testResult.value = '';
  try {
    await http.post('/setting/translation/test', {}, { noMsg: true, timeout: 20000 });
    testResult.value = 'translateTestSuccess';
  } catch (failure) {
    testResult.value = failure?.errorKey || 'translateErrorProvider';
  } finally {
    testing.value = false;
  }
}
</script>
<style scoped>
.translation-settings {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  margin-bottom: 24px;
  min-width: 0;
}
.translation-settings p,
small {
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}
label {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.el-input {
  max-width: 520px;
}
</style>
