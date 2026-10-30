import { parseHTML } from 'linkedom';

export function publicPreviewUrl(value, base) {
  try {
    const url = new URL(value,base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 2048) return null;
    // Do not automatically invoke obvious account actions or credential-bearing APIs.
    let pathname=url.pathname;try{pathname=decodeURIComponent(pathname);}catch{return null;}
    if (/(?:^|\/)(?:init|install|setup|logout|signout|unsubscribe|delete|remove|verify|activate|confirm|reset-password|sendmessage|sendphoto)(?:\/|$)/i.test(pathname) || /\/bot\d+(?::|%3a)/i.test(pathname)) return null;
    if ([...url.searchParams.keys()].some(key=>/^(password|access_token|api_key|secret)$/i.test(key)) || /^(delete|remove|unsubscribe|logout)$/i.test(url.searchParams.get('action')||'')) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/,'');url.hostname=host;
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home|test|invalid|onion)$/.test(host)) return null;
    return url;
  } catch { return null; }
}
export function publicAddress(value) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    const n=value.split('.').map(Number);if(n.some(part=>part>255))return false;
    const [a,b,c]=n;
    return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if (!/^[a-f\d:]+$/i.test(value) || !value.includes(':')) return false;
  try {
    const parts=new URL('https://['+value+']/').hostname.slice(1,-1).split(':'),first=parseInt(parts[0],16),second=parseInt(parts[1]||'0',16);
    return first>=0x2000&&first<=0x3fff&&first!==0x2002&&!(first===0x2001&&([0,2,0xdb8].includes(second)||second>=0x10&&second<=0x2f));
  } catch { return false; }
}
async function publicHost(host, request, signal, diagnostics) {
  // An unavailable DNS-over-HTTPS provider must not disable every link preview.
  for (const endpoint of ['https://cloudflare-dns.com/dns-query','https://dns.google/resolve']) {
    const controller=new AbortController(),abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)controller.abort();
    const timer=setTimeout(abort,1800);
    try {
      const answers=await Promise.all(['A','AAAA'].map(async type=>{
        const response=await request(endpoint+'?'+new URLSearchParams({name:host,type}),{headers:{Accept:'application/dns-json'},redirect:'error',signal:controller.signal});
        if(!response.ok)throw Error('DNS unavailable');
        const result=await response.json();
        if(result.Status===3)return [];
        if(result.Status!==0)throw Error('DNS unavailable');
        return (result.Answer||[]).filter(item=>item.type===1||item.type===28).map(item=>item.data);
      }));
      const addresses=answers.flat();
      if(addresses.some(value=>!publicAddress(value))){diagnostics.reason='restricted';return false;}
      if(!addresses.length){diagnostics.reason='dns';return false;}
      return true;
    } catch {
      if(signal?.aborted)throw Error('Preview aborted');
      diagnostics.reason='dns';
    } finally {clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);}
  }
  return false;
}
export async function fetchPublicPreview(value, { request=fetch, signal, diagnostics={} }={}) {
  let url=publicPreviewUrl(value);if(!url){diagnostics.reason='restricted';return null;}
  for(let redirects=0;redirects<3;redirects++){
    if(!(await publicHost(url.hostname,request,signal,diagnostics)))return null;
    const response=await request(url.href,{redirect:'manual',signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; CloudMailPreview/1.0; +https://github.com/naian199/cloud-mail)',Accept:'text/html,application/xhtml+xml,image/webp,image/png,image/jpeg,image/gif;q=0.9', 'Accept-Language':'zh-CN,zh;q=0.9,en;q=0.8'}});
    if([301,302,303,307,308].includes(response.status)){
      await response.body?.cancel();const location=response.headers.get('location');if(!location)return null;url=publicPreviewUrl(location,url);if(!url)return null;continue;
    }
    if(!response.ok){diagnostics.reason=[401,403,429,451].includes(response.status)?'blocked':'http';await response.body?.cancel();return null;}
    return {response,url};
  }
  return null;
}
async function bytes(response,limit,truncate=false) {
  if(!response.body)return new Uint8Array();
  if(!truncate&&Number(response.headers.get('content-length'))>limit){await response.body.cancel();return null;}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;if(size+value.length>limit){if(!truncate)return null;chunks.push(value.slice(0,limit-size));size=limit;break;}chunks.push(value);size+=value.length;}}
  finally{await reader.cancel().catch(()=>{});}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
const clean = (text,max) => String(text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function parsePreview(html,url) {
  const {document}=parseHTML(html),meta=new Map();
  for(const node of document.querySelectorAll('meta[property],meta[name]')){const name=(node.getAttribute('property')||node.getAttribute('name')||'').toLowerCase();if(!meta.has(name))meta.set(name,node.getAttribute('content')||'');}
  let structured={};
  const queue=[];
  for(const node of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,8)) {
    try {const text=node.textContent;if(text.length<=65536)queue.push(JSON.parse(text));} catch {}
  }
  for(let visited=0;queue.length&&visited<32;visited++) {
    const item=queue.shift();
    if(Array.isArray(item)){queue.push(...item.slice(0,16));continue;}
    if(!item||typeof item!=='object')continue;
    if(Array.isArray(item['@graph']))queue.push(...item['@graph'].slice(0,16));
    const types=[item['@type']].flat();
    if(types.some(type=>/^(?:Article|NewsArticle|BlogPosting|WebPage|VideoObject|Product)$/i.test(type||''))){structured=item;break;}
  }
  const text=value=>typeof value==='string'?value:'';
  const structuredImage=[structured.image].flat().find(Boolean);
  const candidate=meta.get('og:image:secure_url')||meta.get('og:image')||meta.get('twitter:image')||meta.get('twitter:image:src')||text(structuredImage)||text(structuredImage?.url)||text(structuredImage?.contentUrl)||text(structured.thumbnailUrl);
  const image=candidate?publicPreviewUrl(candidate,url):null;
  return {title:clean(meta.get('og:title')||meta.get('twitter:title')||document.querySelector('title')?.textContent||text(structured.headline)||text(structured.name),200),description:clean(meta.get('og:description')||meta.get('twitter:description')||meta.get('description')||text(structured.description),500),siteName:clean(meta.get('og:site_name'),80),imageSource:image?.href||null};
}
export async function pagePreview(value,request=fetch) {
  const original=new URL(value),fallback={url:original.href,title:original.hostname,description:'',siteName:original.hostname,imageSource:null,previewAvailable:false,reason:'unavailable'};
  // HTTP links remain clickable; preview reads use TLS and never send user cookies.
  const target=new URL(original);if(target.protocol==='http:'){target.protocol='https:';if(target.port==='80')target.port='';}
  const diagnostics={},controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    const found=await fetchPublicPreview(target.href,{request,signal:controller.signal,diagnostics});if(!found)return {...fallback,reason:diagnostics.reason||'unavailable'};
    if(!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(found.response.headers.get('content-type')||'')){await found.response.body?.cancel();return {...fallback,reason:'not-html'};}
    const body=await bytes(found.response,524288,true);
    const prefix=new TextDecoder().decode(body.slice(0,2048));
    const encoding=found.response.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)?.[1]||prefix.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]||'utf-8';
    let html;try{html=new TextDecoder(encoding).decode(body);}catch{html=new TextDecoder().decode(body);}
    const parsed=parsePreview(html,found.url.href);
    if(/(?:just a moment|checking your browser|attention required|access denied)/i.test(parsed.title)&&/(?:cf-chl|challenge-platform|captcha)/i.test(html))return {...fallback,reason:'blocked'};
    return {...fallback,...parsed,reason:parsed.title||parsed.description||parsed.imageSource?null:'no-metadata',previewAvailable:!!(parsed.title||parsed.description||parsed.imageSource),title:parsed.title||fallback.title,siteName:parsed.siteName||found.url.hostname};
  }catch{return {...fallback,reason:controller.signal.aborted?'timeout':'network'};}finally{clearTimeout(timer);}
}
export async function previewImage(value,request=fetch) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const found=await fetchPublicPreview(value,{request,signal:controller.signal});if(!found)return null;
    const data=await bytes(found.response,2*1024*1024);if(!data)return null;
    const type=data.length>=8&&data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71?'image/png':data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.length>=6&&String.fromCharCode(...data.slice(0,6)).match(/^GIF8[79]a$/)?'image/gif':data.length>=12&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP'?'image/webp':data.length>=16&&String.fromCharCode(...data.slice(4,8))==='ftyp'&&/avif|avis/.test(String.fromCharCode(...data.slice(8,48)))?'image/avif':null;
    return type?{data,type}:null;
  }catch{return null;}finally{clearTimeout(timer);}
}
