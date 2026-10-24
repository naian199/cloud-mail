import { parse } from 'tldts';

export function brandDomain(value) {
  if (typeof value !== 'string' || value.length > 254) return null;
  const raw = value.slice(value.lastIndexOf('@') + 1).toLowerCase();
  if (!raw || /[\s/:?#%\\\[\]@]/.test(raw)) return null;
  try {
    const host = new URL('https://' + raw).hostname;
    const parsed = parse(host, { allowPrivateDomains: true });
    return !parsed.isIp && (parsed.isIcann || parsed.isPrivate) ? parsed.domain : null;
  } catch { return null; }
}

const MAX_BYTES = 65536;
function permitted(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
    ((url.hostname === 'www.google.com' && url.pathname === '/s2/favicons') ||
      (/^t\d+\.gstatic\.com$/.test(url.hostname) && url.pathname === '/faviconV2'));
}

export async function fetchBrandIcon(domain, fetcher = fetch) {
  if (brandDomain(domain) !== domain) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let url = new URL('https://www.google.com/s2/favicons');
    url.searchParams.set('domain', domain);
    url.searchParams.set('sz', '64');
    for (let redirects = 0; redirects <= 2; redirects++) {
      if (!permitted(url)) return null;
      const response = await fetcher(url.toString(), { redirect: 'manual', signal: controller.signal, headers: { Accept: 'image/png' } });
      if ([301,302,303,307,308].includes(response.status)) {
        if (!response.headers.get('Location')) return null;
        url = new URL(response.headers.get('Location'), url);
        await response.body?.cancel();
        continue;
      }
      if (!response.ok || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'image/png' || Number(response.headers.get('Content-Length')) > MAX_BYTES || !response.body) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body.getReader(), chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > MAX_BYTES) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
      if (length < 24 || ![137,80,78,71,13,10,26,10].every((byte,i) => bytes[i] === byte)) return null;
      if (![73,72,68,82].every((byte,i) => bytes[i+12] === byte)) return null;
      const view = new DataView(bytes.buffer);
      if (view.getUint32(16) < 1 || view.getUint32(16) > 256 || view.getUint32(20) < 1 || view.getUint32(20) > 256) return null;
      return bytes;
    }
  } catch { /* A missing or unavailable icon uses the existing letter avatar. */ }
  finally { clearTimeout(timer); }
  return null;
}
