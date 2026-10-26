import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSnapshot, messageRows } from '../../mail-vue/src/utils/chat-refresh.mjs';

const row = id => ({ emailId: id, createTime: '2026-10-26 01:00:00', type: 0, messageId: `<${id}>` });

test('refresh gathers the loaded history before returning an atomic deletion snapshot', async () => {
  const existing = Array.from({ length: 45 }, (_, i) => row(i + 1));
  const fresh = existing.filter(item => item.emailId !== 44);
  const calls = [];
  const first = { messages: fresh.slice(-20), revision: 1, hasMore: true };
  const result = await collectSnapshot(first, existing[0], async before => {
    calls.push(before);
    assert.equal(existing.length, 45, 'the displayed list must not be cleared while loading');
    const older = fresh.filter(item => item.emailId < before);
    return { messages: older.slice(-20), revision: 1, hasMore: older.length > 20 };
  });
  assert.equal(calls.length, 2);
  assert.equal(result.messages.length, 44);
  assert.equal(result.messages[0].emailId, 1);
  assert(!result.messages.some(item => item.emailId === 44));
  assert.equal(result.hasMore, false);
});

test('mixed deletion revisions are discarded rather than partially rendered', async () => {
  const result = await collectSnapshot({ messages: [row(3)], revision: 1, hasMore: true }, row(1),
    async () => ({ messages: [row(1)], revision: 2, hasMore: false }));
  assert.equal(result, null);
});

test('empty snapshots and snapshots covering the loaded range require no extra requests', async () => {
  const fetch = () => { throw Error('Unexpected extra fetch'); };
  assert.deepEqual((await collectSnapshot({ messages: [], revision: 2, hasMore: false }, row(1), fetch)).messages, []);
  assert.equal((await collectSnapshot({ messages: [row(1),row(2)], revision: 1, hasMore: true }, row(2), fetch)).messages.length, 2);
});

test('message normalization retains keyed identities and refreshed metadata', () => {
  const updated = { ...row(2), read: true };
  assert.deepEqual(messageRows([row(2),row(1),updated]).map(item=>item.emailId), [1,2]);
  assert.equal(messageRows([row(2),updated])[0], updated);
});
