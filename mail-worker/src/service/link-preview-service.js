import BizError from '../error/biz-error';
import { chatLinks,normalizeChatLink } from '../../../shared/chat-links.mjs';
import { pagePreview,previewImage } from '../lib/link-preview';
import mail from './mail-chat-service';
import rooms from './room-service';
const cached=new Map();
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
  const data=await pagePreview(url);if(cached.size>=128)cached.delete(cached.keys().next().value);
  cached.set(url,{expires:Date.now()+300000,data});return data;
}
export default {
  async get(c,params){const url=await authorize(c,params),data=await metadata(url);const {imageSource,...visible}=data;return {...visible,hasImage:!!imageSource};},
  async image(c,params){const url=await authorize(c,params),data=await metadata(url);return data.imageSource?previewImage(data.imageSource):null;}
};
