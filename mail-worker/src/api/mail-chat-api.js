import universalSearch from '../service/universal-search-service';
import linkPreview from '../service/link-preview-service';
import app from '../hono/hono';
import result from '../model/result';
import mail from '../service/mail-chat-service';
import r2Service from '../service/r2-service';
import live from '../service/mail-live-service';
import translation from '../service/translation-service';
import stickers from '../service/sticker-service';
import brandAvatar from '../service/brand-avatar-service';
app.get('/mail-chat/brand-avatar', c => brandAvatar.get(c));
app.get('/mail-chat/stickers/pack', async c => c.json(result.ok(await stickers.pack(c, c.req.query('name')))));
app.get('/mail-chat/stickers/file', async c => stickers.file(c,c.req.query('name'),c.req.query('id')));

app.get('/mail-chat/translation/config', async (c) => c.json(result.ok(translation.publicConfig(await translation.config(c)))));
app.post('/mail-chat/translate', async (c) => c.json(result.ok(await translation.translate(c, await c.req.json()))));

app.post('/mail-chat/link-preview',async c=>c.json(result.ok(await linkPreview.get(c,await c.req.json()))));
app.post('/mail-chat/link-preview-image',async c=>{
  const image=await linkPreview.image(c,await c.req.json());
  if(!image)return c.notFound();
  return new Response(image.data,{headers:{'Content-Type':image.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});

app.get('/mail-chat/conversations', async (c) =>
	c.json(result.ok(await mail.list(c, c.req.query())))
);
app.get('/mail-chat/search', async c => c.json(result.ok(await universalSearch.search(c,c.req.query()))));
app.get('/mail-chat/explore', async (c) => c.json(result.ok(await mail.explore(c, c.req.query()))));
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

app.get('/mail-chat/live', async (c) => {
	const q = c.req.query();
	return c.json(result.ok(await live.status(c, await mail.account(c, q.accountId), q.key)));
});
app.put('/mail-chat/presence', async (c) => {
	const p = await c.req.json();
	await live.pulse(c, await mail.account(c, p.accountId), p);
	return c.json(result.ok());
});
app.post('/mail-chat/delete-self', async c => {
  await mail.removeSelf(c, await c.req.json());
  return c.json(result.ok());
});
app.post('/mail-chat/delete', async (c) => {
	const p = await c.req.json();
	if (typeof p.key !== 'string' || !/^[a-f0-9]{64}$/.test(p.key))
		return c.json(result.fail('Invalid conversation', 400));
	await live.remove(c, await mail.account(c, p.accountId), p);
	return c.json(result.ok());
});
app.post('/mail-chat/open', async (c) => {
	const p = await c.req.json();
	return c.json(result.ok(await live.open(c, await mail.account(c, p.accountId), p.email)));
});
app.post('/mail-chat/instant', async (c) =>
	c.json(result.ok(await mail.send(c, await c.req.json(), true)))
);
