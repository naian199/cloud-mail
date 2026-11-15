import app from '../hono/hono';
import result from '../model/result';
import membership from '../service/membership-service';

// Cloud Mail membership. /member: any signed-in user, for their own orders only.
// /member-admin: member:query (security.js). /member/test-payments: only where the deployment
// enables test payments; it answers 404 everywhere else.
app.get('/member/me', async (c) => c.json(result.ok(await membership.me(c))));
app.post('/member/orders', async (c) => c.json(result.ok(await membership.createOrder(c, await c.req.json()))));
app.post('/member/orders/:id/cancel', async (c) => c.json(result.ok(await membership.cancelOrder(c, c.req.param('id')))));
app.post('/member/test-payments', async (c) => c.json(result.ok(await membership.testPayment(c, await c.req.json()))));
app.get('/member-admin/orders', async (c) => c.json(result.ok(await membership.adminOrders(c, c.req.query()))));
