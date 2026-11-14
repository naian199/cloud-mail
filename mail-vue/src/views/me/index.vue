<template>
  <div class="me-page">
    <header class="me-head">
      <UserAvatar :profile="user.user.profile" :email="user.user.email" :size="56" />
      <div class="me-who">
        <strong>{{ user.user.profile?.displayName || user.user.name }}</strong>
        <span>{{ user.user.email }}</span>
        <el-tag size="small">{{ user.user.role?.name }}</el-tag>
      </div>
    </header>

    <section class="me-group">
      <RouterLink class="me-row me-mail" to="/inbox" data-me="mail">
        <Icon icon="cloud-mail:external-mail" width="21" /><span>{{ t('navMail') }}</span>
        <span v-if="unread.mail" class="me-badge">{{ badge(unread.mail, n) }}</span>
        <Icon class="me-chevron" icon="cloud-mail:chevron" width="18" />
      </RouterLink>
      <RouterLink class="me-row" to="/settings"><Icon icon="cloud-mail:settings" width="21" /><span>{{ t('settings') }}</span><Icon class="me-chevron" icon="cloud-mail:chevron" width="18" /></RouterLink>
    </section>

    <section v-if="canPublish || canReview" class="me-group">
      <h2>{{ t('navStore') }}</h2>
      <RouterLink v-if="canPublish" class="me-row" to="/apps/publish" data-me="publish"><Icon icon="cloud-mail:upload" width="21" /><span>{{ t('appPublishTitle') }}</span><Icon class="me-chevron" icon="cloud-mail:chevron" width="18" /></RouterLink>
      <RouterLink v-if="canReview" class="me-row" to="/apps/review" data-me="review"><Icon icon="cloud-mail:shield" width="21" /><span>{{ t('appReviewTitle') }}</span><Icon class="me-chevron" icon="cloud-mail:chevron" width="18" /></RouterLink>
    </section>

    <section v-if="admin.length" class="me-group">
      <h2>{{ t('manage') }}</h2>
      <RouterLink v-for="item in admin" :key="item.to" class="me-row" :to="item.to"><Icon :icon="item.icon" width="21" /><span>{{ t(item.label) }}</span><Icon class="me-chevron" icon="cloud-mail:chevron" width="18" /></RouterLink>
    </section>

    <section class="me-group">
      <button type="button" class="me-row" @click="toggleDark"><Icon :icon="ui.dark ? 'cloud-mail:sun' : 'cloud-mail:moon'" width="21" /><span>{{ t(ui.dark ? 'meLightMode' : 'meDarkMode') }}</span></button>
      <div class="me-row me-language" @click.stop><Icon icon="cloud-mail:translate" width="21" /><LanguageSelect /></div>
      <button type="button" class="me-row me-logout" :disabled="leaving" @click="leave"><Icon icon="cloud-mail:logout" width="21" /><span>{{ t('logOut') }}</span></button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/user-avatar.vue';
import LanguageSelect from '@/components/language-select.vue';
import { useUserStore } from '@/store/user';
import { useUiStore } from '@/store/ui';
import { hasPerm } from '@/perm/perm.js';
import { logout } from '@/request/login.js';
import { useSiteNav, badge } from '@/composables/use-site-nav';

defineOptions({ name: 'me' });
const { t, n } = useI18n();
const user = useUserStore();
const ui = useUiStore();
const router = useRouter();
const { unread } = useSiteNav();
const canPublish = computed(() => hasPerm('app:publish'));
const canReview = computed(() => hasPerm('app:review'));
const admin = computed(() => [
  { perm: 'analysis:query', to: '/analysis', icon: 'cloud-mail:analytics', label: 'analytics' },
  { perm: 'user:query', to: '/all-users', icon: 'cloud-mail:group', label: 'allUsers' },
  { perm: 'all-email:query', to: '/all-mail', icon: 'cloud-mail:external-mail', label: 'allMail' },
  { perm: 'role:query', to: '/role', icon: 'cloud-mail:lock', label: 'permissions' },
  { perm: 'reg-key:query', to: '/invite-code', icon: 'cloud-mail:key', label: 'inviteCode' },
  { perm: 'setting:query', to: '/system-settings', icon: 'cloud-mail:settings', label: 'SystemSettings' }
].filter((item) => hasPerm(item.perm)));

function toggleDark() {
  const next = !ui.dark;
  document.documentElement.setAttribute('class', next ? 'dark' : '');
  const meta = document.getElementById('theme-color-meta');
  const mobile = !window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  meta?.setAttribute('content', next ? (mobile ? '#141414' : '#000000') : (mobile ? '#191A23' : '#F1F1F1'));
  ui.dark = next;
}
const leaving = ref(false);
async function leave() {
  leaving.value = true;
  try { await logout(); localStorage.removeItem('token'); router.replace('/login'); } finally { leaving.value = false; }
}
</script>

<style scoped>
.me-page { height:100%; overflow-y:auto; box-sizing:border-box; padding:24px max(16px, calc((100% - 640px) / 2)) 32px; background:var(--el-bg-color-page); }
.me-head { display:flex; align-items:center; gap:16px; padding:20px; border-radius:18px; background:linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color)); border:1px solid var(--el-border-color-lighter); }
.me-who { display:flex; flex-direction:column; align-items:flex-start; gap:4px; min-width:0; }
.me-who strong { font-size:18px; }
.me-who span { color:var(--el-text-color-secondary); font-size:13px; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.me-group { margin-top:18px; border-radius:14px; background:var(--el-bg-color); border:1px solid var(--el-border-color-lighter); overflow:hidden; }
.me-group h2 { margin:0; padding:12px 16px 4px; font-size:12px; font-weight:600; color:var(--el-text-color-secondary); }
.me-row { display:flex; align-items:center; gap:12px; width:100%; min-height:52px; padding:0 16px; box-sizing:border-box; border:0; background:none; color:var(--el-text-color-primary); text-decoration:none; font:inherit; font-size:15px; cursor:pointer; text-align:start; }
.me-row + .me-row { border-top:1px solid var(--el-border-color-extra-light); }
.me-row:hover { background:var(--el-fill-color-light); }
.me-row:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.me-row > span { flex:1; min-width:0; }
.me-chevron { color:var(--el-text-color-placeholder); }
.me-badge { flex:none !important; min-width:20px; height:20px; padding:0 6px; box-sizing:border-box; border-radius:10px; background:#ef4444; color:#fff; font-size:11px; line-height:20px; text-align:center; font-weight:600; }
.me-language :deep(.el-select) { flex:1; }
.me-logout { color:var(--el-color-danger); }
</style>
