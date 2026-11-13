<template>
  <div class="settings-container">
    <div class="loading" :class="firstLoading ? 'loading-show' : 'loading-hide'">
      <loading/>
    </div>
    <el-result v-if="settingsLoadError" class="settings-load-error" icon="error" :title="t('navigationLoadFailed')" role="alert"><template #extra><el-button type="primary" @click="getSettings">{{ t('omniRetry') }}</el-button></template></el-result>
    <el-scrollbar ref="settingsScroll" class="scroll" v-if="!firstLoading && !settingsLoadError">
      <div class="scroll-body">
        <header class="settings-heading"><div class="settings-heading-copy"><span class="settings-heading-icon"><Icon icon="cloud-mail:settings" width="25" /></span><div><h1>{{ t('SystemSettings') }}</h1><p>{{ t('settingsPageDescription') }}</p></div></div><span class="settings-status" role="status"><BrandLoading v-if="settingLoading" :size="18" /><i v-else></i>{{ t(settingLoading ? 'settingsSaving' : 'settingsReady') }}</span></header>
        <div class="settings-search-row"><el-input v-model="settingsSearch" clearable :placeholder="t('settingsSearchPlaceholder')" :aria-label="t('settingsSearchPlaceholder')" @input="activeCategory='all'"><template #prefix><Icon icon="cloud-mail:search" width="18" /></template></el-input><p>{{ t('settingsSaveHint') }}</p></div>
        <div class="settings-layout">
        <nav class="settings-navigation" :aria-label="t('settingsCategories')"><button v-for="category in settingsCategories.filter(item=>item.id==='all'||categoryCount(item.id)>0)" :key="category.id" type="button" :class="{active:activeCategory===category.id}" :aria-pressed="activeCategory===category.id" @click="chooseSettingsCategory(category.id)"><Icon :icon="category.icon" width="18" /><span>{{ t(category.label) }}</span><small>{{ categoryCount(category.id) }}</small></button></nav>
        <section class="settings-workspace"><div class="settings-results-heading"><h2>{{ t(settingsCategories.find(item=>item.id===activeCategory)?.label || 'all') }}</h2><span role="status" aria-live="polite">{{ t('settingsSectionCount',{count:visibleSettingsSections.length}) }}</span></div>
        <el-empty v-if="!visibleSettingsSections.length" :description="t('settingsNoResults')"><el-button @click="chooseSettingsCategory('all')">{{ t('settingsResetFilters') }}</el-button></el-empty>
        <div class="card-grid">
          <!-- Basic Settings Card -->
          <div id="settings-basic" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='basic')" :aria-labelledby="'settings-title-basic'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:settings" width="20" /></span><div><h2 id="settings-title-basic">{{ t('websiteSetting') }}</h2><p>{{ t('settingsBasicHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('websiteReg') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('websiteReg')" v-model="setting.register"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('loginDomain') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="1" :inactive-value="0"
                             :aria-label="t('loginDomain')" v-model="setting.loginDomain"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('regKey') }}</span></div>
                <div>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ?  100 : 80 }px;`"
                      :aria-label="t('regKey')" v-model="setting.regKey"
                      placeholder="Select"
                  >
                    <el-option
                        v-for="item in regKeyOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('addAccount') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('addAccount')" v-model="setting.addEmail"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('multipleEmail') }}</span>
                  <el-tooltip effect="dark" :content="$t('multipleEmailDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('multipleEmail')" v-model="setting.manyEmail"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('syncDelete') }}</span>
                  <el-tooltip effect="dark" :content="$t('syncDeleteDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('syncDelete')" v-model="setting.syncDelete"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('emailPrefix') }}</span>
                </div>
                <div class="forward">
                  <el-button class="opt-button" :aria-label="$t('emailPrefix')" size="small" type="primary" @click="generalDialogs.openEmailPrefix()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Personalization Settings Card -->
          <div id="settings-appearance" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='appearance')" :aria-labelledby="'settings-title-appearance'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:star" width="20" /></span><div><h2 id="settings-title-appearance">{{ t('customization') }}</h2><p>{{ t('settingsAppearanceHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div class="title-item"><span>{{ $t('websiteTitle') }}</span></div>
                <div class="email-title">
                  <span>{{ setting.title }}</span>
                  <el-button class="opt-button" :aria-label="$t('websiteTitle')" size="small" type="primary" @click="generalDialogs.openTitle()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div class="title-item"><span>{{ $t('loginBoxOpacity') }}</span></div>
                <div>
                  <el-input-number size="small" v-model="loginOpacity" @change="opacityChange" :precision="2"
                                   :step="0.01" :max="1" :min="0"/>
                </div>
              </div>
              <div class="setting-item personalized">
                <div><span>{{ $t('loginBackground') }}</span></div>
                <div>
                  <el-image
                      class="background"
                      :src="cvtR2Url(setting.background)"
                      :preview-src-list="[cvtR2Url(setting.background)]"
                      show-progress
                      fit="cover"
                  >
                    <template #error>
                      <div class="error-image">
                        <Icon icon="ph:image" width="24" height="24"/>
                      </div>
                    </template>
                  </el-image>
                  <div class="background-btn">
                    <el-button class="opt-button" :aria-label="$t('loginBackground')" size="small" type="primary" @click="generalDialogs.openBackground()">
                      <Icon icon="cloud-mail:settings" width="16" height="16"/>
                    </el-button>
                    <el-button class="opt-button" :aria-label="$t('delete')" size="small" type="primary" @click="delBackground">
                      <Icon icon="material-symbols:delete-outline-rounded" width="16" height="16"/>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Email Sending Settings Card -->
          <div id="settings-mail" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='mail')" :aria-labelledby="'settings-title-mail'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:external-mail" width="20" /></span><div><h2 id="settings-title-mail">{{ t('emailSetting') }}</h2><p>{{ t('settingsMailHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('receiveEmail') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('receiveEmail')" v-model="setting.receive"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('autoRefresh') }}</span>
                  <el-tooltip effect="dark" :content="$t('autoRefreshDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      :aria-label="t('autoRefresh')" v-model="setting.autoRefresh"
                      placeholder="Select"
                  >
                    <el-option
                        v-for="item in authRefreshOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('sendEmail') }}</span></div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             :aria-label="t('sendEmail')" v-model="setting.send"/>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('noRecipientTitle') }}</span>
                  <el-tooltip effect="dark" :content="$t('noRecipientDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.noRecipient"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ setting.hasCfEmail ? $t('cloudflareEmailSending') : $t('resendToken') }}</span></div>
                <div v-if="setting.hasCfEmail">
                  <span>{{ $t('enabled') }}</span>
                </div>
                <div v-else>
                  <el-button class="opt-button" :aria-label="$t('resendToken')" style="margin-top: 0" @click="mailDialogs.openResendList()" size="small"
                             type="primary">
                    <Icon icon="ic:round-list" width="18" height="18"/>
                  </el-button>
                  <el-button class="opt-button" :aria-label="$t('add')" style="margin-top: 0" @click="mailDialogs.openResendForm()" size="small"
                             type="primary">
                    <Icon icon="material-symbols:add-rounded" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('blackList') }}</span></div>
                <div>
                  <el-button class="opt-button" :aria-label="$t('blackList')" style="margin-top: 0" @click="mailDialogs.openBlackList()" size="small"
                             type="primary">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('autoClean') }}</span>
                  <el-tooltip effect="dark" :content="$t('autoCleanDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div class="forward">
                  <span>{{ setting.autoCleanDays > 0 ? $t('autoCleanRetain', { days: setting.autoCleanDays }) : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('autoClean')" style="margin-top: 0" @click="mailDialogs.openAutoClean()" size="small"
                             type="primary">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div id="settings-delivery" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='delivery')" :aria-labelledby="'settings-title-delivery'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:send" width="20" /></span><div><h2 id="settings-title-delivery">{{ t('emailPush') }}</h2><p>{{ t('settingsDeliveryHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('tgBot') }}</span></div>
                <div class="forward">
                  <span>{{ setting.tgBotStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('tgBot')" size="small" type="primary" @click="deliveryDialogs.openTgSetting()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('otherEmail') }}</span></div>
                <div class="forward">
                  <span>{{ setting.forwardStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('otherEmail')" size="small" type="primary" @click="deliveryDialogs.openThirdEmailSetting()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('webhook') }}</span></div>
                <div class="forward">
                  <span>{{ setting.webhookStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('webhook')" size="small" type="primary" @click="deliveryDialogs.openWebhookSetting()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('forwardingRules') }}</span></div>
                <div class="forward">
                  <span>{{ setting.ruleType === 0 ? $t('forwardAll') : $t('rules') }}</span>
                  <el-button class="opt-button" :aria-label="$t('forwardingRules')" size="small" type="primary" @click="deliveryDialogs.openForwardRules()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Object Storage Card -->
          <div id="settings-storage" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='storage')" :aria-labelledby="'settings-title-storage'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:file" width="20" /></span><div><h2 id="settings-title-storage">{{ t('oss') }}</h2><p>{{ t('settingsStorageHint') }}</p></div></div>
            <div class="card-content">
              <div class="r2domain-item">
                <div>
                  <span>{{ $t('osDomain') }}</span>
                  <el-tooltip effect="dark" :content="$t('ossDomainDesc')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div class="r2domain">
                  <span>{{ setting.r2Domain || '' }}</span>
                  <el-button class="opt-button" :aria-label="$t('osDomain')" size="small" type="primary" @click="storageDialogs.openR2Domain()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('s3Configuration') }}</span>
                </div>
                <div class="r2domain">
                  <el-button class="opt-button" :aria-label="$t('s3Configuration')" size="small" type="primary" @click="storageDialogs.openS3()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('storageType') }}</span>
                </div>
                <div class="r2domain">
                  <div class="storage-type">
                    <el-tag>{{ setting.storageType }}</el-tag>
                  </div>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ t('largeAttTitle') }}</span>
                  <el-tooltip effect="dark" :content="t('largeAttHint')">
                    <Icon class="warning" icon="fe:warning" width="18" height="18"/>
                  </el-tooltip>
                </div>
                <div class="forward">
                  <span>{{ t(setting.costactionTokenSet ? 'largeAttTokenSet' : 'largeAttTokenMissing') }}</span>
                  <el-switch @change="change" :before-change="beforeChange" :active-value="0" :inactive-value="1" :aria-label="t('largeAttTitle')" v-model="setting.costactionStatus"/>
                  <el-button class="opt-button" :aria-label="t('largeAttTitle')" size="small" type="primary" @click="storageDialogs.openCostaction()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Turnstile Verification Card -->
          <div id="settings-security" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='security')" :aria-labelledby="'settings-title-security'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:lock" width="20" /></span><div><h2 id="settings-title-security">{{ t('turnstileSetting') }}</h2><p>{{ t('settingsVerificationHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('signUpVerification') }}</span></div>
                <div>
                  <el-button class="opt-button" :aria-label="$t('signUpVerification')" size="small" type="primary" @click="securityDialogs.openRegVerifyCount()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      :aria-label="t('signUpVerification')" v-model="setting.registerVerify"
                      placeholder="Select"
                      class="bot-verify-select"
                  >
                    <el-option key="1" :value="0" :label="$t('enable')"/>
                    <el-option key="1" :value="1" :label="$t('disable')"/>
                    <el-option key="1" :value="2" :label="$t('rulesVerify')"/>
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('addEmailVerification') }}</span></div>
                <div>
                  <el-button class="opt-button" :aria-label="$t('addEmailVerification')" size="small" type="primary" @click="securityDialogs.openAddVerifyCount()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                  <el-select
                      @change="change"
                      :style="`width: ${ locale === 'en' ? 100 : 80 }px;`"
                      :aria-label="t('addEmailVerification')" v-model="setting.addEmailVerify"
                      placeholder="Select"
                      class="bot-verify-select"
                  >
                    <el-option key="1" :value="0" :label="$t('enable')"/>
                    <el-option key="1" :value="1" :label="$t('disable')"/>
                    <el-option key="1" :value="2" :label="$t('rulesVerify')"/>
                  </el-select>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Site Key</span></div>
                <div class="bot-verify">
                  <span>{{ setting.siteKey }}</span>
                  <el-button class="opt-button" :aria-label="'Site Key'" size="small" type="primary" @click="securityDialogs.openTurnstile()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Secret Key</span></div>
                <div class="bot-verify">
                  <span> {{ setting.secretKey }} </span>
                  <el-button class="opt-button" :aria-label="'Secret Key'" size="small" type="primary" @click="securityDialogs.openTurnstile()">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div id="settings-notice" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='notice')" :aria-labelledby="'settings-title-notice'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:chat" width="20" /></span><div><h2 id="settings-title-notice">{{ t('noticeTitle') }}</h2><p>{{ t('settingsNoticeHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('noticePopup') }}</span></div>
                <div class="forward">
                  <span>{{ setting.notice === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('noticePopup')" size="small" type="primary" @click="noticeDialog.open()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('popUp') }}</span></div>
                <div class="forward">
                  <el-button class="opt-button" :aria-label="$t('preview')" size="small" type="primary" @click="uiStore.showNotice()">
                    <Icon icon="mynaui:click-solid" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div id="settings-ai" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='ai')" :aria-labelledby="'settings-title-ai'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:analytics" width="20" /></span><div><h2 id="settings-title-ai">{{ 'Workers AI' }}</h2><p>{{ t('settingsAiHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item">
                <div><span>{{ $t('codeRecognition') }}</span></div>
                <div>
                  <el-switch @change="changeField('aiCode', $event)" :before-change="beforeChange" :active-value="0" :inactive-value="1"
                             v-model="setting.aiCode"/>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('codeRecognitionRules') }}</span></div>
                <div class="forward">
                  <el-button class="opt-button" :aria-label="$t('codeRecognitionRules')" size="small" type="primary" @click="aiCodeDialog.open()">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- OAuth Login Card -->
          <div id="settings-oauth" class="settings-card" v-show="visibleSettingsSections.some(section=>section.id==='oauth')" :aria-labelledby="'settings-title-oauth'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:key" width="20" /></span><div><h2 id="settings-title-oauth">{{ t('oauthLogin') }}</h2><p>{{ t('settingsOauthHint') }}</p></div></div>
            <div class="card-content">
              <div class="setting-item" v-for="p in oauthPlatforms" :key="p.key">
                <div>
                  <el-avatar v-if="p.iconType === 'image'" :src="p.icon" :size="22" class="oauth-icon"/>
                  <Icon v-else :icon="p.icon" width="22" height="22" class="oauth-icon"/>
                  <span>{{ p.label }}</span>
                </div>
                <div class="forward">
                  <span>{{ setting[p.key + 'Switch'] === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="p.label" size="small" type="primary" @click="securityDialogs.openOauthSetting(p)">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <section v-if="hasPerm('setting:set')" v-show="visibleSettingsSections.some(section=>section.id==='translation')" class="settings-card settings-translation"><TranslationSettings /></section>
          <div id="settings-about" class="settings-card about" v-show="visibleSettingsSections.some(section=>section.id==='about')" :aria-labelledby="'settings-title-about'">
            <div class="card-title"><span class="settings-section-icon"><Icon icon="cloud-mail:menu" width="20" /></span><div><h2 id="settings-title-about">{{ t('about') }}</h2><p>{{ t('settingsAboutHint') }}</p></div></div>
            <div class="card-content">
              <div class="concerning-item">
                <span>{{ $t('version') }} :</span>
                <el-button tag="a" :href="projectInfo.changelog" target="_blank" rel="noopener noreferrer">v{{ projectInfo.version }}</el-button>
              </div>
              <div class="concerning-item">
                <span>GitHub :</span>
                <el-button tag="a" :href="projectInfo.repository" target="_blank" rel="noopener noreferrer">{{ projectInfo.maintainer }}/cloud-mail</el-button>
              </div>
              <div class="concerning-item">
                <span>{{ $t('help') }} :</span>
                <el-button tag="a" :href="projectInfo.documentation" target="_blank" rel="noopener noreferrer">{{ $t('document') }}</el-button>
              </div>
              <div class="concerning-item">
                <span>MIT :</span>
                <el-button tag="a" :href="projectInfo.license" target="_blank" rel="noopener noreferrer">LICENSE</el-button>
                <el-button tag="a" :href="projectInfo.notices" target="_blank" rel="noopener noreferrer">NOTICE</el-button>
              </div>
            </div>
          </div>
        </div></section></div>
      </div>

      <GeneralDialogs ref="generalDialogs" />
      <MailDialogs ref="mailDialogs" />
      <DeliveryDialogs ref="deliveryDialogs" />
      <StorageDialogs ref="storageDialogs" />
      <SecurityDialogs ref="securityDialogs" />
      <NoticeDialog ref="noticeDialog" />
      <AiCodeDialog ref="aiCodeDialog" />
    </el-scrollbar>
  </div>
</template>

<script setup>
import {computed, defineOptions, ref} from "vue";
import {deleteBackground} from "@/request/setting.js";
import {useUiStore} from "@/store/ui.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {debounce} from 'lodash-es'
import loading from "@/components/loading/index.vue";
import TranslationSettings from '@/components/translation-settings.vue';
import { hasPerm } from '@/perm/perm';
import {useI18n} from 'vue-i18n';
import { projectInfo } from '../../../../shared/project-info.mjs';
import { provideSysSetting } from './use-sys-setting.js';
import GeneralDialogs from './dialogs/general-dialogs.vue';
import MailDialogs from './dialogs/mail-dialogs.vue';
import DeliveryDialogs from './dialogs/delivery-dialogs.vue';
import StorageDialogs from './dialogs/storage-dialogs.vue';
import SecurityDialogs from './dialogs/security-dialogs.vue';
import NoticeDialog from './dialogs/notice-dialog.vue';
import AiCodeDialog from './dialogs/ai-code-dialog.vue';

defineOptions({
  name: 'sys-setting'
})

const {t, locale} = useI18n();
const settingsSearch=ref(''),activeCategory=ref('all'),settingsScroll=ref();
const settingsSections=[{"id": "basic", "category": "general", "title": "websiteSetting", "keywords": ["websiteReg", "loginDomain", "regKey", "addAccount", "multipleEmail", "syncDelete", "emailPrefix"], "description": "settingsBasicHint"}, {"id": "appearance", "category": "appearance", "title": "customization", "keywords": ["websiteTitle", "loginBoxOpacity", "loginBackground"], "description": "settingsAppearanceHint"}, {"id": "mail", "category": "mail", "title": "emailSetting", "keywords": ["receiveEmail", "autoRefresh", "sendEmail", "resendToken", "autoClean", "autoCleanTitle", "blacklist", "emailAnalysis"], "description": "settingsMailHint"}, {"id": "delivery", "category": "services", "title": "emailPush", "keywords": ["tgBot", "otherEmail", "webhook", "forwardingRules"], "description": "settingsDeliveryHint"}, {"id": "storage", "category": "services", "title": "oss", "keywords": ["osDomain", "s3Configuration", "storageType", "largeAttTitle", "Turbobit", "CostAction", "R2", "S3", "Bucket", "Endpoint", "Region", "Access Key", "Secret Key"], "description": "settingsStorageHint"}, {"id": "security", "category": "security", "title": "turnstileSetting", "keywords": ["signUpVerification", "addEmailVerification", "addTurnstileSecret", "Site Key", "Secret Key", "Cloudflare"], "description": "settingsVerificationHint"}, {"id": "notice", "category": "appearance", "title": "noticeTitle", "keywords": ["noticePopup", "noticePopupTitle", "notice"], "description": "settingsNoticeHint"}, {"id": "ai", "category": "services", "title": "Workers AI", "keywords": ["aiCode", "codeRecognitionRules", "验证码", "AI"], "description": "settingsAiHint"}, {"id": "oauth", "category": "security", "title": "oauthLogin", "keywords": ["Google", "GitHub", "LinuxDo", "clientId", "clientSecret"], "description": "settingsOauthHint"}, {"id": "about", "category": "about", "title": "about", "keywords": ["version", "documentation", "repository", "LICENSE"], "description": "settingsAboutHint"}, {"id": "translation", "category": "translation", "title": "translateTitle", "keywords": ["translateTitle", "translateKey", "translateEnabled", "API key", "translation"], "description": "translateSetupHint"}];
const settingsCategories=[
 {id:'all',label:'all',icon:'cloud-mail:menu'},
 {id:'general',label:'websiteSetting',icon:'cloud-mail:settings'},
 {id:'appearance',label:'customization',icon:'cloud-mail:star'},
 {id:'mail',label:'emailSetting',icon:'cloud-mail:external-mail'},
 {id:'security',label:'settingsSecurity',icon:'cloud-mail:lock'},
 {id:'services',label:'settingsIntegrations',icon:'cloud-mail:key'},
 {id:'translation',label:'translateTitle',icon:'cloud-mail:chat'},
 {id:'about',label:'about',icon:'cloud-mail:menu'}
];
const availableSettingsSections=computed(()=>settingsSections.filter(section=>section.id!=='translation'||hasPerm('setting:set')));
const visibleSettingsSections=computed(()=>{
 const terms=settingsSearch.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return availableSettingsSections.value.filter(section=>{
  if(activeCategory.value!=='all'&&section.category!==activeCategory.value)return false;
  const text=[section.title,section.description,...section.keywords].map(key=>t(key)).join(' ').toLocaleLowerCase();
  return terms.every(term=>text.includes(term));
 });
});
function categoryCount(id){return availableSettingsSections.value.filter(section=>id==='all'||section.category===id).length;}
function chooseSettingsCategory(id){activeCategory.value=id;settingsSearch.value='';settingsScroll.value?.setScrollTop(0);}

const uiStore = useUiStore();
const {
  setting, settingLoading, settingReady, firstLoading, settingsLoadError,
  getSettings, editSetting, beforeChange, onSettingsLoaded, onSaveFailed
} = provideSysSetting();

// Each settings section's dialogs live in their own component; the cards open them through these refs.
const generalDialogs = ref(), mailDialogs = ref(), deliveryDialogs = ref(), storageDialogs = ref();
const securityDialogs = ref(), noticeDialog = ref(), aiCodeDialog = ref();

const loginOpacity = ref(0)
onSettingsLoaded(() => { loginOpacity.value = setting.value.loginOpacity })
onSaveFailed(() => { loginOpacity.value = setting.value.loginOpacity })

const oauthPlatforms = [
  { key: 'google', label: 'Google', icon: 'devicon:google', iconType: 'iconify' },
  { key: 'github', label: 'GitHub', icon: 'codicon:github-inverted', iconType: 'iconify' },
  { key: 'linuxdo', label: 'LinuxDo', icon: '/image/linuxdo.webp', iconType: 'image' },
]

const regKeyOptions = computed(() => [
  {label: t('enable'), value: 0},
  {label: t('disable'), value: 1},
  {label: t('optional'), value: 2},
])

const authRefreshOptions = computed(() => [
  {label: t('disable'), value: 0},
  {label: '3s', value: 3},
  {label: '5s', value: 5},
  {label: '10s', value: 10},
  {label: '15s', value: 15},
  {label: '20s', value: 20},
])

getSettings()

function doOpacityChange() {
  if (!settingReady.value) return
  editSetting({loginOpacity: loginOpacity.value}, true)
}

const opacityChange = debounce(doOpacityChange, 1000, {
  leading: false,
  trailing: true
})

function delBackground() {
  ElMessageBox.confirm(t('delBackgroundConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    deleteBackground().then(() => {
      generalDialogs.value?.clearBackgroundUrl()
      setting.value.background = null
      ElMessage({
        message: t('delSuccessMsg'),
        type: "success",
        plain: true
      })
    })
  })
}

// Switches save the whole visible settings object, without secrets the page never holds.
function change() {
  if (!settingReady.value) return
  const settingForm = {...setting.value}
  delete settingForm.siteKey
  delete settingForm.secretKey
  delete settingForm.s3AccessKey
  delete settingForm.s3SecretKey
  delete settingForm.tgBotToken
  delete settingForm.resendTokens
  editSetting(settingForm, false)
}

function changeField(key, value) {
  if (!settingReady.value) return
  setting.value[key] = value
  editSetting({[key]: value}, false)
}
</script>

<style scoped lang="scss">
.settings-container {
  height: 100%;
  overflow: hidden;
  background: var(--settings-page-background) !important;
  position: relative;

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    z-index: 2;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  .loading-show {
    transition: all 200ms ease 200ms;
    opacity: 1;
  }

  .loading-hide {
    transition: var(--loading-hide-transition);
    pointer-events: none;
    opacity: 0;
  }
}

.scroll {
  width: 100%;
  min-height: 100%;

  :deep(.el-scrollbar__view) {
    height: 100%;
  }

  .scroll-body {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
}

.card-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  gap: 20px;
  @media (max-width: 1023px) {
    gap: 15px;
    padding: 15px;
  }
}

.background {
  width: 249px;
  height: 140px;
  border-radius: 4px;
  border: 1px solid var(--light-border);
  @media (max-width: 500px) {
    width: 160px;
    height: 90px;
  }
}

.background-btn {
  display: flex;
  gap: 10px;
  flex-direction: column;
}

.bot-verify-select {
  margin-left: 10px;
}

.settings-card {
  background-color: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  transition: all 300ms;
  overflow: hidden;
  max-width: 900px;
  width: 100%;
}


.card-title {
  font-size: 15px;
  font-weight: bold;
  padding: 15px 20px 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.card-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  font-weight: normal;

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  > div:last-child {
    display: grid;
    grid-template-columns: 1fr auto;
    justify-items: flex-end;
    font-weight: normal;
  }
}

.oauth-icon {
  width: 22px !important;
  height: 22px !important;
  min-width: 22px;
  flex-shrink: 0;
  margin-right: 2px;
}

.r2domain-item {
  display: flex;
  gap: 10px;
  > div:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  > div:last-child {
    flex: 1;
    text-align: right;
  }
}

.warning {
  margin-left: 2px;
  color: grey;
  cursor: pointer;
}

.error-image {
  background: var(--light-ill);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.bot-verify {
  display: grid;
  grid-template-columns: 1fr auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  span {
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.forward {
  span {
    display: flex;
    align-items: center;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.opt-button {
  width: fit-content !important;
}

.r2domain {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;

  .storage-type {
    margin-right: 3px;
  }

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .el-button {
    width: 48px;
    margin: 0 0 0 10px;
  }
}

.personalized {
  align-items: start;

  > div:last-child {
    display: flex;
    justify-content: end;

    .el-button {
      margin-left: 10px;
      margin-top: 0;
    }
  }
}

.concerning-item {
  display: flex;
  align-items: center;

  :deep(.el-button) {
    padding: 0 10px;
    font-weight: normal;

    i {
      font-size: 22px;
    }
  }

  > span:first-child {
    font-weight: normal;
    padding-right: 20px;
    white-space: nowrap;
  }
}

.email-title {
  font-weight: normal !important;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr auto;
  align-items: center;

  span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .el-button {
    margin-top: 0;
  }
}

.token-item {
  padding-top: 0;

  div:last-child {
    font-weight: normal;
  }
}

.el-switch {
  height: 28px;
}


:deep(.el-button--small) {
  margin-top: 2px !important;
  margin-bottom: 2px !important;
  height: 24px;
}

:deep(.el-select__wrapper) {
  min-height: 28px;
}

</style>

<style>
.el-popper.is-dark {
}
</style>

<style scoped>
.settings-container{background:var(--el-fill-color-lighter)!important;}.settings-load-error{margin:24px auto;max-width:600px;}
.scroll{height:100%;min-height:0;}.scroll :deep(.el-scrollbar__view){height:auto;min-height:100%;}.scroll .scroll-body{display:block;box-sizing:border-box;min-height:100%;max-width:1440px;padding:30px 36px 56px;margin-inline:auto;}
.settings-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;}.settings-heading-copy{display:flex;align-items:center;gap:14px;min-width:0;}.settings-heading-icon{display:grid;place-items:center;width:48px;height:48px;flex-shrink:0;background:var(--el-color-primary-light-9);color:var(--el-color-primary);border:1px solid var(--el-color-primary-light-8);border-radius:14px;}.settings-heading h1{font-size:25px;line-height:1.3;letter-spacing:-.5px;margin:0;color:var(--el-text-color-primary);}.settings-heading p{font-size:13px;line-height:1.6;margin:6px 0 0;color:var(--el-text-color-secondary);}.settings-status{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--el-text-color-secondary);white-space:nowrap;}.settings-status i{width:6px;height:6px;border-radius:50%;background:var(--el-color-success);}
.settings-search-row{display:flex;align-items:center;gap:24px;margin-bottom:28px;}.settings-search-row>.el-input{width:360px;max-width:100%;flex-shrink:0;height:42px;}.settings-search-row :deep(.el-input__wrapper){border-radius:10px;}.settings-search-row p{color:var(--el-text-color-secondary);font-size:12px;line-height:1.65;margin:0;max-width:600px;}
.settings-layout{display:grid;grid-template-columns:182px minmax(0,1fr);gap:30px;align-items:start;}.settings-navigation{position:sticky;top:18px;display:flex;flex-direction:column;gap:5px;min-width:0;}.settings-navigation button{display:flex;align-items:center;gap:10px;min-height:42px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:none;color:var(--el-text-color-regular);font:inherit;font-size:13px;text-align:start;cursor:pointer;}.settings-navigation button svg{flex-shrink:0;}.settings-navigation button small{margin-inline-start:auto;font-size:11px;color:var(--el-text-color-secondary);}.settings-navigation button:hover{background:var(--el-fill-color);}.settings-navigation button.active{background:var(--el-color-primary-light-9);border-color:var(--el-color-primary-light-8);color:var(--el-color-primary);font-weight:600;}.settings-navigation button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px;}
.settings-workspace{min-width:0;}.settings-results-heading{display:flex;align-items:center;justify-content:space-between;margin:2px 0 16px;gap:16px;}.settings-results-heading h2{font-size:15px;margin:0;font-weight:600;color:var(--el-text-color-primary);}.settings-results-heading>span{font-size:12px;color:var(--el-text-color-secondary);}
.card-grid{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;gap:20px;padding:0;}.settings-card{width:100%;max-width:none;min-width:0;box-sizing:border-box;background:var(--el-bg-color);border:1px solid var(--el-border-color-lighter);border-radius:16px;box-shadow:0 3px 14px #00000002;transition:none;}.card-title{display:flex;align-items:flex-start;gap:12px;padding:22px 24px 18px;border-bottom:1px solid var(--el-border-color-extra-light);}.settings-section-icon{display:grid;place-items:center;flex-shrink:0;width:32px;height:32px;background:var(--el-fill-color-light);color:var(--el-text-color-regular);border-radius:9px;}.card-title h2{margin:0;font-size:15px;font-weight:600;line-height:1.5;color:var(--el-text-color-primary);}.card-title p{margin:4px 0 0;font-size:12px;font-weight:400;line-height:1.65;color:var(--el-text-color-secondary);}.card-content{padding:8px 24px 16px;gap:0;}.settings-card .setting-item,.settings-card .r2domain-item{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:54px;padding:12px 0;box-sizing:border-box;border-bottom:1px solid var(--el-border-color-extra-light);font-size:13px;}.settings-card .setting-item:last-child,.settings-card .r2domain-item:last-child{border-bottom:0;}.settings-card .setting-item>div:first-child,.settings-card .r2domain-item>div:first-child{min-width:0;line-height:1.65;color:var(--el-text-color-regular);max-width:60%;overflow-wrap:anywhere;}.settings-card .setting-item>div:last-child{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;max-width:68%;flex-shrink:0;font-size:12px;}.settings-card .setting-item>div:last-child>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px;}.settings-card .r2domain-item>div:last-child{min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px;}.settings-card .r2domain-item>div:last-child>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.settings-card .opt-button{height:32px;min-width:32px;padding:6px;border-radius:8px;background:var(--el-fill-color-light);border-color:var(--el-border-color-light);color:var(--el-text-color-regular);margin:0!important;flex-shrink:0;box-shadow:none;}.settings-card .opt-button:hover{color:var(--el-color-primary);border-color:var(--el-color-primary-light-5);background:var(--el-color-primary-light-9);}.settings-card .background{width:160px;height:90px;border-radius:8px;}.settings-card .background-btn{gap:8px;}.settings-card .bot-verify-select{margin-left:0;}.settings-card :deep(.el-switch){--el-switch-on-color:var(--el-color-primary);}.settings-card :deep(.el-input-number){max-width:120px;}.settings-card :deep(.el-select__wrapper){border-radius:8px;}.settings-card.about{grid-column:1/-1;}.settings-translation{grid-column:1/-1;}.settings-translation :deep(.translation-settings){margin:0;border:0;border-radius:16px;background:var(--el-bg-color);padding:24px;}.settings-translation :deep(h3){margin:0;font-size:15px;}.settings-translation :deep(.el-input){width:100%;}.settings-workspace>.el-empty{background:var(--el-bg-color);border:1px dashed var(--el-border-color);border-radius:16px;margin-bottom:20px;}
@media(min-width:1250px){.card-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:1024px){.scroll .scroll-body{padding:24px;}.settings-layout{grid-template-columns:160px minmax(0,1fr);gap:20px;}.settings-search-row{align-items:flex-start;gap:18px;}.settings-search-row>.el-input{width:310px;}}
@media(max-width:767px){.scroll .scroll-body{padding:20px 14px 32px;}.settings-heading{gap:10px;margin-bottom:20px;}.settings-heading h1{font-size:22px;}.settings-heading p{font-size:12px;}.settings-heading-icon{width:40px;height:40px;border-radius:12px;}.settings-status{font-size:11px;}.settings-heading-copy{gap:10px;}.settings-search-row{display:block;margin-bottom:18px;}.settings-search-row>.el-input{width:100%;height:44px;}.settings-search-row p{margin-top:10px;font-size:11px;}.settings-layout{display:block;}.settings-navigation{position:relative;top:auto;display:flex;flex-direction:row;overflow-x:auto;gap:6px;margin:0 -2px 20px;padding:2px 2px 8px;overscroll-behavior-inline:contain;}.settings-navigation button{flex-shrink:0;min-height:40px;padding:9px 12px;font-size:12px;gap:7px;white-space:nowrap;}.settings-navigation button small{display:none;}.settings-navigation button svg{width:16px;height:16px;}.card-grid{gap:16px;}.card-title{padding:18px 18px 16px;gap:10px;}.card-content{padding:4px 18px 12px;}.settings-card .setting-item,.settings-card .r2domain-item{gap:10px;font-size:12px;}.settings-card .setting-item>div:last-child{max-width:66%;gap:6px;}.settings-card .setting-item>div:last-child>span{max-width:140px;}.settings-card .background{width:126px;height:72px;}.settings-translation :deep(.translation-settings){padding:18px;}.settings-status{align-self:flex-start;margin-top:5px;}}
@media(max-width:360px){.settings-heading{flex-wrap:wrap;}.settings-status{margin-inline-start:50px;margin-top:-8px;}.settings-card .setting-item>div:last-child{max-width:62%;}.settings-card .background{width:110px;height:64px;}}
</style>
