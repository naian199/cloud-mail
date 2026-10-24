import test from 'node:test';
import assert from 'node:assert/strict';
import { brandDomain, fetchBrandIcon } from '../src/lib/brand-avatar.js';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=', 'base64'));
test('sender domains use public and private suffix rules instead of taking two labels', () => {
  assert.equal(brandDomain('info@e.atlassian.com'), 'atlassian.com');
  assert.equal(brandDomain('sender@news.example.co.uk'), 'example.co.uk');
  assert.equal(brandDomain('sender@alice.github.io'), 'alice.github.io');
  assert.equal(brandDomain('sender@bob.github.io'), 'bob.github.io');
  for (const value of ['a@localhost','a@127.0.0.1','a@[::1]','a@example.com/path','a@co.uk','https://example.com','a@internal.invalid']) assert.equal(brandDomain(value),null);
});
test('favicon requests disclose only the domain and follow only fixed trusted image endpoints', async () => {
  let requests=0;
  const icon=await fetchBrandIcon('atlassian.com',async (url, options) => {
    requests++;
    assert.equal(options.redirect,'manual');
    assert.equal('Authorization' in options.headers,false);
    if(requests===1) {
      assert.equal(new URL(url).searchParams.get('domain'),'atlassian.com');
      return new Response(null,{status:302,headers:{Location:'https://t2.gstatic.com/faviconV2?url=https%3A%2F%2Fatlassian.com'}});
    }
    return new Response(png,{headers:{'Content-Type':'image/png'}});
  });
  assert.deepEqual(icon,png);assert.equal(requests,2);
  for (const target of ['http://t2.gstatic.com/faviconV2','https://127.0.0.1/faviconV2','https://evil.example/faviconV2','https://t2.gstatic.com:8443/faviconV2','https://t2.gstatic.com/other']) {
    let calls=0;
    assert.equal(await fetchBrandIcon('atlassian.com',async()=>{calls++;return new Response(null,{status:302,headers:{Location:target}})}),null);
    assert.equal(calls,1);
  }
});
test('missing, oversized, active and malformed image payloads fall back without rendering',async()=>{
  for(const response of [new Response('svg',{headers:{'Content-Type':'image/svg+xml'}}),new Response('bad',{headers:{'Content-Type':'image/png'}}),new Response(png,{status:404}),new Response(png,{headers:{'Content-Type':'image/png','Content-Length':'65537'}}),new Response(new Uint8Array(65537),{headers:{'Content-Type':'image/png'}})]) {
    assert.equal(await fetchBrandIcon('atlassian.com',async()=>response),null);
  }
  assert.equal(await fetchBrandIcon('atlassian.com',async()=>{throw Error('network')}),null);
  let calls=0;
  assert.equal(await fetchBrandIcon('127.0.0.1',async()=>{calls++}),null);assert.equal(calls,0);
});
