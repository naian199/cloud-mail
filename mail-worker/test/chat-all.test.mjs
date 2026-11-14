import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeChats, unreadTotal } from '../../shared/chat-all.mjs';

const direct = (key, t, unread = 0) => ({ key, createTime: t, unread });
const room = (id, t, extra = {}) => ({ id, kind: 'group', status: 'joined', latestAt: t, ...extra });

test('newest first across direct chats and rooms', () => {
  const { items } = mergeChats({ direct: [direct('a', '2026-11-14 10:00:00'), direct('b', '2026-11-14 08:00:00')], rooms: [room('r', '2026-11-14 09:00:00')] });
  assert.deepEqual(items.map((i) => i.id), ['a', 'r', 'b']);
});

test('while direct chats have more pages, older rooms wait instead of showing above them', () => {
  const page = { direct: [direct('a', '2026-11-14 10:00:00'), direct('b', '2026-11-14 08:00:00')], rooms: [room('new', '2026-11-14 09:00:00'), room('old', '2026-11-01 00:00:00')] };
  const partial = mergeChats({ ...page, directHasMore: true });
  assert.deepEqual(partial.items.map((i) => i.id), ['a', 'new', 'b']);
  assert.equal(partial.held, 1);
  assert.equal(partial.complete, false);
  const full = mergeChats({ ...page, directHasMore: false });
  assert.deepEqual(full.items.map((i) => i.id), ['a', 'new', 'b', 'old']);
});

test('invitations stay on top and out of the time order', () => {
  const { invites, items } = mergeChats({ rooms: [room('joined', '2026-11-14 09:00:00'), room('inv', '2020-01-01 00:00:00', { status: 'invited', kind: 'channel' })] });
  assert.deepEqual(invites.map((i) => i.id), ['inv']);
  assert.deepEqual(items.map((i) => i.id), ['joined']);
});

test('unread adds both sources and reports when a room count is capped', () => {
  assert.deepEqual(unreadTotal({ direct: [direct('a', '', 2)], rooms: [room('r', '', { unread: 3 })] }), { total: 5, capped: false });
  assert.equal(unreadTotal({ rooms: [room('r', '', { unread: 100 })] }).capped, true);
});
