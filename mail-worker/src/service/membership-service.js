import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import { PLANS, DAY, planById, purchaseOpen, testPaymentsOpen } from '../lib/membership-rules.mjs';

// Cloud Mail membership, phase 1 (see init/membership-schema.js and lib/membership-rules.mjs).
//
//   - Prices, currency and duration come from the server's plan, never from the client.
//   - Purchases are off unless the deployment sets membership_purchase. No real payment
//     provider is connected yet.
//   - The test payment provider exists only when the deployment sets membership_test_payments
//     (local and isolated test environments). Otherwise its endpoint answers 404: production has
//     no way to mark an order paid without a real provider.
//   - A payment notice is applied in one D1 batch: the event is stored under its unique ID, the
//     order moves only along an allowed transition and only if amount and currency match, and the
//     entitlement changes only if that order update happened. A repeated notice changes nothing.

const fail = (message, code = 400) => { throw new BizError(message, code); };
const now = () => Math.floor(Date.now() / 1000);
export const purchaseEnabled = (c) => purchaseOpen(c.env);
export const testPaymentsEnabled = (c) => testPaymentsOpen(c.env);
const orderId = (value) => (typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : fail('Invalid order / 订单无效'));

function orderRow(row) {
	return {
		orderId: row.order_id, userId: row.user_id, planId: row.plan_id, amount: row.amount, currency: row.currency,
		days: row.days, demo: !!row.demo, provider: row.provider, status: row.status, fulfilment: row.fulfilment,
		failure: row.failure, createTime: row.create_time, paidTime: row.paid_time, updateTime: row.update_time,
		...(row.email !== undefined ? { email: row.email, expiresAt: row.expires_at || 0 } : {})
	};
}

const membershipService = {
	plans() {
		return PLANS.map((plan) => ({ planId: plan.id, days: plan.days, amount: plan.amount, currency: plan.currency, demo: plan.demo }));
	},

	async membership(c, userId) {
		const row = await c.env.db.prepare('SELECT plan_id, expires_at FROM site_membership WHERE user_id = ?').bind(userId).first();
		if (!row) return { active: false, expiresAt: 0, planId: '' };
		return { active: row.expires_at > now(), expiresAt: row.expires_at, planId: row.plan_id };
	},

	async me(c) {
		const userId = userContext.getUserId(c);
		const { results } = await c.env.db.prepare('SELECT * FROM member_order WHERE user_id = ? ORDER BY create_time DESC, rowid DESC LIMIT 50').bind(userId).all();
		return {
			now: now(), purchaseEnabled: purchaseEnabled(c), testPayments: testPaymentsEnabled(c),
			plans: this.plans(), membership: await this.membership(c, userId), orders: results.map(orderRow)
		};
	},

	async createOrder(c, params) {
		if (!purchaseEnabled(c)) fail('Purchases are not open / 暂未开放购买', 403);
		const plan = planById(params?.planId) || fail('Unknown plan / 套餐不存在');
		const userId = userContext.getUserId(c);
		const { count } = await c.env.db.prepare(`SELECT count(*) AS count FROM member_order WHERE user_id = ? AND status IN ('pending','failed')`).bind(userId).first();
		if (count >= 5) fail('Too many unpaid orders / 未支付订单过多，请先取消', 409);
		const id = crypto.randomUUID();
		// Only the test provider exists in this phase; a real provider is chosen later.
		const provider = testPaymentsEnabled(c) ? 'test' : 'none';
		await c.env.db.prepare(`INSERT INTO member_order(order_id, user_id, plan_id, amount, currency, days, demo, provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
			.bind(id, userId, plan.id, plan.amount, plan.currency, plan.days, plan.demo ? 1 : 0, provider).run();
		return orderRow(await c.env.db.prepare('SELECT * FROM member_order WHERE order_id = ?').bind(id).first());
	},

	async cancelOrder(c, rawId) {
		const id = orderId(rawId);
		const res = await c.env.db.prepare(`UPDATE member_order SET status = 'cancelled', update_time = ? WHERE order_id = ? AND user_id = ? AND status IN ('pending','failed')`)
			.bind(now(), id, userContext.getUserId(c)).run();
		if (!res.meta.changes) fail('Order cannot be cancelled / 订单无法取消', 409);
		return { status: 'cancelled' };
	},

	// Applies one provider notice. Returns { outcome: 'applied' | 'ignored' | 'duplicate', order }.
	async applyPaymentEvent(c, { eventId, orderId: id, provider, type, amount, currency }) {
		const db = c.env.db, t = now();
		if (typeof eventId !== 'string' || !/^[A-Za-z0-9_.:-]{8,120}$/.test(eventId)) fail('Invalid event / 事件无效');
		if (!['paid', 'failed', 'refunded'].includes(type)) fail('Invalid event type / 事件类型无效');
		const insert = db.prepare(`INSERT OR IGNORE INTO payment_event(event_id, order_id, provider, type, amount, currency, outcome) VALUES (?, ?, ?, ?, ?, ?, 'applied')`)
			.bind(eventId, id, provider, type, amount, currency);
		const matches = `order_id = ? AND provider = ? AND amount = ? AND currency = ? AND changes() = 1`;
		let statements;
		if (type === 'paid') {
			statements = [insert,
				db.prepare(`UPDATE member_order SET status = 'paid', fulfilment = 'granted', failure = '', paid_time = ?, update_time = ? WHERE status IN ('pending','failed') AND ${matches}`)
					.bind(t, t, id, provider, amount, currency),
				// Renewal: from the later of now and the current expiry (lib/membership-rules.mjs renewedExpiry).
				db.prepare(`INSERT INTO site_membership(user_id, plan_id, expires_at, update_time)
          SELECT o.user_id, o.plan_id, max(coalesce((SELECT m.expires_at FROM site_membership m WHERE m.user_id = o.user_id), 0), ?) + o.days * ${DAY}, ?
          FROM member_order o WHERE o.order_id = ? AND o.status = 'paid' AND changes() = 1
          ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, expires_at = excluded.expires_at, update_time = excluded.update_time`)
					.bind(t, t, id)];
		} else if (type === 'failed') {
			statements = [insert,
				db.prepare(`UPDATE member_order SET status = 'failed', failure = 'payment_failed', update_time = ? WHERE status = 'pending' AND ${matches}`)
					.bind(t, id, provider, amount, currency)];
		} else {
			statements = [insert,
				db.prepare(`UPDATE member_order SET status = 'refunded', fulfilment = 'revoked', update_time = ? WHERE status = 'paid' AND ${matches}`)
					.bind(t, id, provider, amount, currency),
				// Refund: remove this order's days, never before now (lib/membership-rules.mjs refundedExpiry).
				db.prepare(`UPDATE site_membership SET expires_at = max(expires_at - (SELECT days FROM member_order WHERE order_id = ?) * ${DAY}, ?), update_time = ?
          WHERE user_id = (SELECT user_id FROM member_order WHERE order_id = ? AND status = 'refunded') AND changes() = 1`)
					.bind(id, t, t, id)];
		}
		const results = await db.batch(statements);
		let outcome = 'applied';
		if (!results[0].meta.changes) outcome = 'duplicate';
		else if (!results[1].meta.changes) {
			outcome = 'ignored';
			await db.prepare(`UPDATE payment_event SET outcome = 'ignored' WHERE event_id = ?`).bind(eventId).run();
		}
		const order = await db.prepare('SELECT * FROM member_order WHERE order_id = ?').bind(id).first();
		return { outcome, order: order ? orderRow(order) : null };
	},

	// Test provider: local and isolated test environments only. The caller must own the order;
	// the amount and currency come from the order, as a real provider's notice would carry them.
	async testPayment(c, params) {
		if (!testPaymentsEnabled(c)) fail('Not found', 404);
		const id = orderId(params?.orderId);
		const order = await c.env.db.prepare('SELECT * FROM member_order WHERE order_id = ? AND user_id = ?').bind(id, userContext.getUserId(c)).first();
		if (!order) fail('Order not found / 订单不存在', 404);
		const eventId = typeof params?.eventId === 'string' ? params.eventId : `test-${crypto.randomUUID()}`;
		return this.applyPaymentEvent(c, { eventId, orderId: id, provider: 'test', type: params?.type, amount: order.amount, currency: order.currency });
	},

	// ---- Admin (member:query) ----
	async adminOrders(c, query = {}) {
		const status = ['pending', 'paid', 'failed', 'cancelled', 'refunded'].includes(query.status) ? query.status : '';
		const q = typeof query.q === 'string' ? query.q.trim().toLowerCase().slice(0, 120) : '';
		const where = ['1 = 1'], binds = [];
		if (status) { where.push('o.status = ?'); binds.push(status); }
		if (q) { where.push('(instr(lower(u.email), ?) > 0 OR o.order_id = ?)'); binds.push(q, q); }
		const { results } = await c.env.db.prepare(`SELECT o.*, u.email, m.expires_at FROM member_order o
      LEFT JOIN user u ON u.user_id = o.user_id LEFT JOIN site_membership m ON m.user_id = o.user_id
      WHERE ${where.join(' AND ')} ORDER BY o.create_time DESC, o.rowid DESC LIMIT 100`).bind(...binds).all();
		return { now: now(), orders: results.map(orderRow) };
	}
};

export default membershipService;
