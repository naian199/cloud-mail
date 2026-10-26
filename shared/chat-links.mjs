const pattern = /https?:\/\/[^\s<>"']+/gi;
export function normalizeChatLink(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2048) return null;
    return url.href;
  } catch { return null; }
}
export function chatLinkParts(text = '') {
  const source = String(text), parts = []; let offset = 0;
  for (const match of source.matchAll(pattern)) {
    if(match[0].length>4096)continue;
    let value = match[0].replace(/[.,;!?，。；！？]+$/u, '');
    const counts={};for(const char of value)if('()[]{}'.includes(char))counts[char]=(counts[char]||0)+1;
    while (/[)\]}]$/.test(value)) {
      const end = value.at(-1), start = { ')':'(', ']':'[', '}':'{' }[end];
      if ((counts[end]||0) <= (counts[start]||0)) break;
      counts[end]--;value = value.slice(0,-1);
    }
    const url = normalizeChatLink(value); if (!url) continue;
    if (match.index > offset) parts.push({ text:source.slice(offset,match.index) });
    parts.push({ text:value,url }); offset = match.index + value.length;
  }
  if (offset < source.length || !parts.length) parts.push({ text:source.slice(offset) });
  return parts;
}
export const chatLinks = text => [...new Set(chatLinkParts(text).filter(part=>part.url).map(part=>part.url))];
