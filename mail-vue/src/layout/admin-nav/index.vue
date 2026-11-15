<template>
  <nav class="admin-navigation" :class="{ 'admin-navigation-phone': phone }" :aria-label="t('adminWorkspace')">
    <RouterLink :to="{ name: 'admin' }" class="admin-home-link" :aria-current="route.name === 'admin' ? 'page' : undefined">
      <Icon icon="cloud-mail:shield" width="19" aria-hidden="true" />
      <span>{{ t('adminWorkspace') }}</span>
    </RouterLink>
    <el-dropdown v-if="phone" class="admin-mobile-menu" trigger="click" @command="navigate">
      <button class="admin-menu-button" type="button" :aria-label="t('navigationMenu')">
        {{ t(activePage?.label || 'manage') }}
        <Icon icon="mingcute:down-small-fill" width="17" aria-hidden="true" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="page in pages" :key="page.name" :command="page.name">
            <span :aria-current="route.name === page.name ? 'page' : undefined">{{ t(page.label) }}</span>
          </el-dropdown-item>
          <el-dropdown-item command="me" divided>{{ t('navMe') }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <template v-else>
      <RouterLink v-for="page in pages" :key="page.name" :to="{ name: page.name }" class="admin-page-link"
        :aria-current="route.name === page.name ? 'page' : undefined">
        {{ t(page.label) }}
      </RouterLink>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { hasPerm } from '@/perm/perm.js';
import { adminSections } from '@/perm/admin-pages.mjs';

defineProps({ phone: Boolean });
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const pages = computed(() => adminSections.flatMap(section => section.pages).filter(page => hasPerm(page.permission)));
const activePage = computed(() => pages.value.find(page => page.name === route.name));
const navigate = name => router.push({ name });
</script>

<style scoped>
.admin-navigation { display: flex; flex: none; align-items: center; gap: 3px; padding: 5px clamp(8px, 1.4vw, 20px); min-width: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color); overflow-x: auto; scrollbar-width: thin; }
.admin-navigation a { display: inline-flex; align-items: center; gap: 6px; flex: none; min-height: 40px; padding: 5px 10px; border-radius: 8px; color: var(--el-text-color-secondary); text-decoration: none; font-size: 13px; font-weight: 560; }
.admin-navigation a:hover { color: var(--el-text-color-primary); background: var(--el-fill-color-light); }
.admin-navigation a[aria-current="page"] { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.admin-navigation a:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.admin-home-link { margin-inline-end: 5px; }
.admin-navigation-phone { justify-content: space-between; gap: 8px; }
.admin-navigation-phone .admin-home-link, .admin-mobile-menu { min-width: 0; flex: 0 1 auto; overflow-wrap: anywhere; }
.admin-menu-button { display: flex; align-items: center; gap: 3px; padding: 5px 8px; min-height: 40px; font: inherit; font-size: 13px; color: var(--el-text-color-primary); border: 1px solid var(--el-border-color-light); border-radius: 8px; background: var(--el-bg-color); text-align: start; cursor: pointer; }
.admin-menu-button svg { flex: none; }
</style>
