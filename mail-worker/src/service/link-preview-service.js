import BizError from '../error/biz-error';
import { chatLinks,normalizeChatLink } from '../../../shared/chat-links.mjs';
import { pagePreview,previewImage } from '../lib/link-preview';
import mail from './mail-chat-service';
import rooms from './room-service';
const cached=new Map(), pending=new Map(), images=new Map(), pendingImages=new Map();
let imageBytes=0;
async function authorize(c,params) {
  const url=normalizeChatLink(params?.url);if(!url)throw new BizError('invalidInput',400);
  let text;
  if(params.emailId&&!params.roomId){const row=await mail.detail(c,params.emailId);text=row.replyText??row.text;}
  else if(params.roomId&&Number.isSafeInteger(Number(params.messageId))&&Number(params.messageId)>0){
    await rooms.access(c,params.roomId);
    const row=await c.env.db.prepare('SELECT body FROM mail_room_message WHERE room_id=? AND id=?').bind(params.roomId,Number(params.messageId)).first();
    if(!row)throw new BizError('invalidInput',404);text=row.body;
  }else throw new BizError('invalidInput',400);
  if(!chatLinks(text||'').includes(url))throw new BizError('unauthorized',403);
  return url;
}
async function metadata(url) {
  const entry=cached.get(url);if(entry&&entry.expires>Date.now())return entry.data;
  if(pending.has(url))return pending.get(url);
  const task=(async()=>{
    const data=await pagePreview(url);if(cached.size>=128)cached.delete(cached.keys().next().value);
    cached.set(url,{expires:Date.now()+(data.previewAvailable?1800000:15000),data});return data;
  })();
  pending.set(url,task);try{return await task;}finally{pending.delete(url);}
}
async function image(source) {
  const entry=images.get(source);if(entry&&entry.expires>Date.now())return entry.image;
  if(pendingImages.has(source))return pendingImages.get(source);
  const task=(async()=>{
    const result=await previewImage(source);if(!result)return null;
    const previous=images.get(source);
    if(previous){imageBytes-=previous.image.data.byteLength;images.delete(source);}
    while(images.size&&(imageBytes+result.data.byteLength>8*1024*1024||images.size>=32)){
      const key=images.keys().next().value;imageBytes-=images.get(key).image.data.byteLength;images.delete(key);
    }
    images.set(source,{image:result,expires:Date.now()+1800000});imageBytes+=result.data.byteLength;
    return result;
  })();
  pendingImages.set(source,task);try{return await task;}finally{pendingImages.delete(source);}
}
export default {
  async get(c,params){const url=await authorize(c,params),data=await metadata(url);const {imageSource,...visible}=data;return {...visible,hasImage:!!imageSource};},
  async image(c,params){const url=await authorize(c,params),data=await metadata(url);return data.imageSource?image(data.imageSource):null;}
};
