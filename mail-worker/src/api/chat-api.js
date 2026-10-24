import app from '../hono/hono';
import result from '../model/result';
import chat from '../service/chat-service';
import contacts from '../service/contact-service';

app.get('/chat/users', async c => c.json(result.ok(await contacts.search(c, c.req.query()))));
app.put('/chat/contacts/note', async c => c.json(result.ok(await contacts.note(c, await c.req.json()))));

app.get('/chat/socket', c => chat.socket(c));
app.get('/chat/friends', async c => c.json(result.ok(await chat.list(c))));
app.post('/chat/friends', async c => c.json(result.ok(await chat.request(c, await c.req.json()))));
app.put('/chat/friends/:id', async c => {
  await chat.respond(c, c.req.param('id'), await c.req.json());
  return c.json(result.ok());
});
app.delete('/chat/friends/:id', async c => {
  await chat.remove(c, c.req.param('id'));
  return c.json(result.ok());
});
app.get('/chat/friends/:id/messages', async c => c.json(result.ok(await chat.messages(c, c.req.param('id'), c.req.query()))));
app.post('/chat/friends/:id/messages', async c => c.json(result.ok(await chat.send(c, c.req.param('id'), await c.req.json()))));
app.put('/chat/friends/:id/read', async c => {
  await chat.read(c, c.req.param('id'), await c.req.json());
  return c.json(result.ok());
});
