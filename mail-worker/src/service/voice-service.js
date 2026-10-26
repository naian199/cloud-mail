import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import mail from './mail-chat-service';
import rooms from './room-service';
import storage from './r2-service';
import {isAudioFile} from '../../../shared/media-files.mjs';
import {voiceQuotaSQL,MAX_VOICE_BYTES,decodeVoice,voiceHash,recognizeVoice} from '../lib/voice-audio.mjs';
const fail=(key,code=400)=>{throw new BizError(key,code);};
export default {
  async transcribe(c,params){
    const userId=userContext.getUserId(c);
    let bytes;
    // Authorization always precedes storage reads and transcript cache hits.
    if(params?.attId){
      const att=await mail.attachment(c,params.attId);
      const meta=await c.env.db.prepare('SELECT filename,mime_type AS mimeType,size FROM attachments WHERE att_id=? AND user_id=?').bind(Number(params.attId),userId).first();
      if(!meta||!isAudioFile(meta)||meta.size>MAX_VOICE_BYTES)fail('voiceAudioLimit');
      const object=await storage.getObj(c,att.key);if(!object)fail('voiceTranscribeError',404);
      bytes=new Uint8Array(await new Response(object.body).arrayBuffer());
    }else if(params?.roomId&&params?.messageId){
      const voice=await rooms.voice(c,params.roomId,params.messageId);
      const object=await storage.getObj(c,voice.key);if(!object)fail('voiceTranscribeError',404);
      bytes=new Uint8Array(await new Response(object.body).arrayBuffer());
    }else{
      try{bytes=decodeVoice(params?.audio).bytes;}catch{fail('voiceAudioLimit');}
    }
    if(!bytes?.length||bytes.length>MAX_VOICE_BYTES)fail('voiceAudioLimit');
    const hash=await voiceHash(bytes),key=`voice-transcript:${userId}:${hash}`;
    const cached=await c.env.kv.get(key);if(cached)return {text:cached};
    if(!c.env.ai?.run)fail('voiceTranscribeError',503);
    const day=new Date().toISOString().slice(0,10);
    const reserve=await c.env.db.prepare(voiceQuotaSQL).bind(day,userId,day).first();
    if(!reserve)fail('voiceQuota',429);
    try{
      const text=await recognizeVoice(c.env.ai,bytes);
      await c.env.kv.put(key,text,{expirationTtl:604800});
      c.executionCtx.waitUntil(c.env.db.prepare("DELETE FROM mail_voice_usage WHERE day<date('now','-7 days')").run());
      return {text};
    }catch{fail('voiceTranscribeError',503);}
  }
};
