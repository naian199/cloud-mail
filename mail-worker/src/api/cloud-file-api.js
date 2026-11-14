import app from '../hono/hono';
import result from '../model/result';
import cloudFile from '../service/cloud-file-service';

// Personal document library and CostAction file access. Every route needs a signed-in user;
// the service checks that the file is in the user's library or reachable from their messages.
app.get('/cloud-file/list', async (c) => c.json(result.ok(await cloudFile.list(c, c.req.query()))));
// Download goes to the official share page; clicking is recorded, not treated as a finished download.
app.post('/cloud-file/:id/download', async (c) => c.json(result.ok(await cloudFile.download(c, c.req.param('id')))));
// The user opened the preview on purpose.
app.post('/cloud-file/:id/view', async (c) => c.json(result.ok(await cloudFile.view(c, c.req.param('id')))));
app.get('/cloud-file/:id/preview', async (c) => {
	const { body, type } = await cloudFile.previewObject(c, c.req.param('id'));
	return new Response(body, {
		headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'" }
	});
});
app.put('/cloud-file/:id/preview', async (c) => c.json(result.ok(await cloudFile.putPreview(c, c.req.param('id')))));
// Removes the entry from the user's own library only.
app.delete('/cloud-file/:id', async (c) => {
	await cloudFile.removeEntry(c, c.req.param('id'));
	return c.json(result.ok());
});
