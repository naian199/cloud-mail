import r2Service from '../service/r2-service';
import app from '../hono/hono';
import {revokedAttachment} from '../service/removed-mail-service';

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	if(await revokedAttachment(c.env,key))return c.notFound();
  const obj = await r2Service.getObj(c, key);
  if(!obj)return c.notFound();
	return new Response(obj.body, {
		headers: {
			'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
			'Content-Disposition': obj.httpMetadata?.contentDisposition || null
		}
	});
});


