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
async function publicHost(host, request, signal) {
  const answers=await Promise.all(['A','AAAA'].map(async type=>{
    const response=await request('https://cloudflare-dns.com/dns-query?'+new URLSearchParams({name:host,type}),{headers:{Accept:'application/dns-json'},redirect:'error',signal});
    if(!response.ok)throw Error('DNS unavailable');
    const result=await response.json();if(result.Status!==0)throw Error('DNS unavailable');
    return (result.Answer||[]).filter(item=>item.type===1||item.type===28).map(item=>item.data);
  }));
  const addresses=answers.flat();return addresses.length>0&&addresses.every(publicAddress);
}
export async function fetchPublicPreview(value, { request=fetch, signal }={}) {
  let url=publicPreviewUrl(value);if(!url)return null;
  for(let redirects=0;redirects<3;redirects++){
    if(!(await publicHost(url.hostname,request,signal)))return null;
    const response=await request(url.href,{redirect:'manual',signal,headers:{'User-Agent':'Cloud-Mail-Link-Preview/1.0',Accept:'text/html,image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9'}});
    if([301,302,303,307,308].includes(response.status)){
      await response.body?.cancel();const location=response.headers.get('location');if(!location)return null;url=publicPreviewUrl(location,url);if(!url)return null;continue;
    }
    if(!response.ok){await response.body?.cancel();return null;}
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
  const candidate=meta.get('og:image')||meta.get('twitter:image');const image=candidate?publicPreviewUrl(candidate,url):null;
  return {title:clean(meta.get('og:title')||meta.get('twitter:title')||document.querySelector('title')?.textContent,200),description:clean(meta.get('og:description')||meta.get('twitter:description')||meta.get('description'),500),siteName:clean(meta.get('og:site_name'),80),imageSource:image?.href||null};
}
export async function pagePreview(value,request=fetch) {
  const original=new URL(value),fallback={url:original.href,title:original.hostname,description:'',siteName:original.hostname,imageSource:null};
  // HTTP links remain clickable; preview reads use TLS and never send user cookies.
  const target=new URL(original);if(target.protocol==='http:'){target.protocol='https:';if(target.port==='80')target.port='';}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const found=await fetchPublicPreview(target.href,{request,signal:controller.signal});if(!found)return fallback;
    if(!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(found.response.headers.get('content-type')||'')){await found.response.body?.cancel();return fallback;}
    const body=await bytes(found.response,131072,true),parsed=parsePreview(new TextDecoder().decode(body),found.url.href);
    return {...fallback,...parsed,title:parsed.title||fallback.title,siteName:parsed.siteName||found.url.hostname};
  }catch{return fallback;}finally{clearTimeout(timer);}
}
export async function previewImage(value,request=fetch) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const found=await fetchPublicPreview(value,{request,signal:controller.signal});if(!found)return null;
    const data=await bytes(found.response,2*1024*1024);if(!data)return null;
    const type=data.length>=8&&data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71?'image/png':data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.length>=6&&String.fromCharCode(...data.slice(0,6)).match(/^GIF8[79]a$/)?'image/gif':data.length>=12&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP'?'image/webp':null;
    return type?{data,type}:null;
  }catch{return null;}finally{clearTimeout(timer);}
}
