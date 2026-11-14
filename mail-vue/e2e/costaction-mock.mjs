// A local stand-in for the CostAction API and its upload host, for the end-to-end tests.
// Nothing reaches the real service.
import { createServer } from 'node:http';

export function startCostActionMock(port, token) {
  const origin = `http://127.0.0.1:${port}`;
  const files = new Map(), folders = [];
  let uploads = 0, nextFile = 1;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const send = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    const url = new URL(req.url, origin);
    // Like the real upload hosts: a CORS preflight gets 202 with no allow headers, while the
    // upload itself answers with Access-Control-Allow-Origin: *.
    if (url.pathname.startsWith('/upload/') && req.method === 'OPTIONS') { res.writeHead(202); return res.end(); }
    if (url.pathname.startsWith('/upload/')) {
      res.setHeader('access-control-allow-origin', '*');
      const form = await new Response(body, { headers: { 'content-type': req.headers['content-type'] } }).formData();
      const file = form.get('file');
      if (!file) return send(400, { status: 'error', message: 'Wrong upload url' });
      const id = `e2efile${nextFile++}`;
      files.set(id, { id, name: file.name, size: file.size, deleted: false });
      return send(200, { id, message: 'Everything is ok', status: 'success' });
    }
    if (req.headers.authorization !== `Bearer ${token}`) return send(401, { message: 'This action is unauthorized.', status: 'error' });
    const json = () => JSON.parse(body.toString() || '{}');
    if (req.method === 'POST' && url.pathname === '/v1/file/upload_url') return send(200, { url: `${origin}/upload/${++uploads}`, expire: '2099-01-01 00:00:00', status: 'success' });
    if (req.method === 'POST' && url.pathname === '/v1/folder/create') {
      const { name, parent_folder_id: parent = null } = json();
      if (folders.some((f) => f.name === name && f.parent === parent)) return send(422, { status: 'error', message: 'Folder with the same name already exists' });
      folders.push({ id: 500 + folders.length, name, parent });
      return send(201, { folder: { id: 500 + folders.length - 1, name }, status: 'success' });
    }
    if (req.method === 'POST' && url.pathname === '/v1/folders/search') {
      const { name } = json();
      return send(200, { last_page: 1, data: folders.filter((f) => f.name === name).map((f) => ({ id: f.id, name: f.name, parent_folder_id: f.parent })), status: 'success' });
    }
    const match = url.pathname.match(/^\/v1\/file\/([^/]+)(\/share)?$/);
    const file = match && files.get(match[1]);
    if (!file) return send(404, { message: 'File not found or wrong ID', status: 'error' });
    if (match[2]) return send(200, { links: { for_downloading: { standard: `https://turbobit.net/${file.id}.html`, with_file_name: `https://turbobit.net/${file.id}/${encodeURIComponent(file.name)}.html` } }, status: 'success' });
    return send(200, { file: { id: file.id, name: file.name, size_in_bytes: file.size, is_deleted: file.deleted, days_left: 30 }, status: 'success' });
  });
  server.listen(port, '127.0.0.1');
  return { origin, files, close: () => server.close() };
}
