// Cloud Mail membership: plans and the pure rules the service applies. No storage here, so the
// same rules are unit-tested in Node.
//
// Scope of this phase: only the Cloud Mail site entitlement ("site"). Vendor memberships (an
// official reseller channel) and CostAction confirmed earnings are separate things with their
// own records later; nothing here creates, buys or grants anything outside this site.

export const DAY = 86400;

// Prices, currency and duration are fixed on the server; the client only names a plan.
// Every plan is a demo until real prices and benefits are decided.
export const PLANS = Object.freeze([
	Object.freeze({ id: 'demo-month', days: 30, amount: 100, currency: 'CNY', demo: true }),
	Object.freeze({ id: 'demo-year', days: 365, amount: 1000, currency: 'CNY', demo: true })
]);
export const planById = (id) => PLANS.find((plan) => plan.id === id) || null;

// A paid period starts at the later of now and the current expiry: renewing an active
// membership adds to its end; an expired one starts again from now.
export function renewedExpiry(currentExpiry, now, days) {
	const base = Math.max(Number(currentExpiry) || 0, now);
	return base + days * DAY;
}

// A refund removes the order's days, but never sets an expiry before now (the membership simply
// ends) and never touches time the user paid for with other orders.
export function refundedExpiry(currentExpiry, now, days) {
	const remaining = (Number(currentExpiry) || 0) - days * DAY;
	return Math.max(remaining, now);
}

// Order status transitions. Payment events move an order only along these edges; anything else
// is refused (and recorded as ignored), so a late or repeated notice cannot undo a later state.
//   pending -> paid | failed | cancelled
//   failed  -> paid | cancelled      (a retried payment can still succeed)
//   paid    -> refunded
export const TRANSITIONS = Object.freeze({
	paid: ['pending', 'failed'],
	failed: ['pending'],
	cancelled: ['pending', 'failed'],
	refunded: ['paid']
});
export const canMove = (from, to) => (TRANSITIONS[to] || []).includes(from);

// Deployment switches. Both are off unless the deployment sets them; the production deploy
// config sets neither, so production has no purchase entry and no test payment provider.
const on = (value) => value === true || value === 1 || value === '1' || value === 'true';
export const purchaseOpen = (env) => on(env?.membership_purchase);
export const testPaymentsOpen = (env) => on(env?.membership_test_payments);
