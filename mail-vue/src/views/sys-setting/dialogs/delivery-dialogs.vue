<template>
  <div class="setting-dialogs">
    <el-dialog
        v-model="tgSettingShow"
        class="forward-dialog"
    >
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('tgBot') }}</span>
          <el-tooltip effect="dark" :content="$t('tgBotDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <div class="forward-set-body">
        <el-input show-password autocomplete="new-password" type="password" :placeholder="setting.tgBotToken || $t('tgBotToken')" v-model="tgBotToken" @keyup.enter="tgBotSave"></el-input>
        <el-input-tag tag-type="warning" :placeholder="$t('toBotTokenDesc')" v-model="tgChatId"
                      @add-tag="addChatTag"></el-input-tag>
        <el-input tag-type="warning" :placeholder="$t('customDomainDesc')" v-model="customDomain" @keyup.enter="tgBotSave"></el-input>
        <div class="tg-msg-label">
          <span>{{t('from')}}</span>
          <el-select  v-model="tgMsgFrom" >
            <el-option
                v-for="item in tgMsgFromOption"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>
        </div>
        <div class="tg-msg-label">
          <span>{{t('recipient')}}</span>
          <el-select  v-model="tgMsgTo" >
            <el-option
                v-for="item in tgMsgToOption"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>
        </div>
        <div class="tg-msg-label">
          <span>{{t('emailText')}}</span>
          <el-select  v-model="tgMsgText" >
            <el-option
                v-for="item in tgMsgTextOption"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-switch v-model="tgBotStatus" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                     :inactive-text="$t('disable')"/>
          <el-button :loading="settingLoading" type="primary" @click="tgBotSave">
            {{ $t('save') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog
        v-model="thirdEmailShow"
        class="forward-dialog"
    >
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('otherEmail') }}</span>
          <el-tooltip effect="dark" :content="$t('otherEmailDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <div class="forward-set-body">
        <el-input-tag tag-type="warning" :placeholder="$t('otherEmailInputDesc')" v-model="forwardEmail"
                      @add-tag="emailAddTag"></el-input-tag>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-switch v-model="forwardStatus" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                     :inactive-text="$t('disable')"/>
          <el-button :loading="settingLoading" type="primary" @click="forwardEmailSave">
            {{ $t('save') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog
        v-model="webhookShow"
        class="forward-dialog"
        @closed="webhookFormatShow = false"
    >
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('webhook') }}</span>
          <el-tooltip effect="dark" :content="$t('webhookDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <div class="forward-set-body">
        <el-input :placeholder="$t('webhookUrl')" v-model="webhookUrl" @keyup.enter="webhookSave"></el-input>
        <el-input show-password autocomplete="new-password" type="password" :placeholder="$t('webhookSecret')" v-model="webhookSecret" @keyup.enter="webhookSave"></el-input>
        <div class="tg-msg-label">
          <span>{{ t('webhookRetry') }}</span>
          <el-input-number v-model="webhookRetry" :min="0" :max="5" controls-position="right"/>
        </div>
        <div v-show="webhookFormatShow" class="webhook-format">
          <pre>Content-Type: application/json
Authorization: &lt;secret&gt;</pre>
          <pre>{{ webhookPayloadExample }}</pre>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-switch v-model="webhookStatus" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                     :inactive-text="$t('disable')"/>
          <div class="webhook-footer-right">
            <div class="webhook-format-title" @click="webhookFormatShow = !webhookFormatShow">
              <span>{{ $t('webhookFormat') }}</span>
              <Icon class="webhook-format-icon" :class="{ open: webhookFormatShow }" icon="mingcute:down-small-fill" width="18" height="18"/>
            </div>
            <el-button :loading="settingLoading" type="primary" @click="webhookSave">
              {{ $t('save') }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
    <el-dialog
        v-model="forwardRulesShow"
        class="forward-dialog"
    >
      <template #header>
        <div class="forward-head">
          <span class="forward-set-title">{{ $t('forwardingRules') }}</span>
          <el-tooltip effect="dark" :content="$t('forwardingRulesDesc')">
            <Icon class="warning" icon="fe:warning" width="18" height="18"/>
          </el-tooltip>
        </div>
      </template>
      <div class="forward-set-body">
        <el-input-tag :placeholder="$t('ruleEmailsInputDesc')" tag-type="success" v-model="ruleEmail"
                      @add-tag="ruleEmailAddTag"/>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-radio-group v-model="ruleType">
            <el-radio :value="0">{{ $t('forwardAll') }}</el-radio>
            <el-radio :value="1">{{ $t('rules') }}</el-radio>
          </el-radio-group>
          <el-button :loading="settingLoading" type="primary" @click="ruleEmailSave">
            {{ $t('save') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { toOssDomain } from '@/utils/convert.js';
import { isEmail, isIpUrl } from '@/utils/verify-utils.js';
import { addTags, useSysSetting } from '../use-sys-setting.js';

const { t, locale } = useI18n();
const { setting, settingLoading, editSetting } = useSysSetting();

const tgSettingShow = ref(false);
const tgBotStatus = ref(0);
const tgBotToken = ref('');
const tgChatId = ref([]);
const customDomain = ref('');
const tgMsgFrom = ref('');
const tgMsgTo = ref('');
const tgMsgText = ref('');
const tgMsgFromOption = [{ label: t('show'), value: 'show' }, { label: t('hide'), value: 'hide' }, { label: t('onlyName'), value: 'only-name' }];
const tgMsgToOption = [{ label: t('show'), value: 'show' }, { label: t('hide'), value: 'hide' }];
const tgMsgTextOption = [{ label: t('show'), value: 'show' }, { label: t('hide'), value: 'hide' }];
const tgMsgLabelWidth = computed(() => locale.value === 'en' ? '120px' : '100px');

const thirdEmailShow = ref(false);
const forwardEmail = ref([]);
const forwardStatus = ref(0);

const webhookShow = ref(false);
const webhookUrl = ref('');
const webhookStatus = ref(1);
const webhookRetry = ref(0);
const webhookSecret = ref('');
const webhookFormatShow = ref(false);
const webhookPayloadExample = `{
  "emailId": 1,
  "sendEmail": "hello@example.com",
  "sendName": "hello",
  "toEmail": "admin@example.com",
  "toName": "admin",
  "subject": "Hello",
  "text": "Hello",
  "content": "<div>Hello</div>",
  "code": "123456",
  "createTime": "2099-12-30 23:59:59"
}`;

const forwardRulesShow = ref(false);
const ruleType = ref(0);
const ruleEmail = ref([]);

// Saves and, when the save succeeds, closes the dialog `show` controls.
async function save(form, show) {
  if (await editSetting(form)) show.value = false;
}

function openTgSetting() {
  tgBotStatus.value = setting.value.tgBotStatus;
  tgBotToken.value = '';
  customDomain.value = setting.value.customDomain;
  tgMsgFrom.value = setting.value.tgMsgFrom;
  tgMsgText.value = setting.value.tgMsgText;
  tgMsgTo.value = setting.value.tgMsgTo;
  tgChatId.value = setting.value.tgChatId ? setting.value.tgChatId.split(',') : [];
  tgSettingShow.value = true;
}

function addChatTag(val) {
  addTags(tgChatId.value, val, (id) => !isNaN(Number(id)), { skipExisting: false });
}

function tgBotSave() {
  const form = {
    customDomain: customDomain.value,
    tgBotStatus: tgBotStatus.value,
    tgChatId: tgChatId.value + '',
    tgMsgFrom: tgMsgFrom.value,
    tgMsgText: tgMsgText.value,
    tgMsgTo: tgMsgTo.value
  };
  if (tgBotToken.value) form.tgBotToken = tgBotToken.value;
  save(form, tgSettingShow);
}

function openThirdEmailSetting() {
  forwardStatus.value = setting.value.forwardStatus;
  forwardEmail.value = setting.value.forwardEmail ? setting.value.forwardEmail.split(',') : [];
  thirdEmailShow.value = true;
}

function emailAddTag(val) {
  addTags(forwardEmail.value, val, isEmail);
}

function forwardEmailSave() {
  save({ forwardStatus: forwardStatus.value, forwardEmail: forwardEmail.value + '' }, thirdEmailShow);
}

function openWebhookSetting() {
  webhookStatus.value = setting.value.webhookStatus;
  webhookUrl.value = setting.value.webhookUrl || '';
  webhookRetry.value = setting.value.webhookRetry ?? 0;
  webhookSecret.value = setting.value.webhookSecret || '';
  webhookShow.value = true;
}

function webhookSave() {
  let retry = Number(webhookRetry.value);
  if (isNaN(retry) || retry < 0) {
    retry = 0;
  }
  const url = toOssDomain(webhookUrl.value.trim());
  if (isIpUrl(url)) {
    ElMessage({ message: t('webhookIpNotSupported'), type: 'warning', plain: true });
    return;
  }
  save({
    webhookStatus: webhookStatus.value,
    webhookUrl: url,
    webhookRetry: retry,
    webhookSecret: webhookSecret.value.trim()
  }, webhookShow);
}

function openForwardRules() {
  ruleType.value = setting.value.ruleType;
  ruleEmail.value = setting.value.ruleEmail ? setting.value.ruleEmail.split(',') : [];
  forwardRulesShow.value = true;
}

function ruleEmailAddTag(val) {
  addTags(ruleEmail.value, val, isEmail);
}

function ruleEmailSave() {
  save({ ruleEmail: ruleEmail.value + '', ruleType: ruleType.value }, forwardRulesShow);
}

defineExpose({ openTgSetting, openThirdEmailSetting, openWebhookSetting, openForwardRules });
</script>

<style scoped lang="scss" src="./dialog-common.scss"></style>
<style scoped lang="scss">
.webhook-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.webhook-format-title {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  color: var(--el-color-primary);
  font-size: 13px;
}

.webhook-format-icon {
  transition: transform 0.2s;
  &.open {
    transform: rotate(180deg);
  }
}

.forward-set-body {
  display: flex;
  flex-direction: column;

  .el-switch {
    align-self: end;
  }

  > *:nth-child(-n+2) {
    margin-bottom: 15px;
  }

  .tg-msg-label {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    .el-select {
      width: v-bind(tgMsgLabelWidth);
    }
    .el-input-number {
      width: 120px;
    }
  }

  .webhook-format pre {
    margin: 8px 0 0;
    padding: 10px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    border-radius: 4px;
    background: var(--el-fill-color-light);
  }
}
</style>
