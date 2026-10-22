// Integration tests against an initialized, local Wrangler server; never remote data.
// Run: node --test test/chat.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const base = new URL(process.env.CHAT_TEST_BASE_URL || 'http://127.0.0.1:8787/api/');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Chat integration tests require a local Worker');
if (!base.pathname.endsWith('/')) base.pathname += '/';
async function api(path, token, method = 'GET', body) {
  const response = await fetch(new URL(path, base), {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return response.json();
}
async function createUser() {
  const credentials = { email: `chattest${randomBytes(8).toString('hex')}@example.com`, password: randomBytes(12).toString('hex') };
  assert.equal((await api('register', null, 'POST', credentials)).code, 200, 'Local registration must be enabled');
  const login = await api('login', null, 'POST', credentials);
  assert.equal(login.code, 200);
  const token = login.data.token;
  const profile = await api('my/loginUserInfo', token);
  return { token, email: credentials.email, id: profile.data.userId };
}
async function until(condition, message) {
  const end = Date.now() + 5000;
  while (!condition() && Date.now() < end) await delay(25);
  assert.ok(condition(), message);
}

await test('friends and private chat on the local Worker', { timeout: 60000 }, async t => {
  const [alice, bob, eve] = await Promise.all([createUser(), createUser(), createUser()]);
  let friendshipId, otherId, socket;
  try {
    await t.test('authentication, exact email lookup, self-add and unknown users', async () => {
      assert.equal((await api('chat/friends')).code, 401);
      assert.equal((await api('chat/friends', alice.token, 'POST', { email: alice.email })).code, 400);
      assert.equal((await api('chat/friends', alice.token, 'POST', { email: 'unknown' + randomUUID() + '@example.com' })).code, 404);
      assert.equal((await api('chat/friends', alice.token, 'POST', { email: '' })).code, 400);
    });
    await t.test('recipient consent, duplicate and crossed requests', async () => {
      const request = await api('chat/friends', alice.token, 'POST', { email: bob.email.toUpperCase() });
      assert.equal(request.code, 200); friendshipId = request.data.id;
      const duplicate = await api('chat/friends', bob.token, 'POST', { email: alice.email });
      assert.equal(duplicate.data.id, friendshipId);
      assert.equal((await api('chat/friends', bob.token)).data.length, 1);
      assert.equal((await api(`chat/friends/${friendshipId}`, alice.token, 'PUT', { accept: true })).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}`, eve.token, 'PUT', { accept: true })).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}/messages`, alice.token, 'POST', { body: 'too early', clientId: randomUUID() })).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}`, bob.token, 'PUT', { accept: true })).code, 200);
      assert.equal((await api('chat/friends', alice.token)).data[0].status, 'accepted');
    });
    await t.test('WebSocket authentication and immediate persisted message notification', async () => {
      const url = new URL('chat/socket', base); url.protocol = 'ws:';
      let rejected = false;
      const unauthorized = new WebSocket(url, ['cloud-mail-chat']);
      unauthorized.onerror = () => { rejected = true; };
      await until(() => rejected, 'WebSocket without authentication must be rejected');
      socket = new WebSocket(url, ['cloud-mail-chat', `auth.${bob.token}`]);
      let refreshes = 0;
      socket.onmessage = event => { if (event.data !== 'pong' && JSON.parse(event.data).type === 'refresh') refreshes++; };
      await until(() => refreshes > 0, 'Authenticated socket must connect');
      assert.equal(socket.protocol, 'cloud-mail-chat', 'The token subprotocol must never be echoed');
      const previous = refreshes;
      const message = await api(`chat/friends/${friendshipId}/messages`, alice.token, 'POST', { body: '你好，实时聊天！', clientId: randomUUID() });
      assert.equal(message.code, 200);
      await until(() => refreshes > previous, 'Recipient must get a push without polling');
      const history = await api(`chat/friends/${friendshipId}/messages`, bob.token);
      assert.equal(history.data.messages.at(-1).body, '你好，实时聊天！');
      assert.equal((await api('chat/friends', bob.token)).data[0].unread, 1);
      let pong = false; const listener = event => { if (event.data === 'pong') pong = true; };
      socket.addEventListener('message', listener); socket.send('ping');
      await until(() => pong, 'Hibernating sockets must answer heartbeat');
      socket.removeEventListener('message', listener);
    });
    await t.test('validation, idempotent retries and cross-user isolation', async () => {
      const path = `chat/friends/${friendshipId}/messages`, clientId = randomUUID();
      const payload = { body: '<img src=x onerror=alert(1)>', clientId };
      const one = await api(path, alice.token, 'POST', payload);
      const two = await api(path, alice.token, 'POST', payload);
      assert.equal(one.code, 200); assert.equal(two.data.id, one.data.id);
      assert.equal((await api(path, alice.token, 'POST', { ...payload, body: 'changed' })).code, 409);
      for (const body of ['', ' '.repeat(5), 'x'.repeat(2001), null]) {
        assert.equal((await api(path, alice.token, 'POST', { body, clientId: randomUUID() })).code, 400);
      }
      assert.equal((await api(path, alice.token, 'POST', { body: 'valid', clientId: 'bad' })).code, 400);
      assert.equal((await api(path, eve.token)).code, 403);
      assert.equal((await api(path, eve.token, 'POST', { body: 'intrusion', clientId: randomUUID() })).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}`, eve.token, 'DELETE')).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}/read`, eve.token, 'PUT', { messageId: one.data.id })).code, 403);
    });
    await t.test('history paging, gap recovery and monotonic read cursors', async () => {
      const path = `chat/friends/${friendshipId}/messages`;
      for (let i = 0; i < 55; i++) {
        assert.equal((await api(path, alice.token, 'POST', { body: `History ${i}`, clientId: randomUUID() })).code, 200);
      }
      const recent = (await api(path, bob.token)).data;
      assert.equal(recent.messages.length, 50); assert.equal(recent.hasMore, true);
      const older = (await api(`${path}?before=${recent.messages[0].id}`, bob.token)).data;
      assert.equal(older.messages.length, 7); assert.equal(older.hasMore, false);
      const all = [...older.messages, ...recent.messages];
      assert.equal(new Set(all.map(m => m.id)).size, 57);
      const after = (await api(`${path}?after=${all[0].id}`, bob.token)).data;
      assert.equal(after.messages.length, 50); assert.equal(after.hasMore, true);
      assert.equal(after.messages[0].id, all[1].id);
      const last = all.at(-1).id;
      assert.equal((await api(`chat/friends/${friendshipId}/read`, bob.token, 'PUT', { messageId: last })).code, 200);
      await api(`chat/friends/${friendshipId}/read`, bob.token, 'PUT', { messageId: all[0].id });
      assert.equal((await api('chat/friends', bob.token)).data[0].unread, 0);
      assert.equal((await api(`${path}?before=1&after=2`, bob.token)).code, 400);
      assert.equal((await api(`${path}?after=invalid`, bob.token)).code, 400);
    });
    await t.test('decline, cancel, removal and renewed friendship history isolation', async () => {
      const request = await api('chat/friends', eve.token, 'POST', { email: bob.email }); otherId = request.data.id;
      assert.equal((await api(`chat/friends/${otherId}`, bob.token, 'PUT', { accept: false })).code, 200);
      assert.equal((await api('chat/friends', eve.token)).data.length, 0);
      const again = await api('chat/friends', eve.token, 'POST', { email: bob.email }); otherId = again.data.id;
      assert.equal((await api(`chat/friends/${otherId}`, eve.token, 'DELETE')).code, 200); otherId = null;
      assert.equal((await api(`chat/friends/${friendshipId}`, alice.token, 'DELETE')).code, 200);
      assert.equal((await api(`chat/friends/${friendshipId}/messages`, bob.token)).code, 403);
      assert.equal((await api(`chat/friends/${friendshipId}/messages`, alice.token, 'POST', { body: 'after removal', clientId: randomUUID() })).code, 403);
      const renewed = await api('chat/friends', alice.token, 'POST', { email: bob.email }); friendshipId = renewed.data.id;
      await api(`chat/friends/${friendshipId}`, bob.token, 'PUT', { accept: true });
      assert.deepEqual((await api(`chat/friends/${friendshipId}/messages`, alice.token)).data.messages, []);
    });
  } finally {
    socket?.close();
    if (friendshipId) await api(`chat/friends/${friendshipId}`, alice.token, 'DELETE');
    if (otherId) await api(`chat/friends/${otherId}`, eve.token, 'DELETE');
    for (const user of [alice, bob, eve]) await api('logout', user.token, 'DELETE');
  }
});
