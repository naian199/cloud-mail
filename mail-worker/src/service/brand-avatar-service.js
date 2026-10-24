import { brandDomain, fetchBrandIcon } from '../lib/brand-avatar';
import userContext from '../security/user-context';

export default {
  async get(c) {
    const domain = c.req.query('domain');
    if (!domain || brandDomain(domain) !== domain) return c.notFound();
    // Only existing correspondents can trigger a lookup, never arbitrary URLs.
    const known = await c.env.db.prepare(`SELECT 1 FROM email e WHERE e.user_id=? AND e.is_del=0 AND (
      lower(e.send_email) LIKE ? OR lower(e.send_email) LIKE ? OR EXISTS (
        SELECT 1 FROM json_each(CASE WHEN json_valid(e.conversation_peers) THEN e.conversation_peers ELSE '[]' END)
        WHERE lower(value) LIKE ? OR lower(value) LIKE ?)) LIMIT 1`)
      .bind(userContext.getUserId(c), '%@'+domain, '%@%.'+domain, '%@'+domain, '%@%.'+domain).first();
    if (!known) return c.notFound();
    const key = 'brand-avatar:v1:' + domain;
    const cached = await c.env.kv.getWithMetadata(key, { type: 'arrayBuffer' });
    if (cached.metadata?.missing) return c.notFound();
    if (cached.value) return new Response(cached.value, { headers: { 'Content-Type':'image/png', 'X-Content-Type-Options':'nosniff' } });
    const icon = await fetchBrandIcon(domain);
    if (!icon) {
      c.executionCtx.waitUntil(c.env.kv.put(key, '', { expirationTtl:600, metadata:{missing:true} }));
      return c.notFound();
    }
    c.executionCtx.waitUntil(c.env.kv.put(key,icon,{expirationTtl:604800}));
    return new Response(icon,{headers:{'Content-Type':'image/png','X-Content-Type-Options':'nosniff'}});
  }
};
