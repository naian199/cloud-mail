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
                  <el-button class="opt-button" :aria-label="$t('emailPrefix')" size="small" type="primary" @click="openEmailPrefix">
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
                  <el-button class="opt-button" :aria-label="$t('websiteTitle')" size="small" type="primary" @click="editTitleShow = true">
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
                    <el-button class="opt-button" :aria-label="$t('loginBackground')" size="small" type="primary" @click="openSetBackground">
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
                  <el-button class="opt-button" :aria-label="$t('resendToken')" style="margin-top: 0" @click="openResendList" size="small"
                             type="primary">
                    <Icon icon="ic:round-list" width="18" height="18"/>
                  </el-button>
                  <el-button class="opt-button" :aria-label="$t('add')" style="margin-top: 0" @click="openResendForm" size="small"
                             type="primary">
                    <Icon icon="material-symbols:add-rounded" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('blackList') }}</span></div>
                <div>
                  <el-button class="opt-button" :aria-label="$t('blackList')" style="margin-top: 0" @click="openBlackListForm" size="small"
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
                  <el-button class="opt-button" :aria-label="$t('autoClean')" style="margin-top: 0" @click="openAutoClean" size="small"
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
                  <el-button class="opt-button" :aria-label="$t('tgBot')" size="small" type="primary" @click="openTgSetting">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('otherEmail') }}</span></div>
                <div class="forward">
                  <span>{{ setting.forwardStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('otherEmail')" size="small" type="primary" @click="openThirdEmailSetting">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('webhook') }}</span></div>
                <div class="forward">
                  <span>{{ setting.webhookStatus === 0 ? $t('enabled') : $t('disabled') }}</span>
                  <el-button class="opt-button" :aria-label="$t('webhook')" size="small" type="primary" @click="openWebhookSetting">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('forwardingRules') }}</span></div>
                <div class="forward">
                  <span>{{ setting.ruleType === 0 ? $t('forwardAll') : $t('rules') }}</span>
                  <el-button class="opt-button" :aria-label="$t('forwardingRules')" size="small" type="primary" @click="openForwardRules">
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
                  <el-button class="opt-button" :aria-label="$t('osDomain')" size="small" type="primary" @click="r2DomainShow = true">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div>
                  <span>{{ $t('s3Configuration') }}</span>
                </div>
                <div class="r2domain">
                  <el-button class="opt-button" :aria-label="$t('s3Configuration')" size="small" type="primary" @click="addS3Show = true">
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
                  <el-button class="opt-button" :aria-label="t('largeAttTitle')" size="small" type="primary" @click="openCostaction">
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
                  <el-button class="opt-button" :aria-label="$t('signUpVerification')" size="small" type="primary" @click="openRegVerifyCount">
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
                  <el-button class="opt-button" :aria-label="$t('addEmailVerification')" size="small" type="primary" @click="openAddVerifyCount">
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
                  <el-button class="opt-button" :aria-label="'Site Key'" size="small" type="primary" @click="turnstileShow = true">
                    <Icon icon="cloud-mail:settings" width="16" height="16"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>Secret Key</span></div>
                <div class="bot-verify">
                  <span> {{ setting.secretKey }} </span>
                  <el-button class="opt-button" :aria-label="'Secret Key'" size="small" type="primary" @click="turnstileShow = true">
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
                  <el-button class="opt-button" :aria-label="$t('noticePopup')" size="small" type="primary" @click="openNoticePopupSetting">
                    <Icon icon="cloud-mail:settings" width="18" height="18"/>
                  </el-button>
                </div>
              </div>
              <div class="setting-item">
                <div><span>{{ $t('popUp') }}</span></div>
                <div class="forward">
                  <el-button class="opt-button" :aria-label="$t('preview')" size="small" type="primary" @click="openNoticePopup">
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
                  <el-button class="opt-button" :aria-label="$t('codeRecognitionRules')" size="small" type="primary" @click="openAiCodeFilter">
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
                  <el-button class="opt-button" :aria-label="p.label" size="small" type="primary" @click="openOauthSetting(p)">
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

      <!-- Dialogs remain the same -->
      <el-dialog v-model="editTitleShow" :title="$t('changeTitle')" width="340" @closed="editTitle = setting.title">
        <form @submit.prevent>
          <el-input type="text" :placeholder="$t('websiteTitle')" v-model="editTitle" @keyup.enter="saveTitle"/>
          <el-button type="primary" :loading="settingLoading" @click="saveTitle">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="resendTokenFormShow" :title="$t('resendToken')" width="340" @closed="cleanResendTokenForm">
        <form @submit.prevent>
          <el-select style="margin-bottom: 15px" v-model="resendTokenForm.domain" placeholder="Select">
            <el-option
                v-for="item in settingStore.domainList"
                :key="item"
                :label="item"
                :value="item"
            />
          </el-select>
          <el-input show-password autocomplete="new-password" type="password" :placeholder="$t('addResendTokenDesc')" v-model="resendTokenForm.token" @keyup.enter="saveResendToken"/>
          <el-button type="primary" :loading="settingLoading" @click="saveResendToken">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="r2DomainShow" :title="$t('addOsDomain')" width="340"
                 @closed="r2DomainInput = setting.r2Domain">
        <form @submit.prevent>
          <el-input type="text" :placeholder="$t('domainDesc')" v-model="r2DomainInput" @keyup.enter="saveR2domain"/>
          <el-button type="primary" :loading="settingLoading" @click="saveR2domain">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="turnstileShow" :title="$t('addTurnstileSecret')" width="340"
                 @closed="turnstileForm.secretKey = '';turnstileForm.siteKey = ''">
        <form @submit.prevent>
          <el-input type="text" placeholder="Site Key" v-model="turnstileForm.siteKey" @keyup.enter="saveTurnstileKey"/>
          <el-input show-password autocomplete="new-password" type="password" style="margin-top: 15px" placeholder="Secret Key" v-model="turnstileForm.secretKey" @keyup.enter="saveTurnstileKey"/>
          <el-button type="primary" :loading="settingLoading" @click="saveTurnstileKey">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="oauthSettingShow" :title="$t('oauthSetting') + ' - ' + oauthForm.label" width="340"
                 @closed="oauthForm.clientId = ''; oauthForm.clientSecret = ''; oauthForm.switch = 1">
        <div class="dialog-content">
          <el-input type="text" :placeholder="$t('clientId')" v-model="oauthForm.clientId"/>
          <el-input show-password autocomplete="new-password" type="password" style="margin-top: 15px" :placeholder="$t('clientSecret')" v-model="oauthForm.clientSecret"/>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-switch v-model="oauthForm.switch" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                       :inactive-text="$t('disable')"/>
            <el-button type="primary" :loading="settingLoading" @click="saveOauth">{{ $t('save') }}</el-button>
          </div>
        </template>
      </el-dialog>
      <el-dialog
          v-model="showSetBackground"
          class="cut-dialog"
          @closed="closedSetBackground"
      >
        <template #header>
          <span style="font-size: 18px">
            {{ $t('backgroundTitle') }}
            <el-tooltip>
              <template #content>
                <span>{{ $t('backgroundWarning') }}</span>
              </template>
              <Icon class="title-icon  warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </span>
        </template>
        <el-input :placeholder="$t('backgroundUrlDesc')" v-model="backgroundUrl" v-if="!localUpShow"
                  class="background-url" @keyup.enter="saveBackground"/>
        <el-image
            v-if="localUpShow"
            :preview-src-list="[backgroundImage]"
            show-progress
            class="cropper"
            fit="cover"
            :src="backgroundImage"
        ></el-image>
        <div class="cut-button">
          <el-button type="primary" link @click="openCut" v-if="!localUpShow">
            {{ $t('localUpload') }}
          </el-button>
          <el-button type="primary" link @click="localUpShow = false" v-if="localUpShow">
            {{ $t('imageLink') }}
          </el-button>
          <el-button type="primary" :loading="settingLoading" @click="saveBackground">{{ $t('save') }}</el-button>
        </div>
      </el-dialog>
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
      <el-dialog class="resend-table" v-model="showResendList" :title="$t('resendTokenList')">
        <el-table :data="resendList">
          <el-table-column :min-width="emailColumnWidth" property="key" :label="$t('domain')"
                           :show-overflow-tooltip="true"/>
          <el-table-column :width="tokenColumnWidth" property="value" label="Token" fixed="right"
                           :show-overflow-tooltip="true"/>
        </el-table>
      </el-dialog>
      <el-dialog v-model="regVerifyCountShow" :title="$t('rulesVerifyTitle',{count: regVerifyCount})"
                 @closed="regVerifyCount = setting.regVerifyCount">
        <form @submit.prevent>
          <el-input-number type="text" v-model="regVerifyCount" :min="1" @keyup.enter="saveRegVerifyCount">
          </el-input-number>
          <el-button type="primary" :loading="settingLoading" @click="saveRegVerifyCount">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="addVerifyCountShow" :title="$t('rulesVerifyTitle',{count: addVerifyCount})"
                 @closed="addVerifyCount = setting.addVerifyCount">
        <form @submit.prevent>
          <el-input-number type="text" v-model="addVerifyCount" :min="1" @keyup.enter="saveAddVerifyCount"/>
          <el-button type="primary" :loading="settingLoading" @click="saveAddVerifyCount">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog top="5vh" v-model="noticePopupShow" :title="$t('noticePopup')" class="notice-popup"
                 @closed="resetNoticeForm">
        <form @submit.prevent>
          <el-input v-model="noticeForm.noticeTitle" :placeholder="t('titleDesc')" @keyup.enter="saveNoticePopup"/>
          <div class="notice-line-item">
            <el-select v-model="noticeForm.noticeType">
              <template #prefix>
                <span style="margin-right: 10px">{{ $t('icon') }}</span>
              </template>
              <el-option key="none" label="None" value="none"/>
              <el-option key="primary" label="Primary" value="primary"/>
              <el-option key="success" label="Success" value="success"/>
              <el-option key="warning" label="Warning" value="warning"/>
              <el-option key="info" label="Info" value="info"/>
            </el-select>
            <el-select v-model="noticeForm.noticePosition">
              <template #prefix>
                <span style="margin-right: 10px">{{ $t('position') }}</span>
              </template>
              <el-option key="top-left" :label="t('topLeft')" value="top-left"/>
              <el-option key="top-right" :label="t('topRight')" value="top-right"/>
              <el-option key="bottom-left" :label="t('bottomLeft')" value="bottom-left"/>
              <el-option key="bottom-right" :label="t('bottomRight')" value="bottom-right"/>
            </el-select>
            <el-input-number v-model="noticeForm.noticeWidth">
              <template #prefix>
                {{ $t('width') }}
              </template>
              <template #suffix>
                px
              </template>
            </el-input-number>
            <el-input-number v-model="noticeForm.noticeOffset">
              <template #prefix>
                {{ $t('offset') }}
              </template>
              <template #suffix>
                px
              </template>
            </el-input-number>
            <el-input-number v-model="noticeForm.noticeDuration">
              <template #prefix>
                {{ $t('duration') }}
              </template>
              <template #suffix>
                ms
              </template>
            </el-input-number>
          </div>
          <div class="notice-popup-item">
            <el-input
                v-model="noticeForm.noticeContent"
                :autosize="{ minRows: 15, maxRows: 25 }"
                type="textarea"
                :placeholder="t('noticeContentDesc')"
            />
          </div>
        </form>
        <template #footer>
          <div class="dialog-footer">
            <el-switch v-model="noticeForm.notice" :active-value="0" :inactive-value="1" :active-text="$t('enable')"
                       :inactive-text="$t('disable')"/>
            <div>
              <el-button @click="previewNoticePopup">
                {{ $t('preview') }}
              </el-button>
              <el-button :loading="settingLoading" type="primary" @click="saveNoticePopup">
                {{ $t('save') }}
              </el-button>
            </div>
          </div>
        </template>
      </el-dialog>
      <el-dialog v-model="addS3Show" :title="t('s3Configuration')" width="340" @closed="resetAddS3Form">
        <form @submit.prevent>
          <el-input class="dialog-input" type="text" placeholder="Bucket" v-model="s3.bucket" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" placeholder="Endpoint" v-model="s3.endpoint" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" placeholder="Region" v-model="s3.region" @keyup.enter="saveS3"/>
          <el-input class="dialog-input" type="text" :placeholder="setting.s3AccessKey || 'Access Key'"
                    v-model="s3.s3AccessKey" @keyup.enter="saveS3"/>
          <el-input show-password autocomplete="new-password" style="margin-bottom: 10px" type="password" :placeholder="setting.s3SecretKey || 'Secret Key'" v-model="s3.s3SecretKey" @keyup.enter="saveS3"/>
          <div class="force-path-style">
            <div class="force-path-style-left">
              <span>ForcePathStyle</span>
              <el-tooltip effect="dark" :content="$t('forcePathStyleDesc')">
                <Icon class="warning" icon="fe:warning" width="18" height="18"/>
              </el-tooltip>
            </div>
            <el-switch :before-change="beforeChange" :active-value="0" :inactive-value="1"
                       v-model="s3.forcePathStyle"/>
          </div>
          <div class="s3-button">
            <el-button :loading="clearS3Loading" @click="clearS3">{{ t('clear') }}</el-button>
            <el-button type="primary" :loading="settingLoading && !clearS3Loading" @click="saveS3">{{ t('save') }}</el-button>
          </div>
        </form>
      </el-dialog>
      <el-dialog v-model="emailPrefixShow" :title="t('emailPrefix')"  @closed="resetEmailPrefix"  >
        <div class="email-prefix">
          <div>{{ t('atLeast') }}</div>
          <el-input-number v-model="minEmailPrefix" :min="1" :max="20" style="width: 150px" @keyup.enter="saveEmailPrefix" >
            <template #suffix>
              <span>{{ t('character') }}</span>
            </template>
          </el-input-number>
        </div>
        <div class="prefix-filter">
          <div style="margin-bottom: 10px;">{{ t('mustNotContain') }}</div>
          <el-input-tag style="margin-bottom: 10px;" v-model="emailPrefixFilter"  />
        </div>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveEmailPrefix">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="blackFormShow" class="forward-dialog" @closed="resetBlackList">
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('blackList') }}</span>
            <el-tooltip effect="dark" :content="$t('blackListDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <el-form>
          <el-form-item :label="t('blackFromDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackFrom" @add-tag="banEmailAddTag"  />
          </el-form-item>
          <el-form-item :label="t('blackSubjectDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackSubject"/>
          </el-form-item>
          <el-form-item :label="t('blackContentDesc')" label-position="top">
            <el-input-tag v-model="blackListForm.blackContent"/>
          </el-form-item>
        </el-form>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveBlackList">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="autoCleanShow" :title="t('autoClean')" class="forward-dialog" @closed="resetAutoClean">
        <el-form>
          <el-form-item :label="t('autoCleanDays')" label-position="top">
            <el-input-number v-model="autoCleanDays" :min="0" :max="3650" style="width: 100%"/>
          </el-form-item>
          <el-form-item :label="t('autoCleanExclude')" label-position="top">
            <el-input-tag
                tag-type="warning"
                :placeholder="$t('autoCleanExcludeDesc')"
                v-model="autoCleanExclude"
                @add-tag="autoCleanExcludeAddTag"
            />
          </el-form-item>
        </el-form>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveAutoClean">{{ $t('save') }}</el-button>
      </el-dialog>
      <el-dialog v-model="costactionShow" :title="t('largeAttTitle')" class="forward-dialog" @closed="costactionForm.token = ''; costactionResult = ''">
        <form class="costaction-form" @submit.prevent="saveCostaction">
          <p class="costaction-note">{{ t('largeAttNote') }}</p>
          <el-input v-model="costactionForm.token" show-password autocomplete="new-password" type="password"
                    :placeholder="t(setting.costactionTokenSet ? 'largeAttTokenKeep' : 'largeAttTokenPlaceholder')" :aria-label="t('largeAttToken')"/>
          <div class="costaction-actions">
            <el-button :loading="costactionTesting" @click="testCostaction">{{ t('largeAttTest') }}</el-button>
            <el-button v-if="setting.costactionTokenSet" text type="danger" @click="clearCostactionToken">{{ t('largeAttTokenClear') }}</el-button>
            <span v-if="costactionResult" role="status" :class="costactionResult">{{ t(costactionResult === 'ok' ? 'largeAttTestOk' : 'largeAttTestFailed') }}</span>
          </div>
          <label class="costaction-field"><span>{{ t('largeAttMinSize') }}</span><el-input-number v-model="costactionForm.minMb" :min="1" :max="10240"><template #suffix>MB</template></el-input-number></label>
          <label class="costaction-field"><span>{{ t('largeAttMaxSize') }}</span><el-input-number v-model="costactionForm.maxMb" :min="1" :max="10240"><template #suffix>MB</template></el-input-number></label>
          <label class="costaction-field"><span>{{ t('largeAttRoles') }}</span>
            <el-select v-model="costactionForm.roles" multiple :placeholder="t('largeAttRolesAdmin')">
              <el-option v-for="role in costactionRoles" :key="role.roleId" :label="role.name" :value="role.roleId"/>
            </el-select>
          </label>
          <el-button type="primary" native-type="submit" :loading="settingLoading">{{ $t('save') }}</el-button>
        </form>
      </el-dialog>
      <el-dialog v-model="aiCodeFilterShow" class="forward-dialog" @closed="resetAiCodeFilter">
        <template #header>
          <div class="forward-head">
            <span class="forward-set-title">{{ $t('codeRecognitionRules') }}</span>
            <el-tooltip effect="dark" :content="$t('codeRecognitionRulesDesc')">
              <Icon class="warning" icon="fe:warning" width="18" height="18"/>
            </el-tooltip>
          </div>
        </template>
        <el-form>
          <el-form-item :label="t('senderRules')" label-position="top">
            <el-input-tag v-model="aiCodeFilter" @add-tag="aiCodeFilterAddTag"/>
          </el-form-item>
        </el-form>
        <el-button type="primary" style="width: 100%;" :loading="settingLoading" @click="saveAiCodeFilter">{{ $t('save') }}</el-button>
      </el-dialog>
    </el-scrollbar>
  </div>
</template>

<script setup>
import {computed, defineOptions, nextTick, reactive, ref} from "vue";
import {deleteBackground, setBackground, setBlackList, settingQuery, settingSet} from "@/request/setting.js";
import {costactionTest} from "@/request/large-att.js";
import {roleSelectUse} from "@/request/role.js";
import {useSettingStore} from "@/store/setting.js";
import {useUiStore} from "@/store/ui.js";
import {useUserStore} from "@/store/user.js";
import {useAccountStore} from "@/store/account.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url, toOssDomain} from "@/utils/convert.js";
import {storeToRefs} from "pinia";
import {debounce} from 'lodash-es'
import {isDomain, isEmail, isIpUrl} from "@/utils/verify-utils.js";
import loading from "@/components/loading/index.vue";
import TranslationSettings from '@/components/translation-settings.vue';
import { hasPerm } from '@/perm/perm';
import {getTextWidth} from "@/utils/text.js";
import {fileToBase64} from "@/utils/file-utils.js"
import {useI18n} from 'vue-i18n';
import { projectInfo } from '../../../../shared/project-info.mjs';

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

const settingsLoadError=ref(false)
const firstLoading = ref(true)
const settingReady = ref(false)
const backgroundImage = ref('')
const localUpShow = ref(false)
const accountStore = useAccountStore();
const userStore = useUserStore();
const editTitleShow = ref(false)
const resendTokenFormShow = ref(false)
const blackFormShow = ref(false)
const autoCleanShow = ref(false)
const aiCodeFilterShow = ref(false)
const r2DomainShow = ref(false)
const turnstileShow = ref(false)
const tgSettingShow = ref(false)
const noticePopupShow = ref(false)
const thirdEmailShow = ref(false)
const webhookShow = ref(false)
const forwardRulesShow = ref(false)
const emailPrefixShow = ref(false)
const showResendList = ref(false)
const settingStore = useSettingStore();
const uiStore = useUiStore();
const {settings: setting} = storeToRefs(settingStore);
const editTitle = ref('')
const settingLoading = ref(false)
const clearS3Loading = ref(false)
const r2DomainInput = ref('')
const loginOpacity = ref(0)
const minEmailPrefix = ref(0)
const emailPrefixFilter = ref([])
const autoCleanDays = ref(0)
const autoCleanExclude = ref([])
const backgroundUrl = ref('')
let backgroundFile = {}
const showSetBackground = ref(false)
let regVerifyCount = ref(1)
let addVerifyCount = ref(1)
let backup = '{}'
const addS3Show = ref(false)
const addVerifyCountShow = ref(false)
const regVerifyCountShow = ref(false)
const resendTokenForm = reactive({
  domain: '',
  token: '',
})
const turnstileForm = reactive({
  siteKey: '',
  secretKey: ''
})

const oauthPlatforms = [
  { key: 'google', label: 'Google', icon: 'devicon:google', iconType: 'iconify' },
  { key: 'github', label: 'GitHub', icon: 'codicon:github-inverted', iconType: 'iconify' },
  { key: 'linuxdo', label: 'LinuxDo', icon: '/image/linuxdo.webp', iconType: 'image' },
]
const oauthSettingShow = ref(false)
// Large attachments (CostAction/Turbobit). The token is write-only: the page only learns whether one is saved.
const MB = 1024 * 1024
const costactionShow = ref(false), costactionTesting = ref(false), costactionResult = ref(''), costactionRoles = ref([])
const costactionForm = reactive({ token: '', minMb: 10, maxMb: 100, roles: [] })
const oauthForm = reactive({
  key: '',
  label: '',
  clientId: '',
  clientSecret: '',
  switch: 1,
})

const s3 = reactive({
  bucket: '',
  endpoint: '',
  region: '',
  s3AccessKey: '',
  s3SecretKey: '',
  forcePathStyle: 1
})

const noticeForm = reactive({
  noticeTitle: '',
  noticeContent: '',
  noticeType: '',
  noticeDuration: '',
  noticePosition: '',
  noticeOffset: 0,
  notice: 0,
  noticeWidth: 0
})

const regKeyOptions = computed(() => [
  {label: t('enable'), value: 0},
  {label: t('disable'), value: 1},
  {label: t('optional'), value: 2},
])

const blackListForm = ref({
  blackSubject: [],
  blackContent: [],
  blackFrom: []
})
const aiCodeFilter = ref([])

const authRefreshOptions = computed(() => [
  {label: t('disable'), value: 0},
  {label: '3s', value: 3},
  {label: '5s', value: 5},
  {label: '10s', value: 10},
  {label: '15s', value: 15},
  {label: '20s', value: 20},
])

const tgChatId = ref([])
const customDomain = ref('')
const tgBotStatus = ref(0)
const tgBotToken = ref('')
const forwardEmail = ref([])
const forwardStatus = ref(0)
const webhookUrl = ref('')
const webhookStatus = ref(1)
const webhookRetry = ref(0)
const webhookSecret = ref('')
const webhookFormatShow = ref(false)
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
}`
const emailColumnWidth = ref(0)
const tokenColumnWidth = ref(0)
const ruleType = ref(0)
const ruleEmail = ref([])
const tgMsgFrom = ref('')
const tgMsgTo = ref('')
const tgMsgText = ref('')

const tgMsgFromOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}, {label: t('onlyName'), value:'only-name'}]
const tgMsgToOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}]
const tgMsgTextOption = [{label: t('show'), value: 'show'}, {label: t('hide'), value: 'hide'}]
const tgMsgLabelWidth = computed(() => locale.value === 'en' ? '120px' : '100px');

getSettings()

function getSettings() {
  if(settingsLoadError.value)firstLoading.value=true
  settingsLoadError.value=false
  settingReady.value = false
  settingQuery().then(settingData => {
    setting.value = settingData
    settingStore.domainList = settingData.domainList;
    resendTokenForm.domain = setting.value.domainList[0]
    loginOpacity.value = setting.value.loginOpacity
    minEmailPrefix.value = setting.value.minEmailPrefix
    firstLoading.value = false
    backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : ''
    editTitle.value = setting.value.title
    r2DomainInput.value = setting.value.r2Domain
    addVerifyCount.value = setting.value.addVerifyCount
    regVerifyCount.value = setting.value.regVerifyCount
    resetNoticeForm()
    resetAddS3Form()
    resetEmailPrefix()
    resetBlackList()
    resetAiCodeFilter()
    nextTick(() => {
      settingReady.value = true
    })
  }).catch(()=>{
    firstLoading.value=false
    settingsLoadError.value=true
  })
}


function openNoticePopup() {
  uiStore.showNotice()
}

function openAddVerifyCount() {
  if (settingLoading.value) return
  addVerifyCountShow.value = true
}

function openRegVerifyCount() {
  if (settingLoading.value) return
  regVerifyCountShow.value = true
}

function resetAddS3Form() {
  s3.bucket = setting.value.bucket
  s3.endpoint = setting.value.endpoint
  s3.region = setting.value.region
  s3.s3AccessKey = ''
  s3.s3SecretKey = ''
  s3.forcePathStyle = setting.value.forcePathStyle
}

const resendList = computed(() => {

  let list = Object.keys(setting.value.resendTokens).map(key => {
    return {
      key: key,
      value: setting.value.resendTokens[key]
    };
  })

  if (list.length > 0) {

    const key = list.reduce((a, b) => compareByLengthAndUpperCase(a, b, 'key')).key;
    emailColumnWidth.value = getTextWidth(key) + 30;

    const value = list.reduce((a, b) => compareByLengthAndUpperCase(a, b, 'value')).value;
    tokenColumnWidth.value = getTextWidth(value) + 30;

  }

  return list;
});

function saveAddVerifyCount() {
  if (!addVerifyCount.value) {
    addVerifyCount.value = 1
  }
  editSetting({addVerifyCount: addVerifyCount.value})
}

function saveRegVerifyCount() {
  if (!regVerifyCount.value) {
    regVerifyCount.value = 1
  }
  editSetting({regVerifyCount: regVerifyCount.value})
}

const compareByLengthAndUpperCase = (a, b, key) => {
  const getUpperCaseCount = (str) => (str.match(/[A-Z]/g) || []).length;
  if (a[key].length === b[key].length) {
    return getUpperCaseCount(a[key]) > getUpperCaseCount(b[key]) ? a : b;
  }
  return a[key].length > b[key].length ? a : b;
};


function closedSetBackground() {
  backgroundImage.value = ''
  localUpShow.value = false
  backgroundUrl.value = setting.value.background?.startsWith('http') ? setting.value.background : ''
}

function openTgSetting() {
  tgBotStatus.value = setting.value.tgBotStatus
  tgBotToken.value = ''
  customDomain.value = setting.value.customDomain
  tgMsgFrom.value = setting.value.tgMsgFrom
  tgMsgText.value = setting.value.tgMsgText
  tgMsgTo.value = setting.value.tgMsgTo
  tgChatId.value = []
  if (setting.value.tgChatId) {
    const list = setting.value.tgChatId.split(',')
    tgChatId.value.push(...list)
  }
  tgSettingShow.value = true
}

function openNoticePopupSetting() {
  noticePopupShow.value = true
}

function openResendList() {
  showResendList.value = true
}

function resetNoticeForm() {
  noticeForm.notice = setting.value.notice
  noticeForm.noticeContent = setting.value.noticeContent
  noticeForm.noticeDuration = setting.value.noticeDuration
  noticeForm.noticeTitle = setting.value.noticeTitle
  noticeForm.noticePosition = setting.value.noticePosition
  noticeForm.noticeType = setting.value.noticeType
  noticeForm.noticeOffset = setting.value.noticeOffset
  noticeForm.noticeWidth = setting.value.noticeWidth
}

function saveNoticePopup() {
  noticeForm.noticeOffset = noticeForm.noticeOffset || 0
  noticeForm.noticeWidth = noticeForm.noticeWidth || 0
  noticeForm.noticeDuration = noticeForm.noticeDuration || 0
  editSetting({...noticeForm})
}

function previewNoticePopup() {
  uiStore.previewNotice({...noticeForm})
}

function openThirdEmailSetting() {
  forwardEmail.value = []
  forwardStatus.value = setting.value.forwardStatus
  if (setting.value.forwardEmail) {
    const list = setting.value.forwardEmail.split(',')
    forwardEmail.value.push(...list)
  }
  thirdEmailShow.value = true
}

function openWebhookSetting() {
  webhookStatus.value = setting.value.webhookStatus
  webhookUrl.value = setting.value.webhookUrl || ''
  webhookRetry.value = setting.value.webhookRetry ?? 0
  webhookSecret.value = setting.value.webhookSecret || ''
  webhookShow.value = true
}

function openEmailPrefix() {
  emailPrefixShow.value = true
}

function openAutoClean() {
  autoCleanDays.value = setting.value.autoCleanDays ?? 0
  autoCleanExclude.value = setting.value.autoCleanExclude
      ? setting.value.autoCleanExclude.split(',').filter(Boolean)
      : []
  autoCleanShow.value = true
}

function openForwardRules() {
  ruleType.value = setting.value.ruleType
  ruleEmail.value = []
  if (setting.value.ruleEmail) {
    const list = setting.value.ruleEmail.split(',')
    ruleEmail.value.push(...list)
  }
  forwardRulesShow.value = true
}

function emailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  forwardEmail.value.splice(forwardEmail.value.length - 1, 1)

  emails.forEach(email => {
    if (isEmail(email) && !forwardEmail.value.includes(email)) {
      forwardEmail.value.push(email)
    }
  })
}

function ruleEmailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  ruleEmail.value.splice(ruleEmail.value.length - 1, 1)

  emails.forEach(email => {
    if (isEmail(email) && !ruleEmail.value.includes(email)) {
      ruleEmail.value.push(email)
    }
  })
}

function addChatTag(val) {

  const chatIds = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  tgChatId.value.splice(tgChatId.value.length - 1, 1)

  chatIds.forEach(id => {
    if (!isNaN(Number(id))) {
      tgChatId.value.push(id)
    }
  })
}

function clearS3() {

  const form = {
    bucket: '',
    endpoint: '',
    region: '',
    s3AccessKey: '',
    s3SecretKey: '',
    forcePathStyle: 1
  }
  clearS3Loading.value = true
  editSetting(form)
}

function saveS3() {

  const form = {
    bucket: s3.bucket,
    endpoint: s3.endpoint,
    region: s3.region,
    forcePathStyle: s3.forcePathStyle
  }

  if (s3.s3AccessKey) form.s3AccessKey = s3.s3AccessKey
  if (s3.s3SecretKey) form.s3SecretKey = s3.s3SecretKey

  editSetting(form)
}

function tgBotSave() {
  const form = {
    customDomain: customDomain.value,
    tgBotStatus: tgBotStatus.value,
    tgChatId: tgChatId.value + '',
    tgMsgFrom: tgMsgFrom.value,
    tgMsgText: tgMsgText.value,
    tgMsgTo: tgMsgTo.value
  }
  if (tgBotToken.value) form.tgBotToken = tgBotToken.value
  editSetting(form)
}

function forwardEmailSave() {
  const form = {
    forwardStatus: forwardStatus.value,
    forwardEmail: forwardEmail.value + ''
  }
  editSetting(form)
}

function webhookSave() {
  let retry = Number(webhookRetry.value)
  if (isNaN(retry) || retry < 0) {
    retry = 0
  }
  const url = toOssDomain(webhookUrl.value.trim())
  if (isIpUrl(url)) {
    ElMessage({
      message: t('webhookIpNotSupported'),
      type: 'warning',
      plain: true
    })
    return
  }
  const form = {
    webhookStatus: webhookStatus.value,
    webhookUrl: url,
    webhookRetry: retry,
    webhookSecret: webhookSecret.value.trim()
  }
  editSetting(form)
}


function ruleEmailSave() {
  const form = {
    ruleEmail: ruleEmail.value + '',
    ruleType: ruleType.value
  }
  editSetting(form)
}

function doOpacityChange() {
  if (!settingReady.value) return
  const form = {}
  form.loginOpacity = loginOpacity.value
  editSetting(form, true)
}

function resetEmailPrefix() {
  minEmailPrefix.value = setting.value.minEmailPrefix
  emailPrefixFilter.value = setting.value.emailPrefixFilter
}

function resetBlackList() {
  blackListForm.value.blackFrom = setting.value.blackFrom ? setting.value.blackFrom.split(',') : []
  blackListForm.value.blackContent = setting.value.blackContent ? setting.value.blackContent.split(',') : []
  blackListForm.value.blackSubject = setting.value.blackSubject ? setting.value.blackSubject.split(',') : []
}

function resetAutoClean() {
  autoCleanDays.value = setting.value.autoCleanDays ?? 0
  autoCleanExclude.value = setting.value.autoCleanExclude
      ? setting.value.autoCleanExclude.split(',').filter(Boolean)
      : []
}

function resetAiCodeFilter() {
  aiCodeFilter.value = setting.value.aiCodeFilter ? setting.value.aiCodeFilter.split(',') : []
}

function saveEmailPrefix() {
  const form = {}
  form.minEmailPrefix = minEmailPrefix.value
  form.emailPrefixFilter = emailPrefixFilter.value
  editSetting(form, true)
}

function saveAutoClean() {
  editSetting({
    autoCleanDays: autoCleanDays.value,
    autoCleanExclude: autoCleanExclude.value.join(',')
  }, true)
}

function saveAiCodeFilter() {
  editSetting({aiCodeFilter: aiCodeFilter.value + ''})
}

const opacityChange = debounce(doOpacityChange, 1000, {
  leading: false,
  trailing: true
})

function saveBlackList() {

  let form = {
    blackContent: blackListForm.value.blackContent + '',
    blackSubject: blackListForm.value.blackSubject + '',
    blackFrom: blackListForm.value.blackFrom + ''
  }

  settingLoading.value = true

  setBlackList(form).then(() => {
    getSettings()
    ElMessage({
      message: t('setSuccess'),
      type: "success",
      plain: true
    })
    blackFormShow.value = false;
  }).finally(() => {
    settingLoading.value = false;
  })
}

function banEmailAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  blackListForm.value.blackFrom.splice(blackListForm.value.blackFrom.length - 1, 1)

  emails.forEach(email => {
    if ((isEmail(email) || isDomain(email)) && !blackListForm.value.blackFrom.includes(email)) {
      blackListForm.value.blackFrom.push(email)
    }
  })
}

function autoCleanExcludeAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  autoCleanExclude.value.splice(autoCleanExclude.value.length - 1, 1)

  emails.forEach(email => {
    if (isEmail(email) && !autoCleanExclude.value.includes(email)) {
      autoCleanExclude.value.push(email)
    }
  })
}

function aiCodeFilterAddTag(val) {
  const emails = Array.from(new Set(
      val.split(/[,，]/).map(item => item.trim()).filter(item => item)
  ));

  aiCodeFilter.value.splice(aiCodeFilter.value.length - 1, 1)

  emails.forEach(email => {
    if ((isEmail(email) || isDomain(email)) && !aiCodeFilter.value.includes(email)) {
      aiCodeFilter.value.push(email)
    }
  })
}


function delBackground() {
  ElMessageBox.confirm(t('delBackgroundConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    deleteBackground().then(() => {
      backgroundUrl.value = ''
      setting.value.background = null
      ElMessage({
        message: t('delSuccessMsg'),
        type: "success",
        plain: true
      })
    })
  })
}

function openCostaction() {
  costactionForm.token = ''
  costactionForm.minMb = Math.round((setting.value.costactionMinSize || 10 * MB) / MB)
  costactionForm.maxMb = Math.round((setting.value.costactionMaxSize || 100 * MB) / MB)
  costactionForm.roles = String(setting.value.costactionRoles || '').split(',').filter(Boolean).map(Number)
  costactionResult.value = ''
  roleSelectUse().then(list => { costactionRoles.value = list }).catch(() => {})
  costactionShow.value = true
}

async function testCostaction() {
  costactionTesting.value = true
  try {
    costactionResult.value = (await costactionTest(costactionForm.token.trim())).ok ? 'ok' : 'failed'
  } catch {
    costactionResult.value = 'failed'
  } finally {
    costactionTesting.value = false
  }
}

function saveCostaction() {
  if (costactionForm.minMb > costactionForm.maxMb) {
    ElMessage({ message: t('largeAttSizeOrder'), type: 'warning', plain: true })
    return
  }
  editSetting({
    costactionToken: costactionForm.token.trim(),
    costactionMinSize: costactionForm.minMb * MB,
    costactionMaxSize: costactionForm.maxMb * MB,
    costactionRoles: costactionForm.roles.join(',')
  })
}

function clearCostactionToken() {
  ElMessageBox.confirm(t('largeAttTokenClearConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => editSetting({ costactionTokenClear: true, costactionStatus: 1 }))
}

function openOauthSetting(p) {
  oauthForm.key = p.key
  oauthForm.label = p.label
  oauthForm.clientId = setting.value[p.key + 'ClientId'] || ''
  oauthForm.clientSecret = setting.value[p.key + 'ClientSecret'] || ''
  oauthForm.switch = setting.value[p.key + 'Switch'] ?? 1
  oauthSettingShow.value = true
}

function saveOauth() {
  const form = {}
  form[oauthForm.key + 'ClientId'] = oauthForm.clientId
  form[oauthForm.key + 'ClientSecret'] = oauthForm.clientSecret
  form[oauthForm.key + 'Switch'] = oauthForm.switch
  editSetting(form)
}

function saveTurnstileKey() {
  const settingForm = {}
  settingForm.siteKey = turnstileForm.siteKey
  settingForm.secretKey = turnstileForm.secretKey
  editSetting(settingForm)
}

async function saveBackground() {

  if (settingLoading.value) return

  let image = ''

  if (localUpShow.value) {
    image = await fileToBase64(backgroundFile, true);
  } else {
    if (backgroundUrl.value && !backgroundUrl.value.startsWith('http')) {
      ElMessage({
        message: t('imageLinkErrorMsg'),
        type: "error",
        plain: true
      })
      return
    }
    image = backgroundUrl.value
  }
  settingLoading.value = true

  setBackground(image).then(key => {
    setting.value.background = key
    showSetBackground.value = false
    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
    localUpShow.value = false
    backgroundImage.value = ''
  }).finally(() => {
    settingLoading.value = false
  })

}

function openSetBackground() {
  showSetBackground.value = true
}

function openCut() {
  const doc = document.createElement('input')
  doc.setAttribute('type', 'file')
  doc.setAttribute('accept', 'image/*')
  doc.click()
  doc.onchange = async (e) => {
    backgroundFile = e.target.files[0]
    backgroundImage.value = URL.createObjectURL(e.target.files[0])
    localUpShow.value = true
  }
}

function saveR2domain() {
  const settingForm = {r2Domain: r2DomainInput.value}
  editSetting(settingForm)
}

function openResendForm() {
  resendTokenFormShow.value = true
}

function openBlackListForm() {
  blackFormShow.value = true
}

function openAiCodeFilter() {
  aiCodeFilterShow.value = true
}

function saveResendToken() {
  const settingForm = {
    resendTokens: {}
  }
  const domain = resendTokenForm.domain.slice(1)
  settingForm.resendTokens[domain] = resendTokenForm.token
  editSetting(settingForm)
}

function backupSetting() {
  const settingForm = {...setting.value}
  delete settingForm.resendTokens
  delete settingForm.siteKey
  delete settingForm.secretKey
  backup = JSON.stringify(setting.value)
}

function cleanResendTokenForm() {
  resendTokenForm.token = ''
}

function beforeChange() {
  if (!settingReady.value || settingLoading.value) return false
  backupSetting()
  return true
}

function change(e) {
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

function saveTitle() {
  editSetting({title: editTitle.value})
}

function editSetting(settingForm, refreshStatus = true) {
  if (settingLoading.value) return
  settingLoading.value = true

  settingSet(settingForm).then(() => {
    settingLoading.value = false
    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
    if (setting.value.manyEmail === 1) {
      accountStore.currentAccountId = userStore.user.account.accountId;
    }
    if (refreshStatus) {
      getSettings()
    }
    editTitleShow.value = false
    r2DomainShow.value = false
    resendTokenFormShow.value = false
    turnstileShow.value = false
    tgSettingShow.value = false
    thirdEmailShow.value = false
    webhookShow.value = false
    forwardRulesShow.value = false
    addVerifyCountShow.value = false
    regVerifyCountShow.value = false
    noticePopupShow.value = false
    addS3Show.value = false
    emailPrefixShow.value = false
    aiCodeFilterShow.value = false
    autoCleanShow.value = false
    oauthSettingShow.value = false
    costactionShow.value = false
  }).catch((e) => {
    loginOpacity.value = setting.value.loginOpacity
    setting.value = {...setting.value, ...JSON.parse(backup)}
  }).finally(() => {
    settingLoading.value = false
    clearS3Loading.value = false
  })
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

.title-icon.warning {
  position: relative;
  top: 2px;
  cursor: pointer;
  margin-left: 2px;
}

.warning {
  margin-left: 2px;
  color: grey;
  cursor: pointer;
}

.cropper {
  border-radius: 4px;
  border: 1px solid #D4D7DE;
  height: 397px;
  width: 705px;
  @media (max-width: 767px) {
    width: calc(100vw - 60px);
    height: calc((100vw - 60px) * 9 / 16);
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

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

.notice-popup-item {
  margin-top: 15px;
}

.notice-line-item {
  margin-top: 15px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 15px;

  > * {
    width: 100%;
  }

  @media (max-width: 840px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 580px) {
    grid-template-columns: 1fr;
  }
}

.background-url {
  width: min(calc(100vw - 70px), 500px);
}


:deep(.el-dialog) {
  width: 400px !important;
  @media (max-width: 440px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.resend-table.el-dialog) {
  min-height: 300px;
  width: 500px !important;
  @media (max-width: 540px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.notice-popup.el-dialog) {
  min-height: 300px;
  width: 820px !important;
  @media (max-width: 860px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

:deep(.resend-table .el-dialog__header) {
  padding-bottom: 5px;
}

:deep(.el-table__inner-wrapper:before) {
  background: var(--el-bg-color);
}

:deep(.cut-dialog.el-dialog) {
  width: fit-content !important;
  height: fit-content !important;
}


:deep(.forward-dialog.el-dialog) {
  width: 500px !important;
  @media (max-width: 540px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.forward-dialog {
  .forward-head {
    display: flex;
    align-items: center;

    .forward-set-title {
      top: 1px;
      padding-right: 5px;
      position: relative;
      font-size: 16px;
      font-weight: bold;;
    }
  }
}

.error-image {
  background: var(--light-ill);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cut-button {
  padding-top: 15px;
  width: 100%;
  display: flex;
  justify-content: space-between;

  .el-button {
    width: fit-content;
  }
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

.email-prefix {
  display: flex;
  justify-content: space-between;
}

.prefix-filter {
  display: flex;
  flex-direction: column;
}

.s3-button {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 15px;

  .el-button {
    margin-left: 0;
  }
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

.dialog-input {
  margin-bottom: 15px;
}

.force-path-style {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  .force-path-style-left {
    padding-left: 2px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
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

form .el-button {
  margin-top: 10px;
  width: 100%;
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

<style scoped>
.costaction-form { display: grid; gap: 12px; }
.costaction-note { margin: 0; font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); }
.costaction-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.costaction-actions .ok { color: var(--el-color-success); }
.costaction-actions .failed { color: var(--el-color-danger); }
.costaction-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }
.costaction-field .el-select { width: 220px; }
.costaction-form .el-button { width: auto; margin-top: 0; }
.costaction-form > .el-button--primary { width: 100%; }
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
