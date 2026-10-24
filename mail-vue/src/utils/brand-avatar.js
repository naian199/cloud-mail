const icons = new Map();

export function brandAvatarBlob(domain) {
  const cached = icons.get(domain);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Date.now() + 300000 };
  entry.promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(`${import.meta.env.VITE_BASE_URL}/mail-chat/brand-avatar`, location.origin);
      url.searchParams.set('domain', domain);
      const response = await fetch(url, { signal: controller.signal, headers: { Authorization: localStorage.getItem('token') || '' } });
      if (!response.ok || response.headers.get('Content-Type')?.split(';')[0] !== 'image/png') return null;
      const blob = await response.blob();
      if (blob.size > 65536) return null;
      entry.expires = Date.now() + 3600000;
      return blob;
    } catch { return null; }
    finally { clearTimeout(timer); }
  })();
  icons.set(domain, entry);
  while (icons.size > 128) icons.delete(icons.keys().next().value);
  return entry.promise;
}
