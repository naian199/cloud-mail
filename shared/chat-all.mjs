// The "All" chat list: direct conversations (one mailbox, loaded page by page) and groups and
// channels (all loaded at once) in one list, newest first.
//
// The two sources page differently, so a plain merge would show older rooms above direct chats
// that have not loaded yet, and they would jump in later. While direct chats have more pages,
// only items at least as new as the oldest loaded direct chat are shown; the rest appear as more
// pages load. Room invitations are not part of the time order: they stay on top.
//
// Times are the server's UTC "YYYY-MM-DD HH:MM:SS" strings, which compare correctly as text.

const stamp = (value) => String(value || '').replace('T', ' ').slice(0, 19);

export function mergeChats({ direct = [], directHasMore = false, rooms = [] } = {}) {
  const invites = rooms.filter((r) => r.status === 'invited').map((r) => ({ type: r.kind, id: r.id, time: stamp(r.latestAt), source: r }));
  const items = [
    ...direct.map((c) => ({ type: 'direct', id: c.key, time: stamp(c.createTime), source: c })),
    ...rooms.filter((r) => r.status === 'joined').map((r) => ({ type: r.kind, id: r.id, time: stamp(r.latestAt), source: r }))
  ].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : String(a.id).localeCompare(String(b.id))));
  let shown = items, held = 0;
  if (directHasMore && direct.length) {
    const boundary = direct.map((c) => stamp(c.createTime)).sort()[0];
    shown = items.filter((item) => item.time >= boundary);
    held = items.length - shown.length;
  }
  return { invites, items: shown, held, complete: !directHasMore };
}

// Unread across both sources; each room's count is capped at 100 by the server, so the total
// is a lower bound once any room reaches it.
export function unreadTotal({ direct = [], rooms = [] } = {}) {
  let total = 0, capped = false;
  for (const c of direct) total += Number(c.unread) || 0;
  for (const r of rooms) { const n = Number(r.unread) || 0; total += n; if (n >= 100) capped = true; }
  return { total, capped };
}
