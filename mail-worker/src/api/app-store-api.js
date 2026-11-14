import app from '../hono/hono';
import result from '../model/result';
import apps from '../service/app-store-service';

// App store. /apps: any signed-in user. /app-publish: app:publish. /app-review: app:review
// (enforced by security.js path permissions).
app.get('/apps', async (c) => c.json(result.ok(await apps.list(c, c.req.query()))));
app.get('/apps/:id', async (c) => c.json(result.ok(await apps.detail(c, c.req.param('id')))));
app.get('/apps/:id/card', async (c) => c.json(result.ok(await apps.card(c, c.req.param('id')))));
// Goes to the provider's official page; only the click is counted here.
app.post('/apps/:id/versions/:vid/download', async (c) => c.json(result.ok(await apps.download(c, c.req.param('id'), c.req.param('vid')))));

app.get('/app-publish/mine', async (c) => c.json(result.ok(await apps.mine(c))));
app.get('/app-publish/files', async (c) => c.json(result.ok(await apps.files(c))));
app.post('/app-publish', async (c) => c.json(result.ok(await apps.create(c, await c.req.json()))));
app.put('/app-publish/:id', async (c) => c.json(result.ok(await apps.update(c, c.req.param('id'), await c.req.json()))));
app.post('/app-publish/:id/versions', async (c) => c.json(result.ok(await apps.addVersion(c, c.req.param('id'), await c.req.json()))));
app.post('/app-publish/:id/submit', async (c) => c.json(result.ok(await apps.submit(c, c.req.param('id')))));
app.post('/app-publish/:id/hide', async (c) => c.json(result.ok(await apps.hide(c, c.req.param('id')))));
app.post('/app-publish/:id/versions/:vid/withdraw', async (c) => c.json(result.ok(await apps.withdrawVersion(c, c.req.param('id'), c.req.param('vid')))));

app.get('/app-review/queue', async (c) => c.json(result.ok(await apps.queue(c))));
app.post('/app-review/:id', async (c) => c.json(result.ok(await apps.reviewApp(c, c.req.param('id'), await c.req.json()))));
app.post('/app-review/:id/versions/:vid', async (c) => c.json(result.ok(await apps.reviewVersion(c, c.req.param('id'), c.req.param('vid'), await c.req.json()))));
