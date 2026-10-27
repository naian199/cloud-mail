import setting from './setting-service';
import BizError from '../error/biz-error';
import {packName,fetchPack,fetchSticker,fetchPublicPack,fetchPublicSticker} from '../lib/telegram-stickers.mjs';
const errors=new Set(['stickersErrorConfig','stickersErrorAuth','stickersErrorNotFound','stickersErrorNetwork','stickersErrorEmpty','stickersErrorPublic']);
const fail=error=>{throw new BizError(errors.has(error?.message)?error.message:'stickersErrorNetwork',503);};
export default {
  async pack(c,value){
    let name;try{name=packName(value);}catch{throw new BizError('stickersErrorLink',400);}
    const {tgBotToken}=await setting.query(c);
    const fingerprint=tgBotToken?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tgBotToken))),b=>b.toString(16).padStart(2,'0')).join('').slice(0,24):'public';
    const key=`stickers:v2:${fingerprint}:${name.toLowerCase()}`;
    const cached=await c.env.kv.get(key,{type:'json'});if(cached)return cached;
    let botError;
    try{
      const pack=await fetchPack(tgBotToken,name);
      await c.env.kv.put(key,JSON.stringify(pack),{expirationTtl:86400});return pack;
    }catch(error){botError=error;}
    try{
      const pack=await fetchPublicPack(name);
      await c.env.kv.put(key,JSON.stringify(pack),{expirationTtl:900});return pack;
    }catch(error){fail(['stickersErrorAuth','stickersErrorNotFound'].includes(botError?.message)?botError:error);}
  },
  async file(c,name,id){
    const pack=await this.pack(c,name),sticker=pack.stickers.find(item=>item.id===id);
    if(!sticker)throw new BizError('stickersErrorNotFound',404);
    try{
      let bytes,mime;
      if(pack.source==='public')({bytes,mime}=await fetchPublicSticker(sticker.url));
      else{
        const {tgBotToken}=await setting.query(c);bytes=await fetchSticker(tgBotToken,id);
        mime=sticker.format==='webp'?'image/webp':sticker.format==='webm'?'video/webm':'application/x-tgsticker';
      }
      return new Response(bytes,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }catch(error){fail(error);}
  }
};
