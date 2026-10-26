export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export function decodeVoice(audio) {
  const mime=String(audio?.contentType||'').split(';')[0].toLowerCase();
  if(!['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg','audio/flac','audio/aac','audio/x-wav'].includes(mime))throw Error('format');
  const encoded=audio?.content;
  if(typeof encoded!=='string'||encoded.length>Math.ceil(MAX_VOICE_BYTES/3)*4||(encoded.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)))throw Error('size');
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(bytes.length<12||bytes.length>MAX_VOICE_BYTES)throw Error('size');
  const head=String.fromCharCode(...bytes.slice(0,12));
  const valid=mime==='audio/webm'?head.startsWith('\x1aE\xdf\xa3'):mime==='audio/mp4'?head.slice(4,8)==='ftyp':mime==='audio/ogg'?head.startsWith('OggS'):mime.includes('wav')?head.startsWith('RIFF')&&head.slice(8)==='WAVE':mime==='audio/flac'?head.startsWith('fLaC'):head.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224);
  if(!valid)throw Error('format');
  return {bytes,mime,filename:String(audio.filename||'voice').slice(0,160)};
}
export function voiceBase64(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out);}
export async function voiceHash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function recognizeVoice(ai,bytes){
  const result=await ai.run('@cf/openai/whisper-large-v3-turbo',{audio:voiceBase64(bytes),task:'transcribe',vad_filter:true,condition_on_previous_text:false});
  const text=typeof result?.text==='string'?result.text.trim():'';
  if(!text||text.length>20000)throw Error('transcript');
  return text;
}

export const voiceQuotaSQL = `INSERT INTO mail_voice_usage(day,user_id,used)
      SELECT ?,?,1 WHERE coalesce((SELECT sum(used) FROM mail_voice_usage WHERE day=?),0)<1000
      ON CONFLICT(day,user_id) DO UPDATE SET used=used+1 WHERE used<50 RETURNING used`;
