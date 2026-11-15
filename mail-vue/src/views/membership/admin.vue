<template>
  <div class="member-admin">
    <header class="heading">
      <h1>{{ t('memberOrdersTitle') }}</h1>
      <el-button :loading="loading" @click="load">{{ t('userManagementRefresh') }}</el-button>
    </header>
    <div class="filters">
      <el-input v-model="q" clearable :placeholder="t('memberAdminSearch')" :aria-label="t('memberAdminSearch')" @change="apply" @clear="apply" />
      <el-select v-model="status" :aria-label="t('tabStatus')" @change="apply">
        <el-option value="all" :label="t('userManagementAllStatuses')" />
        <el-option v-for="s in statuses" :key="s" :value="s" :label="t('memberStatus_' + s)" />
      </el-select>
    </div>
    <ListState :state="error" :retrying="loading" @retry="load" />
    <p v-if="loaded && !error && !orders.length" class="muted">{{ t('memberAdminEmpty') }}</p>
    <ul class="rows">
      <li v-for="o in orders" :key="o.orderId" :data-order="o.orderId">
        <div class="row-main">
          <span class="email" dir="ltr">{{ o.email }}</span>
          <span class="order-status" :data-status="o.status">{{ t('memberStatus_' + o.status) }}</span>
        </div>
        <small>{{ t('memberPlan_' + o.planId) }} · {{ money(o.amount, o.currency, locale) }} · {{ dateTime(o.createTime, locale) }}<template v-if="o.demo"> · {{ t('memberDemo') }}</template></small>
        <small>{{ t('memberFulfilment_' + o.fulfilment) }} · {{ o.expiresAt ? t(o.expiresAt > now ? 'memberExpiresOn' : 'memberExpiredOn', { date: day(o.expiresAt, locale) }) : t('memberNone') }}</small>
        <small class="order-id">{{ o.orderId }}</small>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ListState from '@/components/list-state.vue';
import { memberAdminOrders } from '@/request/membership';
import { money, day, dateTime } from './format.js';

// Read-only order and entitlement lookup for members of staff with member:query.
defineOptions({ name: 'member-orders' });
const { t, locale } = useI18n();
const route = useRoute(), router = useRouter();
const statuses = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];
const q = ref(typeof route.query.q === 'string' ? route.query.q : '');
const status = ref(statuses.includes(route.query.status) ? route.query.status : 'all');
const orders = ref([]), now = ref(0), loaded = ref(false), loading = ref(false), error = ref('');
let generation = 0;
async function load() {
  const mine = ++generation;
  loading.value = true;
  try {
    const data = await memberAdminOrders({ q: q.value.trim(), status: status.value === 'all' ? '' : status.value });
    if (mine !== generation) return;
    orders.value = data.orders; now.value = data.now; loaded.value = true; error.value = '';
  } catch { if (mine === generation) error.value = loaded.value ? 'stale' : 'failed'; }
  finally { if (mine === generation) loading.value = false; }
}
// Search and status live in the address, like the other admin lists.
function apply() {
  const query = {};
  if (q.value.trim()) query.q = q.value.trim();
  if (status.value !== 'all') query.status = status.value;
  router.replace({ query });
  load();
}
load();
</script>

<style scoped>
.member-admin { padding:20px max(16px, calc((100% - 960px) / 2)) 40px; height:100%; overflow-y:auto; box-sizing:border-box; }
.heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.heading h1 { margin:0; font-size:22px; }
.filters { display:flex; flex-wrap:wrap; gap:10px; margin:16px 0; }
.filters .el-input { flex:1; min-width:200px; }
.filters .el-select { width:180px; }
.rows { list-style:none; margin:0; padding:0; border-radius:14px; border:1px solid var(--el-border-color-lighter); overflow:hidden; background:var(--el-bg-color); }
.rows li { display:flex; flex-direction:column; gap:4px; padding:12px 14px; min-width:0; }
.rows li + li { border-top:1px solid var(--el-border-color-extra-light); }
.row-main { display:flex; justify-content:space-between; gap:8px; }
.email { font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.rows small { color:var(--el-text-color-secondary); overflow-wrap:anywhere; }
.order-id { font-family:monospace; font-size:11px; }
.order-status { font-size:12px; padding:2px 8px; border-radius:8px; background:var(--el-fill-color); flex-shrink:0; }
.order-status[data-status="paid"] { background:var(--el-color-success-light-9); color:var(--el-color-success-dark-2); }
.muted { color:var(--el-text-color-secondary); }
</style>
