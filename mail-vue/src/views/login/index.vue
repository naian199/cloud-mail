<template>
  <div id="login-box" :class="{'auth-dark':uiStore.dark}"  v-loading="oauthLoading" :element-loading-text="$t('loginBtn')">
    <div class="auth-background" v-if="background" :style="background" aria-hidden="true"></div>
    <header class="auth-header"><a class="auth-wordmark" href="/login"><img src="/mail-brand.svg" alt="" width="30" height="30"><span>{{ settingStore.settings.title }}</span></a><LanguageSelect class="login-language" /></header>
    <main class="form-wrapper">
      <section class="auth-brand" :aria-label="settingStore.settings.title">
        <img class="auth-brand-symbol" src="/mail-auth-connect.svg" alt="" width="160" height="160">
        <h1>{{ $t('authConnectionTagline') }}</h1>
        <p>{{ settingStore.settings.title }}</p>
      </section>
      <div class="container">
        <img class="auth-mobile-symbol" src="/mail-auth-connect.svg" alt="" width="56" height="56">
        <span class="form-title">{{ settingStore.settings.title }}</span>
        <span class="form-desc" v-if="show === 'login'">{{ $t('loginTitle') }}</span>
        <span class="form-desc" v-else>{{ $t('regTitle') }}</span>
        <div v-show="show === 'login'">
          <el-input v-model="form.email"
                    type="text" inputmode="email" autocapitalize="none" :spellcheck="false" :placeholder="$t('identityLogin')" autocomplete="username" @keyup.enter="submit">

          </el-input>
          <el-input v-model="form.password" :placeholder="$t('password')" type="password" show-password autocomplete="current-password" @keyup.enter="submit">
          </el-input>
          <el-button class="btn" type="primary" @click="submit" :loading="loginLoading"
          >{{ $t('loginBtn') }}
          </el-button>
          <div v-if="oauthProviders.length" class="auth-divider" aria-hidden="true"></div>
          <el-button v-for="p in oauthProviders" :key="p.key" class="btn" style="margin-top: 10px" @click="oauthLogin(p.key)">
            <el-avatar v-if="p.iconType === 'image'" :src="p.icon" :size="18" style="margin-right: 10px" />
            <Icon v-else :icon="p.icon" width="18" height="18" style="margin-right: 10px" />
            {{ p.label }}
          </el-button>
        </div>
        <div v-show="show !== 'login'">
          <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="registerForm.email" type="text" inputmode="email" autocapitalize="none" :spellcheck="false" :placeholder="$t('contactUsername')"
                    autocomplete="username" @keyup.enter="submitRegister">
            <template #append v-if="!hideLoginDomain">
              <div @click.stop="openSelect">
                <el-select
                    v-if="show !== 'login'"
                    ref="mySelect"
                    v-model="suffix"
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
                <div>
                  <span>{{ suffix }}</span>
                  <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
                </div>
              </div>
            </template>
          </el-input>
          <p class="identity-preview" role="status">{{ $t('identityMailboxPreview') }} <strong>{{ identityName.name || 'username' }}{{ registrationDomain }}</strong><br><span :class="{ 'identity-error':availability.error }">{{ availability.checking ? $t('identityChecking') : availability.error ? $t(availability.error) : availability.available ? $t('identityAvailable') : $t('identityUsernameRules') }}</span></p>
          <el-input v-model="registerForm.nickname" :placeholder="$t('identityNicknameOptional')" maxlength="40" autocomplete="nickname" />
          <el-input v-model="registerForm.password" :placeholder="$t('password')" type="password" show-password autocomplete="new-password" @keyup.enter="submitRegister"/>
          <el-input v-model="registerForm.confirmPassword" :placeholder="$t('confirmPwd')" type="password" show-password
                    autocomplete="new-password" @keyup.enter="submitRegister"/>
          <el-input v-if="settingStore.settings.regKey === 0" v-model="registerForm.code" :placeholder="$t('regKey')"
                    type="text" autocomplete="off" @keyup.enter="submitRegister"/>
          <el-input v-if="settingStore.settings.regKey === 2" v-model="registerForm.code"
                    :placeholder="$t('regKeyOptional')" type="text" autocomplete="off" @keyup.enter="submitRegister"/>
          <div v-show="verifyShow" class="register-turnstile"></div>
          <div v-if="verifyShow && botJsError" class="registration-verification-error" role="alert"><span>{{ $t(challengeErrorCode === '110200' ? 'registrationChallengeDomainError' : 'verifyModuleFailed') }}</span><span v-if="challengeErrorCode">{{ $t('registrationChallengeCode', { code: challengeErrorCode }) }}</span><el-button text :loading="challengeLoading" @click="renderRegisterChallenge">{{ $t('registrationRetryChallenge') }}</el-button></div>
          <el-button class="btn" style="margin: 0" type="primary" @click="submitRegister" :loading="registerLoading || challengeLoading"
          >{{ $t('regBtn') }}
          </el-button>
          <div v-if="oauthProviders.length" class="auth-divider" aria-hidden="true"></div>
          <el-button v-for="p in oauthProviders" :key="p.key" class="btn" style="margin-top: 10px" @click="oauthLogin(p.key)">
            <el-avatar v-if="p.iconType === 'image'" :src="p.icon" :size="18" style="margin-right: 10px" />
            <Icon v-else :icon="p.icon" width="18" height="18" style="margin-right: 10px" />
            {{ p.label }}
          </el-button>
        </div>
        <template v-if="settingStore.settings.register === 0">
          <button type="button" class="switch" @click="show = 'register'" v-if="show === 'login'">{{ $t('noAccount') }}
            <span>{{ $t('regSwitch') }}</span></button>
          <button type="button" class="switch" @click="show = 'login'" v-else>{{ $t('hasAccount') }} <span>{{ $t('loginSwitch') }}</span>
          </button>
        </template>
      </div>
    </main>
    <el-dialog class="bind-dialog" v-model="showBindForm"  :title="$t('regBtn')" >
      <div class="bind-container"><p>{{ $t('identityUsernameRules') }}</p>
        <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="bindForm.email" type="text" :placeholder="$t('contactUsername')" autocomplete="off" @keyup.enter="bind">
          <template #append v-if="!hideLoginDomain">
            <div @click.stop="openSelect">
              <el-select
                  ref="mySelect"
                  v-model="suffix"
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
              <div>
                <span>{{ suffix }}</span>
                <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
              </div>
            </div>
          </template>
        </el-input>
        <el-input v-if="settingStore.settings.regKey === 0" v-model="bindForm.code" :placeholder="$t('regKey')"
                  type="text" autocomplete="off" @keyup.enter="bind"/>
        <el-input v-if="settingStore.settings.regKey === 2" v-model="bindForm.code"
                  :placeholder="$t('regKeyOptional')" type="text" autocomplete="off" @keyup.enter="bind"/>
        <el-button class="btn" type="primary" @click="bind" :loading="bindLoading"
        >{{ $t('confirm') }}
        </el-button>
      </div>
    </el-dialog>
    <a v-show="settingStore.settings.projectLink" class="github" :href="projectInfo.repository" target="_blank" rel="noopener noreferrer">
      <Icon icon="mingcute:github-line" color="#1890ff" width="20" height="20" />
    </a>
  </div>
</template>

<script setup>
import {identityUsername} from '../../../../shared/user-identity.mjs';
import http from '@/axios';
import { registrationEmail, registrationPrefix, registrationNeedsChallenge } from '@/utils/registration.mjs';
import LanguageSelect from '@/components/language-select.vue';
import { projectInfo } from '../../../../shared/project-info.mjs';
import router from "@/router";
import {useRoute} from "vue-router";
import {computed, watch, nextTick, reactive, ref, onBeforeUnmount} from "vue";
import {login} from "@/request/login.js";
import {register} from "@/request/login.js";
import {websiteConfig} from "@/request/setting.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useUserStore} from "@/store/user.js";
import {useUiStore} from "@/store/ui.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {loginUserInfo} from "@/request/my.js";
import {syncPermissionRoutes} from "@/perm/perm.js";
import {useI18n} from "vue-i18n";
import {oauthBindUser, oauthLinuxDoLogin, oauthGithubLogin, oauthGoogleLogin} from "@/request/ouath.js";

const {t} = useI18n();
const accountStore = useAccountStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const route = useRoute();
const loginLoading = ref(false)
const bindLoading = ref(false)
const oauthLoading = ref(false);
const showBindForm = ref(false);
const show = ref('login')

const oauthKeys = ['linuxdo', 'github', 'google']

const oauthProvider = computed(() => {
  const fromState = route.query.state
  if (oauthKeys.includes(fromState)) return fromState
  const fromStore = sessionStorage.getItem('oauthProvider')
  return oauthKeys.includes(fromStore) ? fromStore : null
})

const oauthProviders = computed(() => {
  const allProviders = [
    { key: 'google', label: 'Google', icon: 'devicon:google', iconType: 'iconify' },
    { key: 'github', label: 'GitHub', icon: 'codicon:github-inverted', iconType: 'iconify' },
    { key: 'linuxdo', label: 'LinuxDo', icon: '/image/linuxdo.webp', iconType: 'image' },
  ]
  return allProviders.filter(p => settingStore.settings[p.key + 'Switch'] === 0)
})

const bindForm = reactive({
  email: '',
  oauthUserId: '',
  code: ''
})

const form = reactive({
  email: '',
  password: '',

});
const mySelect = ref()
const suffix = ref('')
const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  code: null
})
const registrationDomain=computed(()=>settingStore.settings.loginDomain===1 && registerForm.email.includes('@') ? '@'+registerForm.email.split('@').at(-1).trim().toLowerCase() : suffix.value||settingStore.settings.registrationDomain||'');
const identityName=computed(()=>identityUsername(registrationPrefix(registerForm.email)));
const availability=reactive({checking:false,available:false,error:''});
let availabilityTimer,availabilityRevision=0;
watch(()=>[registerForm.email,registrationDomain.value],()=>{
 const mine=++availabilityRevision;clearTimeout(availabilityTimer);availability.available=false;availability.error='';availability.checking=false;
 if(!registerForm.email)return;
 if(identityName.value.error){availability.error=identityName.value.error;return;}
 availability.checking=true;
 availabilityTimer=setTimeout(async()=>{
  try{const result=await http.get('/register/availability',{params:{username:identityName.value.name,domain:registrationDomain.value},noMsg:true});if(mine===availabilityRevision){availability.available=result.available;availability.error=result.reason||'';}}
  catch{if(mine===availabilityRevision)availability.error='identityCheckFailed';}
  finally{if(mine===availabilityRevision)availability.checking=false;}
 },450);
});
onBeforeUnmount(()=>{clearTimeout(availabilityTimer);availabilityRevision++;});
const domainList = settingStore.domainList;
const registerLoading = ref(false)
suffix.value = domainList[0]
const verifyShow = ref(false)
let verifyToken = ''
let turnstileId = null
const botJsError = ref(false), challengeLoading = ref(false), challengeErrorCode = ref('');
let registrationDisposed = false, cancelChallengeLoad;
async function renderRegisterChallenge() {
  if (challengeLoading.value || registrationDisposed) return;
  verifyToken = ''; challengeErrorCode.value=''; botJsError.value=false; verifyShow.value = true; challengeLoading.value = true;
  await nextTick();
  if (registrationDisposed) {challengeLoading.value=false;return;}
  try {
    if (!settingStore.settings.siteKey) throw Error('Challenge not configured');
    await new Promise((resolve,reject) => {
      let script, settled=false;
      const finish=(error)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);
        if(script){script.onload=null;script.onerror=null;if(error)script.remove();}
        cancelChallengeLoad=null;
        if(error)reject(error);else resolve();
      };
      const ready=()=>{
        if(!window.turnstile?.render){finish(Error('Challenge SDK unavailable'));return;}
        try {
          if(window.turnstile.ready)window.turnstile.ready(()=>finish());
          else finish();
        } catch(error){finish(error);}
      };
      // Mobile connections may take longer; do not remove an SDK still loading.
      const timer=setTimeout(()=>finish(Error('Challenge script timeout')),30000);
      cancelChallengeLoad=()=>finish(Error('Challenge cancelled'));
      if(window.turnstile?.render){ready();return;}
      script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      script.onload=ready;script.onerror=()=>finish(Error('Challenge script unavailable'));
      document.head.append(script);
    });
    if (registrationDisposed) return;
    botJsError.value = false;
    if (turnstileId !== null) window.turnstile.reset(turnstileId);
    else turnstileId=window.turnstile.render('.register-turnstile',{
      sitekey:settingStore.settings.siteKey,
      size:(document.querySelector('.register-turnstile')?.clientWidth||0)<300?'compact':'normal',
      callback:token=>{if(!registrationDisposed){verifyToken=token;botJsError.value=false;challengeErrorCode.value='';}},
      'expired-callback':()=>{verifyToken='';},
      'error-callback':code=>{if(!registrationDisposed){verifyToken='';botJsError.value=true;challengeErrorCode.value=/^\d{3,8}$/.test(String(code))?String(code):'';}}
    });
  } catch {
    try{if(turnstileId!==null)window.turnstile?.remove?.(turnstileId);}catch{}
    turnstileId=null;
    if (!registrationDisposed) {
      botJsError.value=true;
    }
  } finally { challengeLoading.value=false; }
}
onBeforeUnmount(()=>{
  registrationDisposed=true;cancelChallengeLoad?.();
  try{if(turnstileId!==null)window.turnstile?.remove?.(turnstileId);}catch{}
});

const hideLoginDomain = computed(() => settingStore.settings.loginDomain === 1)

const background = computed(() => {

  return settingStore.settings.background ? {
    'background-image': `url(${cvtR2Url(settingStore.settings.background)})`,
    'background-repeat': 'no-repeat',
    'background-size': 'cover',
    'background-position': 'center'
  } : ''
})

const openSelect = () => {
  mySelect.value.toggleMenu()
}

const getFullEmail = (email) => {
  return registrationEmail(email, suffix.value, hideLoginDomain.value)
}

const getEmailName = (email) => {
  return registrationPrefix(email)
}

function oauthLogin(provider) {
  const clientId = settingStore.settings[provider + 'ClientId']
  const redirectUri = encodeURIComponent(window.location.origin + '/login')
  sessionStorage.setItem('oauthProvider', provider)
  const authorizeUrls = {
    linuxdo: `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=${provider}`,
    github: `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=${provider}`,
    google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email&state=${provider}`,
  }
  window.location.href = authorizeUrls[provider]
}

const loginFns = {
  linuxdo: oauthLinuxDoLogin,
  github: oauthGithubLogin,
  google: oauthGoogleLogin,
}

oauthGetUser();

async function oauthGetUser() {

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code || !oauthProvider.value) return

  const provider = oauthProvider.value
  oauthLoading.value = true
  sessionStorage.removeItem('oauthProvider')
  window.history.replaceState({}, '', window.location.origin + window.location.pathname)

  loginFns[provider](code, window.location.origin + '/login').then(data => {

    bindForm.oauthUserId = data.userInfo.oauthUserId;

    if (!data.token) {
      showBindForm.value = true
      oauthLoading.value = false
      ElMessage({
        message: t('regTitle'),
        type: 'warning',
        duration: 4000,
        plain: true,
      })
      return;
    }

    saveToken(data.token);
  }).catch(() => {
    oauthLoading.value = false
  })
}

function bind() {

  if (bindLoading.value) return

  if (!bindForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }


  if (getEmailName(bindForm.email).length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  let email = getFullEmail(bindForm.email);


  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (settingStore.settings.regKey === 0) {

    if (!bindForm.code) {

      ElMessage({
        message: t('emptyRegKeyMsg'),
        type: 'error',
        plain: true,
      })
      return
    }

  }

  const form = {email, oauthUserId: bindForm.oauthUserId, code: bindForm.code}

  bindLoading.value = true
  oauthBindUser(form).then(data => {
    saveToken(data.token)
  }).catch(() => {
    bindLoading.value = false
  })
}

const submit = () => {

  if (loginLoading.value) return

  if (!form.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  const email=form.email.trim();

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  loginLoading.value = true
  login(email, form.password).then(async data => {
    await saveToken(data.token)
  }).finally(() => {
    loginLoading.value = false
  })
}

async function saveToken(token) {
  localStorage.setItem('token', token)
  refreshWebsiteConfig()
  const user = await loginUserInfo();
  accountStore.currentAccountId = user.account.accountId;
  accountStore.currentAccount = user.account;
  userStore.user = user;
  syncPermissionRoutes(router,user.permKeys);
  await router.replace({name: 'layout'})
  uiStore.showNotice()
  oauthLoading.value = false;
  bindLoading.value = false;
}

function refreshWebsiteConfig() {
  websiteConfig().then(setting => {
    settingStore.settings = setting
    settingStore.domainList = setting.domainList
    if (!suffix.value && setting.domainList.length > 0) {
      suffix.value = setting.domainList[0]
    }
    document.title = setting.title
  }).catch(e => {
    console.error(e)
  })
}


function submitRegister() {

  if (registerLoading.value || challengeLoading.value) return

  if (!registerForm.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }


  if (getEmailName(registerForm.email).length < settingStore.settings.minEmailPrefix) {
    ElMessage({
      message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}),
      type: 'error',
      plain: true,
    })
    return
  }

  if(identityName.value.error){ElMessage.error(t(identityName.value.error));return;}
  const email=identityName.value.name+registrationDomain.value;

  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!registerForm.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password.length < 6) {
    ElMessage({
      message: t('pwdLengthMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {

    ElMessage({
      message: t('confirmPwdFailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (settingStore.settings.regKey === 0) {

    if (!registerForm.code) {

      ElMessage({
        message: t('emptyRegKeyMsg'),
        type: 'error',
        plain: true,
      })
      return
    }

  }

  if (!verifyToken && (settingStore.settings.registerVerify === 0 || (settingStore.settings.registerVerify === 2 && settingStore.settings.regVerifyOpen))) {
    if (!verifyShow.value || botJsError.value) renderRegisterChallenge();
    else ElMessage({message:t('botVerifyMsg'),type:'error',plain:true});
    return;
  }

  registerLoading.value = true

  const form = {
    email,
    username:identityName.value.name,
    domain:registrationDomain.value,
    nickname:registerForm.nickname,
    password: registerForm.password,
    token: verifyToken,
    code: registerForm.code
  }

  register(form).then(({regVerifyOpen}) => {
    show.value = 'login'
    registerForm.email = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    registerForm.code = ''
    registerLoading.value = false
    verifyToken = ''
    settingStore.settings.regVerifyOpen = regVerifyOpen
    verifyShow.value = false
    ElMessage({
      message: t('regSuccessMsg'),
      type: 'success',
      plain: true,
    })
  }).catch(res => {

    registerLoading.value = false

    if (registrationNeedsChallenge(res)) {
      verifyToken = '';
      settingStore.settings.regVerifyOpen = true;
      renderRegisterChallenge();
    } else if (form.token && verifyShow.value) {
      // Tokens are single-use even when a later registration step fails.
      verifyToken = '';
      renderRegisterChallenge();
    }
  });
}

</script>


<style>
.el-select-dropdown__item {
  padding: 0 15px;
}

.no-autofill-pwd {
  .el-input__inner {
    -webkit-text-security: disc !important;
  }
}
</style>

<style scoped>
.identity-preview{font-size:12px;line-height:1.7;color:var(--auth-muted);margin:-4px 0 16px;overflow-wrap:anywhere;}.identity-preview strong{color:var(--auth-ink);font-weight:500;}.identity-error{color:var(--el-color-danger);}

#login-box{--auth-bg:#f5f8fd;--auth-card:#fff;--auth-ink:#172b46;--auth-muted:#6b7b90;--auth-line:#e2e9f3;position:relative;isolation:isolate;min-height:var(--app-viewport-height,100dvh);background:radial-gradient(ellipse at 12% 20%,#dcecff 0,transparent 52%),radial-gradient(ellipse at 85% 85%,#fff0e9 0,transparent 42%),var(--auth-bg);color:var(--auth-ink);overflow-x:clip;}
#login-box.auth-dark{--auth-bg:#0d1724;--auth-card:#152234;--auth-ink:#edf4ff;--auth-muted:#a7b5c8;--auth-line:#2a3b51;background:radial-gradient(ellipse at 12% 20%,#142e4a 0,transparent 55%),var(--auth-bg);}
.auth-background{position:absolute;inset:0;z-index:-2;opacity:.13;pointer-events:none;}
.auth-header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1240px;margin:auto;padding:28px 48px;}
.auth-wordmark{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:650;letter-spacing:-.3px;text-decoration:none;color:inherit;}
.login-language{width:156px;flex-shrink:0;}.login-language :deep(.el-select__wrapper){background:transparent;box-shadow:none;}
.form-wrapper{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,420px);align-items:center;gap:clamp(40px,8vw,120px);width:100%;max-width:1136px;margin:0 auto;padding:52px 48px 100px;min-height:calc(var(--app-viewport-height,100dvh) - 100px);box-sizing:border-box;}
.auth-brand{padding-bottom:36px;}.auth-brand-symbol{display:block;width:144px;height:144px;border-radius:32px;box-shadow:0 22px 56px #2389f524;margin-bottom:34px;}
.auth-brand h1{font-size:clamp(32px,4.3vw,56px);line-height:1.25;letter-spacing:-1.8px;max-width:560px;margin:0 0 22px;font-weight:700;text-wrap:balance;}
.auth-brand p{font-size:18px;line-height:1.6;color:var(--auth-muted);margin:0;letter-spacing:.5px;}
.container{width:100%;box-sizing:border-box;padding:36px;border:1px solid var(--auth-line);border-radius:24px;background:var(--auth-card);box-shadow:0 20px 70px #172b460a;display:flex;flex-direction:column;min-width:0;}
.auth-mobile-symbol{display:none;}.form-title{font-size:25px;font-weight:700;line-height:1.35;letter-spacing:-.6px;overflow-wrap:anywhere;}.form-desc{font-size:13px;line-height:1.65;color:var(--auth-muted);margin:8px 0 28px;}
.container .el-input{width:100%;height:48px;margin-bottom:16px;}.container :deep(.el-input__wrapper){border-radius:10px;background:var(--auth-card);box-shadow:0 0 0 1px var(--auth-line) inset;padding:1px 14px;}.container :deep(.el-input__wrapper.is-focus){box-shadow:0 0 0 2px var(--el-color-primary) inset;}.container :deep(.el-input__inner){height:46px;font-size:14px;}
.container .email-input :deep(.el-input__wrapper){border-radius:10px 0 0 10px;min-width:0;padding-inline:12px;}.container :deep(.el-input-group__append){background:var(--auth-card);color:var(--auth-ink);padding:0 8px;border-radius:0 10px 10px 0;box-shadow:0 0 0 1px var(--auth-line) inset;font-size:12px;max-width:52%;}.container :deep(.el-input-group__append>div){display:flex;align-items:center;min-width:0;cursor:pointer;}.container :deep(.el-input-group__append>div>div){white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;}
.setting-icon{vertical-align:middle;}.select{position:absolute;right:20px;width:100px;opacity:0;pointer-events:none;visibility:hidden;}
.container .btn{width:100%;min-height:46px;border-radius:10px;font-weight:600;font-size:14px;}.container .btn:not(.el-button--primary){background:var(--auth-card);border-color:var(--auth-line);}.container .el-button--primary{background:#2389f5;border-color:#2389f5;box-shadow:0 5px 14px #2389f51c;}.container .el-button--primary:hover{background:#1478e4;}.container :deep(.el-button+.el-button){margin-left:0;}
.auth-divider{height:1px;background:var(--auth-line);margin:24px 0 14px;}.switch{border:0;background:none;padding:0;margin-top:26px;text-align:center;font:inherit;font-size:13px;line-height:1.7;color:var(--auth-muted);cursor:pointer;}.switch span{color:var(--el-color-primary);font-weight:600;margin-inline-start:4px;}.switch:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:5px;}
.register-turnstile{margin:0 0 16px;}.registration-verification-error{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 14px;color:var(--el-color-danger);font-size:12px;line-height:1.5;}.registration-verification-error .el-button{margin:0;}
:deep(.bind-dialog){width:min(400px,calc(100% - 32px))!important;border-radius:18px;}.bind-container{display:grid;gap:15px;}
.github{position:fixed;bottom:max(18px,env(safe-area-inset-bottom));right:20px;display:grid;place-items:center;width:32px;height:32px;opacity:.65;z-index:10;}.github:hover{opacity:1;}
@media(min-width:768px) and (max-height:700px){.form-wrapper{padding-top:16px;padding-bottom:76px;align-items:start;}.container{padding:28px;}.auth-brand{padding-top:30px;}.auth-brand-symbol{width:104px;height:104px;margin-bottom:24px;}.auth-brand h1{font-size:36px;}}
@media(max-width:767px),(max-width:1024px) and (max-height:500px) and (pointer:coarse){
.auth-header{padding:max(18px,env(safe-area-inset-top)) 20px 12px;}.auth-wordmark{font-size:14px;gap:8px;}.auth-wordmark img{width:26px;height:26px;}.login-language{width:126px;}
.form-wrapper{grid-template-columns:minmax(0,420px);justify-content:center;align-content:start;gap:0;min-height:0;padding:26px 20px calc(86px + env(safe-area-inset-bottom));}.auth-brand{display:none;}.container{padding:28px 24px;border-radius:20px;}.auth-mobile-symbol{display:block;margin-bottom:22px;}.form-title{font-size:24px;}.form-desc{margin-bottom:24px;}.github{position:absolute;bottom:20px;}
}
@media(max-width:360px){.auth-header{padding-inline:14px;}.auth-wordmark span{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.form-wrapper{padding-inline:12px;}.container{padding:24px 18px;}.container :deep(.el-input-group__append){padding:0 5px;font-size:11px;}}
</style>
