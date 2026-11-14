<template>
  <!-- Desktop navigation: three primary sections, mail as a fixed secondary entry, and "Me". -->
  <nav class="site-rail" :aria-label="t('navigationMenu')">
    <RouterLink to="/mail-chat" class="rail-brand" :title="settings.title" :aria-label="settings.title">
      <img src="/mail-brand.svg" alt="" width="34" height="34">
    </RouterLink>
    <div class="rail-primary">
      <RouterLink v-for="item in primary" :key="item.id" :to="item.to" class="rail-item" :class="{ active: section === item.id }"
        :aria-current="section === item.id ? 'page' : undefined" :data-nav="item.id">
        <span class="rail-icon"><Icon :icon="item.icon" width="22" aria-hidden="true" />
          <span v-if="item.count" class="rail-badge" :aria-label="n(item.count) + ' ' + t('chatUnread')">{{ badge(item.count, n) }}</span></span>
        <span class="rail-label">{{ t(item.label) }}</span>
      </RouterLink>
      <span class="rail-divider" aria-hidden="true"></span>
      <RouterLink to="/inbox" class="rail-item rail-secondary" :class="{ active: section === 'mail' }"
        :aria-current="section === 'mail' ? 'page' : undefined" data-nav="mail">
        <span class="rail-icon"><Icon icon="cloud-mail:external-mail" width="21" aria-hidden="true" />
          <span v-if="unread.mail" class="rail-badge" :aria-label="n(unread.mail) + ' ' + t('chatUnread')">{{ badge(unread.mail, n) }}</span></span>
        <span class="rail-label">{{ t('navMail') }}</span>
      </RouterLink>
    </div>
    <RouterLink to="/me" class="rail-item rail-me" :class="{ active: section === 'me' }" :aria-current="section === 'me' ? 'page' : undefined" data-nav="me" :title="t('navMe')">
      <UserAvatar :profile="user.user.profile" :email="user.user.email" :size="34" />
      <span class="rail-label">{{ t('navMe') }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/user-avatar.vue';
import { useUserStore } from '@/store/user';
import { useSettingStore } from '@/store/setting';
import { useSiteNav, badge } from '@/composables/use-site-nav';

const { t, n } = useI18n();
const user = useUserStore();
const settings = useSettingStore().settings;
const { section, unread } = useSiteNav();
const primary = computed(() => [
  { id: 'chat', to: '/chat', icon: 'cloud-mail:chat', label: 'navChat', count: unread.value.chat },
  { id: 'store', to: '/apps', icon: 'cloud-mail:store', label: 'navStore', count: 0 },
  { id: 'files', to: '/files', icon: 'cloud-mail:folder', label: 'cloudFileTitle', count: 0 }
]);
</script>

<style scoped>
.site-rail { --rail-bg:#f3f6fb; --rail-ink:#2b3a52; --rail-muted:#6b7a90; --rail-active:#ffffff; --rail-accent:#2563eb; --rail-line:#e2e8f1;
  display:flex; flex-direction:column; align-items:center; gap:6px; width:84px; height:100%; box-sizing:border-box; flex-shrink:0;
  padding:14px 8px max(14px, env(safe-area-inset-bottom)); background:var(--rail-bg); border-inline-end:1px solid var(--rail-line); }
html.dark .site-rail { --rail-bg:#141a24; --rail-ink:#dde5f2; --rail-muted:#8c99ae; --rail-active:#222c3d; --rail-accent:#7ab0ff; --rail-line:#273042; }
.rail-brand { display:grid; place-items:center; width:48px; height:48px; margin-bottom:10px; border-radius:14px; }
.rail-brand img { border-radius:10px; }
.rail-primary { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; width:100%; }
.rail-item { display:flex; flex-direction:column; align-items:center; gap:4px; width:100%; padding:8px 2px 7px; box-sizing:border-box; border-radius:14px;
  color:var(--rail-muted); text-decoration:none; font-size:11px; line-height:1.2; transition:background .15s, color .15s; }
.rail-item:hover { background:color-mix(in srgb, var(--rail-active) 70%, transparent); color:var(--rail-ink); }
.rail-item.active { background:var(--rail-active); color:var(--rail-accent); font-weight:600; box-shadow:0 1px 3px rgb(15 23 42 / 8%); }
.rail-item:focus-visible { outline:2px solid var(--rail-accent); outline-offset:-2px; }
.rail-icon { position:relative; display:grid; place-items:center; width:30px; height:26px; }
.rail-label { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rail-badge { position:absolute; top:-6px; inset-inline-start:18px; min-width:17px; height:17px; padding:0 5px; box-sizing:border-box; border-radius:9px;
  background:#ef4444; color:#fff; font-size:10px; line-height:17px; font-weight:600; text-align:center; font-variant-numeric:tabular-nums; border:2px solid var(--rail-bg); }
.rail-divider { width:36px; height:1px; margin:8px 0; background:var(--rail-line); }
.rail-secondary { font-size:10.5px; }
.rail-me { margin-top:auto; gap:5px; }
.rail-me.active :deep(.user-avatar), .rail-me.active :deep(img) { outline:2px solid var(--rail-accent); outline-offset:2px; border-radius:50%; }
</style>
