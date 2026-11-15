import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY, PLANS, planById, renewedExpiry, refundedExpiry, canMove, purchaseOpen, testPaymentsOpen } from '../src/lib/membership-rules.mjs';

const now = 1_800_000_000;

test('plans are fixed on the server and marked as demos', () => {
	assert.ok(PLANS.length > 0);
	for (const plan of PLANS) {
		assert.equal(plan.demo, true);
		assert.ok(Number.isInteger(plan.amount) && plan.amount > 0);
		assert.ok(Number.isInteger(plan.days) && plan.days > 0);
		assert.ok(Object.isFrozen(plan));
	}
	assert.equal(planById('nope'), null);
});

test('renewal adds to an active membership and restarts an expired one from now', () => {
	assert.equal(renewedExpiry(now + 10 * DAY, now, 30), now + 40 * DAY);
	assert.equal(renewedExpiry(now - 5 * DAY, now, 30), now + 30 * DAY);
	assert.equal(renewedExpiry(0, now, 30), now + 30 * DAY);
});

test('a refund removes only that order’s days and never sets an expiry before now', () => {
	assert.equal(refundedExpiry(now + 60 * DAY, now, 30), now + 30 * DAY);
	assert.equal(refundedExpiry(now + 10 * DAY, now, 30), now);
});

test('order states move only along the allowed edges', () => {
	assert.ok(canMove('pending', 'paid'));
	assert.ok(canMove('failed', 'paid'));
	assert.ok(canMove('pending', 'failed'));
	assert.ok(canMove('paid', 'refunded'));
	assert.ok(canMove('pending', 'cancelled'));
	for (const [from, to] of [['paid', 'paid'], ['paid', 'failed'], ['paid', 'cancelled'], ['cancelled', 'paid'], ['refunded', 'paid'], ['pending', 'refunded']]) {
		assert.equal(canMove(from, to), false, `${from} -> ${to}`);
	}
});

test('purchases and test payments are off unless the deployment turns them on', () => {
	assert.equal(purchaseOpen({}), false);
	assert.equal(testPaymentsOpen({}), false);
	assert.equal(testPaymentsOpen({ membership_test_payments: '0' }), false);
	assert.equal(testPaymentsOpen({ membership_test_payments: '1' }), true);
	// The production deploy config sets neither switch.
	const production = readFileSync(new URL('../wrangler-action.toml', import.meta.url), 'utf8');
	assert.doesNotMatch(production, /membership_(purchase|test_payments)/);
});
