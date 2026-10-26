import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import {audioMime,isAudioFile,isVideoFile} from '../../shared/media-files.mjs';
import {voiceQuotaSQL,decodeVoice,voiceBase64,recognizeVoice,MAX_VOICE_BYTES} from '../src/lib/voice-audio.mjs';
test('audio WebM is never rendered as video and generic audio extensions remain playable',()=>{
 for(const file of [{filename:'voice-123.webm'},{filename:'recording.webm',mimeType:'audio/webm;codecs=opus'},{filename:'memo.mp4',mimeType:'audio/mp4'},{filename:'memo.m4a'},{filename:'memo.mp3'}]){assert(isAudioFile(file));assert(!isVideoFile(file));}
 assert.equal(audioMime({filename:'voice-123.webm'}),'audio/webm');assert(isVideoFile({filename:'movie.webm',mimeType:'video/webm'}));assert(isVideoFile({filename:'movie.ogg',mimeType:'video/ogg'}));
});
test('voice upload rejects invalid, disguised and oversized audio before inference',()=>{
 const bytes=Uint8Array.from([26,69,223,163,...new Array(30).fill(0)]),content=voiceBase64(bytes);
 assert.deepEqual(decodeVoice({content,contentType:'audio/webm;codecs=opus'}).bytes,bytes);
 for(const audio of [{content:'@@@',contentType:'audio/webm'},{content,contentType:'text/html'},{content,contentType:'audio/mp4'},{content:btoa('<svg onload=bad()>'),contentType:'audio/webm'},{content:'A'.repeat(Math.ceil(MAX_VOICE_BYTES/3)*4+4),contentType:'audio/webm'}])assert.throws(()=>decodeVoice(audio));
});
test('multilingual transcription preserves the spoken language and rejects empty results',async()=>{
 const bytes=new Uint8Array([1,2,3]);let calls=0;
 const text=await recognizeVoice({run:async(model,input)=>{calls++;assert.equal(model,'@cf/openai/whisper-large-v3-turbo');assert.equal(input.task,'transcribe');assert.equal(input.audio,'AQID');return{text:'  你好，这是一条语音留言。  '};}},bytes);
 assert.equal(text,'你好，这是一条语音留言。');assert.equal(calls,1);
 await assert.rejects(()=>recognizeVoice({run:async()=>({text:' '})},bytes));
 await assert.rejects(()=>recognizeVoice({run:async()=>{throw Error('quota');}},bytes));
});

test('transcription reservation enforces both user and site daily limits atomically',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE mail_voice_usage(day TEXT,user_id INTEGER,used INTEGER,PRIMARY KEY(day,user_id))');const reserve=db.prepare(voiceQuotaSQL),day='2026-10-27';
 for(let user=1;user<=20;user++){for(let n=1;n<=50;n++)assert.equal(reserve.get(day,user,day).used,n);assert.equal(reserve.get(day,user,day),undefined);}
 assert.equal(reserve.get(day,21,day),undefined);assert.equal(db.prepare('SELECT sum(used) AS total FROM mail_voice_usage').get().total,1000);
 assert.equal(reserve.get('2026-10-28',1,'2026-10-28').used,1);db.close();
});
