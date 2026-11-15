<template>
  <div class="member">
    <div class="member-bar">
      <button type="button" class="member-back" :aria-label="t('navBack')" @click="back"><Icon icon="cloud-mail:back" width="22" /></button>
      <span>{{ t('memberTitle') }}</span>
    </div>
    <div class="member-body">
      <ListState :state="error" :retrying="loading" @retry="load" />
      <div v-if="!loaded && loading" class="member-loading" v-loading="true"></div>
      <template v-if="loaded">
        <section class="member-status" :class="{ active: data.membership.active }" data-member-status>
          <span class="status-icon" aria-hidden="true"><Icon icon="cloud-mail:shield" width="26" /></span>
          <div>
            <strong>{{ data.membership.active ? t('memberActive') : data.membership.expiresAt ? t('memberExpired') : t('memberNone') }}</strong>
            <p v-if="data.membership.expiresAt" data-member-expiry>{{ t(data.membership.active ? 'memberExpiresOn' : 'memberExpiredOn', { date: day(data.membership.expiresAt, locale) }) }}</p>
            <p v-else>{{ t('memberNoneHint') }}</p>
          </div>
        </section>

        <p class="member-notice" role="note">{{ t('memberDemoNotice') }}</p>

        <section class="member-section">
          <h2>{{ t('memberPlans') }}</h2>
          <div class="plans">
            <article v-for="plan in data.plans" :key="plan.planId" class="plan" :data-plan="plan.planId">
              <header><strong>{{ t('memberPlan_' + plan.planId) }}</strong><span v-if="plan.demo" class="demo-badge">{{ t('memberDemo') }}</span></header>
              <p class="price">{{ money(plan.amount, plan.currency, locale) }}</p>
              <p class="muted">{{ t('memberDays', { n: plan.days }) }}</p>
              <el-button type="primary" :disabled="!data.purchaseEnabled || !!busy" :loading="busy === plan.planId" @click="buy(plan)">{{ t('memberBuy') }}</el-button>
            </article>
          </div>
          <p v-if="!data.purchaseEnabled" class="muted" data-purchase-closed>{{ t('memberPurchaseClosed') }}</p>
        </section>

        <section class="member-section">
          <h2>{{ t('memberOrders') }}</h2>
          <p v-if="!data.orders.length" class="muted">{{ t('memberNoOrders') }}</p>
          <ul v-else class="orders">
            <li v-for="order in data.orders" :key="order.orderId" :data-order="order.orderId">
              <div class="order-main">
                <strong>{{ t('memberPlan_' + order.planId) }}</strong>
                <span class="order-status" :data-status="order.status">{{ t('memberStatus_' + order.status) }}</span>
              </div>
              <small>{{ money(order.amount, order.currency, locale) }} · {{ t('memberDays', { n: order.days }) }} · {{ dateTime(order.createTime, locale) }}<template v-if="order.demo"> · {{ t('memberDemo') }}</template></small>
              <small class="order-id">{{ order.orderId }}</small>
              <div v-if="actionsFor(order).length" class="order-actions">
                <el-button v-for="a in actionsFor(order)" :key="a.id" size="small" :type="a.type" :plain="a.test" :disabled="!!busy" :data-action="a.id" @click="a.run()">{{ a.label }}</el-button>
              </div>
            </li>
          </ul>
          <p v-if="data.testPayments" class="test-note" role="note">{{ t('memberTestNote') }}</p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import ListState from '@/components/list-state.vue';
import { memberMe, memberCreateOrder, memberCancelOrder, memberTestPayment } from '@/request/membership';
import { goBack } from '@/utils/go-back.js';
import { money, day, dateTime } from './format.js';

const { t, locale } = useI18n();
const router = useRouter();
const data = reactive({ plans: [], orders: [], membership: { active: false, expiresAt: 0 }, purchaseEnabled: false, testPayments: false });
const loaded = ref(false), loading = ref(false), error = ref(''), busy = ref('');

async function load() {
  loading.value = true;
  try { Object.assign(data, await memberMe()); loaded.value = true; error.value = ''; }
  catch { error.value = loaded.value ? 'stale' : 'failed'; }
  finally { loading.value = false; }
}
async function act(key, task) {
  if (busy.value) return;
  busy.value = key;
  try { await task(); } catch {} finally { busy.value = ''; await load(); }
}
function buy(plan) { act(plan.planId, () => memberCreateOrder(plan.planId)); }
// Test payment buttons appear only when the server says this is an isolated test environment.
function actionsFor(order) {
  const list = [];
  if (['pending', 'failed'].includes(order.status)) list.push({ id: 'cancel', label: t('memberCancel'), run: () => act(order.orderId, () => memberCancelOrder(order.orderId)) });
  if (!data.testPayments || order.provider !== 'test') return list;
  const test = (type, label) => ({ id: 'test-' + type, test: true, type: type === 'paid' ? 'primary' : type === 'refunded' ? 'warning' : 'danger', label,
    run: () => act(order.orderId, async () => { const r = await memberTestPayment(order.orderId, type); if (r.outcome !== 'applied') ElMessage.info(t('memberEventIgnored')); }) });
  if (['pending', 'failed'].includes(order.status)) list.push(test('paid', t('memberTestPaid')));
  if (order.status === 'pending') list.push(test('failed', t('memberTestFailed')));
  if (order.status === 'paid') list.push(test('refunded', t('memberTestRefund')));
  return list;
}
const back = () => goBack(router, '/me');
load();
</script>

<style scoped>
.member { height:100%; overflow-y:auto; box-sizing:border-box; }
.member-bar { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; height:52px; padding:0 max(8px, calc((100% - 760px) / 2)); background:var(--el-bg-color); border-bottom:1px solid var(--el-border-color-lighter); font-weight:600; }
.member-back { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:10px; background:none; color:var(--el-text-color-primary); cursor:pointer; }
.member-back:hover { background:var(--el-fill-color-light); }
.member-body { padding:20px max(16px, calc((100% - 760px) / 2)) 40px; }
.member-loading { min-height:200px; }
.member-status { display:flex; gap:14px; align-items:center; padding:18px; border-radius:16px; background:var(--el-fill-color-lighter); border:1px solid var(--el-border-color-lighter); }
.member-status.active { background:linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color)); border-color:var(--el-color-primary-light-7); }
.member-status p { margin:4px 0 0; color:var(--el-text-color-secondary); font-size:13px; }
.status-icon { display:grid; place-items:center; width:48px; height:48px; border-radius:14px; background:var(--el-bg-color); color:var(--el-color-primary); flex-shrink:0; }
.member-notice { margin:14px 0 0; padding:10px 12px; border-radius:10px; background:var(--el-color-warning-light-9); color:var(--el-color-warning-dark-2); font-size:13px; }
.member-section { margin-top:24px; }
.member-section h2 { margin:0 0 10px; font-size:16px; }
.plans { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap:12px; }
.plan { display:flex; flex-direction:column; gap:6px; padding:16px; border-radius:14px; border:1px solid var(--el-border-color-lighter); background:var(--el-bg-color); }
.plan header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.plan .price { margin:4px 0 0; font-size:24px; font-weight:700; }
.plan .el-button { margin-top:8px; }
.demo-badge { padding:2px 8px; border-radius:8px; background:var(--el-color-warning-light-8); color:var(--el-color-warning-dark-2); font-size:11px; font-weight:600; }
.orders { list-style:none; margin:0; padding:0; border-radius:14px; border:1px solid var(--el-border-color-lighter); overflow:hidden; }
.orders li { display:flex; flex-direction:column; gap:4px; padding:12px 14px; min-width:0; }
.orders li + li { border-top:1px solid var(--el-border-color-extra-light); }
.order-main { display:flex; justify-content:space-between; gap:8px; }
.order-status { font-size:12px; padding:2px 8px; border-radius:8px; background:var(--el-fill-color); }
.order-status[data-status="paid"] { background:var(--el-color-success-light-9); color:var(--el-color-success-dark-2); }
.order-status[data-status="failed"], .order-status[data-status="refunded"] { background:var(--el-color-danger-light-9); color:var(--el-color-danger); }
.orders small { color:var(--el-text-color-secondary); overflow-wrap:anywhere; }
.order-id { font-family:monospace; font-size:11px; }
.order-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
.order-actions .el-button { margin:0; }
.test-note { margin:10px 0 0; font-size:12px; color:var(--el-color-danger); }
.muted { color:var(--el-text-color-secondary); font-size:13px; margin:6px 0 0; }
</style>
