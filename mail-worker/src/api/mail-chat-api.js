import app from '../hono/hono';
import result from '../model/result';
import mail from '../service/mail-chat-service';
import r2Service from '../service/r2-service';

app.get('/mail-chat/conversations', async (c) =>
	c.json(result.ok(await mail.list(c, c.req.query())))
);
app.get('/mail-chat/messages', async (c) =>
	c.json(result.ok(await mail.messages(c, c.req.query())))
);
app.get('/mail-chat/message/:id', async (c) =>
	c.json(result.ok(await mail.detail(c, c.req.param('id'))))
);
app.get('/mail-chat/attachment/:id', async (c) => {
	const att = await mail.attachment(c, c.req.param('id'));
	const object = await r2Service.getObj(c, att.key);
	if (!object) return c.notFound();
	return new Response(object.body, {
		headers: {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': 'attachment',
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store'
		}
	});
});
app.put('/mail-chat/read', async (c) => {
	await mail.read(c, await c.req.json());
	return c.json(result.ok());
});
app.put('/mail-chat/pin', async (c) => {
	await mail.pin(c, await c.req.json());
	return c.json(result.ok());
});
app.post('/mail-chat/send', async (c) => c.json(result.ok(await mail.send(c, await c.req.json()))));
