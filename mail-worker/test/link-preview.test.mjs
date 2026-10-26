import test from 'node:test';
import assert from 'node:assert/strict';
import { chatLinkParts,chatLinks } from '../../shared/chat-links.mjs';
import { publicPreviewUrl,publicAddress,pagePreview,previewImage,parsePreview } from '../src/lib/link-preview.js';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=','base64'));
const dns=url=>new Response(JSON.stringify({Status:0,Answer:[{type:new URL(url).searchParams.get('type')==='A'?1:28,data:new URL(url).searchParams.get('type')==='A'?'93.184.216.34':'2606:4700:4700::1111'}]}),{headers:{'Content-Type':'application/json'}});
test('message linkification preserves text and punctuation, balances parentheses and rejects credentials',()=>{
 const source='看看 https://example.org/a_(b)). 然后 https://example.org/二?q=1， https://user:pass@example.org/private';
 const parts=chatLinkParts(source);assert.equal(parts.map(part=>part.text).join(''),source);assert.equal(chatLinks(source).length,2);assert.equal(parts.find(part=>part.url).url,'https://example.org/a_(b)');
 assert.equal(chatLinks('javascript:alert(1) data:text/html,test').length,0);assert.equal(chatLinks('https://example.org/'+')'.repeat(15000)).length,0);
});
test('preview reads reject private hosts, alternate IP spellings, non-TLS requests and custom ports',()=>{
 for(const url of ['http://example.org','https://localhost/','https://localhost./','https://metadata.google.internal/','https://10.0.0.1/','https://2130706433/','https://[::1]/','https://example.org:8443','https://user:pass@example.org/','file:///etc/passwd','https://example.org/unsubscribe','https://example.org/api/init/secret','https://example.org/un%73ubscribe','https://example.org/action?action=delete','https://api.telegram.org/bot123456:secret/sendMessage','https://example.org/?access_token=private'])assert.equal(publicPreviewUrl(url),null,url);
 for(const ip of ['127.0.0.1','10.1.2.3','100.64.0.1','169.254.169.254','172.20.1.1','192.168.0.1','198.19.0.1','203.0.113.1','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:0db8::1','2002:7f00:1::'])assert.equal(publicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','93.184.216.34','2606:4700:4700::1111'])assert.equal(publicAddress(ip),true,ip);
});
test('public preview returns bounded Open Graph text and resolves relative images without executing HTML',async()=>{
 let reads=0;
 const data=await pagePreview('https://example.org/article',async(url,options)=>{
  assert(!('Authorization' in options.headers));assert(!('Cookie' in options.headers));
  if(String(url).includes('/dns-query?'))return dns(url);
  reads++;assert.equal(options.redirect,'manual');
  return new Response('<title>Fallback</title><meta property="og:title" content="Hello &amp; world"><meta name="description" content="A useful summary"><meta property="og:image" content="/cover.png">',{headers:{'Content-Type':'text/html; charset=utf-8'}});
 });
 assert.equal(reads,1);assert.equal(data.title,'Hello & world');assert.equal(data.description,'A useful summary');assert.equal(data.imageSource,'https://example.org/cover.png');
 assert.equal(parsePreview('<title>No image</title>','https://example.org').imageSource,null);
});
test('private DNS answers and redirect targets are not fetched; inaccessible sites fall back to their host',async()=>{
 let siteReads=0;
 const data=await pagePreview('https://example.org/private',async(url)=>{
  if(String(url).includes('/dns-query?'))return new Response(JSON.stringify({Status:0,Answer:[{type:1,data:'127.0.0.1'}]}));
  siteReads++;return new Response('must not be read');
 });assert.equal(siteReads,0);assert.equal(data.title,'example.org');
 let calls=0;await pagePreview('https://example.org/redirect',async(url)=>{if(String(url).includes('/dns-query?'))return dns(url);calls++;return new Response(null,{status:302,headers:{Location:'https://localhost/'}});});assert.equal(calls,1);
 const missing=await pagePreview('https://example.org/',async(url)=>String(url).includes('/dns-query?')?dns(url):new Response('blocked',{status:403}));assert.equal(missing.title,'example.org');assert.equal(missing.imageSource,null);
});
test('image proxy accepts only bounded raster payloads and rejects active or oversized content',async()=>{
 const request=body=>async(url)=>String(url).includes('/dns-query?')?dns(url):new Response(body,{headers:{'Content-Type':'image/png'}});
 const image=await previewImage('https://example.org/cover.png',request(png));assert.equal(image.type,'image/png');assert.deepEqual(image.data,png);
 for(const body of ['<svg onload="alert(1)"/>',new Uint8Array(2*1024*1024+1)])assert.equal(await previewImage('https://example.org/image',request(body)),null);
});
