import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import { removedMail, removedAttachment } from '../service/removed-mail-service';
import r2Service from '../service/r2-service';

app.get('/allEmail/list', async (c) => {
	const data = await emailService.allList(c, c.req.query());
	return c.json(result.ok(data));
});

app.delete('/allEmail/delete', async (c) => {
	const list = await emailService.physicsDelete(c, c.req.query());
	return c.json(result.ok(list));
});

app.delete('/allEmail/batchDelete', async (c) => {
	await emailService.batchDelete(c, c.req.query());
	return c.json(result.ok());
});

app.get('/allEmail/latest', async (c) => {
	const list = await emailService.allEmailLatest(c, c.req.query());
	return c.json(result.ok(list));
});

app.get('/allEmail/removed/:id', async (c) =>
	c.json(result.ok(await removedMail(c, c.req.param('id'))))
);
app.get('/allEmail/removed/:id/attachment/:attId', async (c) => {
	const att = await removedAttachment(c, c.req.param('id'), c.req.param('attId'));
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
