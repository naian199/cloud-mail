import app from '../hono/hono';
import result from '../model/result';
import largeAtt from '../service/large-att-service';

// Large attachments (CostAction/Turbobit). Every route requires a signed-in user;
// the service checks the feature switch, the user's role and ownership.
app.get('/large-att/config', async (c) => c.json(result.ok(await largeAtt.config(c))));
app.post('/large-att/begin', async (c) => c.json(result.ok(await largeAtt.begin(c, await c.req.json()))));
app.post('/large-att/:id/upload', async (c) => c.json(result.ok(await largeAtt.upload(c, c.req.param('id')))));
app.post('/large-att/:id/direct', async (c) => c.json(result.ok(await largeAtt.direct(c, c.req.param('id')))));
app.post('/large-att/complete', async (c) => c.json(result.ok(await largeAtt.complete(c, await c.req.json()))));
app.post('/large-att/failed', async (c) => {
	await largeAtt.markFailed(c, await c.req.json());
	return c.json(result.ok());
});
app.get('/large-att/:id/link', async (c) => c.json(result.ok(await largeAtt.link(c, c.req.param('id')))));
app.delete('/large-att/:id', async (c) => {
	await largeAtt.remove(c, c.req.param('id'));
	return c.json(result.ok());
});
// Administrators only (setting:set, see security.js).
app.post('/setting/costactionTest', async (c) => c.json(result.ok(await largeAtt.testConnection(c, await c.req.json().catch(() => ({}))))));
