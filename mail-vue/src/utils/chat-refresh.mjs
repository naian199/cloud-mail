import { mailDate } from './mail-chat-display.js';

export function compareMessages(a, b) {
  return mailDate(a.createTime) - mailDate(b.createTime) || a.emailId - b.emailId;
}

export function messageRows(rows) {
  const identities = new Set();
  return [...new Map(rows.map(row => [row.emailId, row])).values()]
    .sort(compareMessages)
    .filter(row => {
      const identity = row.messageId ? `${row.type}:${row.messageId}` : `id:${row.emailId}`;
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
}

// Gather the complete currently loaded range before exposing a new deletion
// revision. An incremental response alone cannot describe which old rows remain.
export async function collectSnapshot(first, oldest, fetchBefore) {
  let page = first;
  let rows = first.messages;
  while (page.hasMore && rows.length && oldest && compareMessages(rows[0], oldest) > 0) {
    const before = rows[0].emailId;
    page = await fetchBefore(before);
    if (!page || page.revision !== first.revision) return null;
    if (!page.messages.length) break;
    if (compareMessages(page.messages[0], rows[0]) >= 0) throw Error('Invalid snapshot cursor');
    rows = messageRows([...page.messages, ...rows]);
  }
  return { ...first, messages: rows, hasMore: page.hasMore };
}
