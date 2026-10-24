import test from 'node:test';
import assert from 'node:assert/strict';
import { translateLocally, localTranslationAvailable, prepareLocalTranslation } from '../../mail-vue/src/utils/local-translation.mjs';
test('unsupported browsers and missing language pairs fall back without a remote request', async () => {
 assert.equal(await localTranslationAvailable({}),false);
 assert.equal(await translateLocally('hello','zh-CN',null,{}),null);
 const scope={LanguageDetector:{availability:async()=>'available',create:async()=>({detect:async()=>[{detectedLanguage:'en',confidence:.99}],destroy(){}})},Translator:{availability:async()=>'unavailable'}};
 assert.equal(await translateLocally('hello','zh-CN',null,scope),null);
});
test('local translation limits text, normalizes Chinese and destroys models',async()=>{
 let destroyed=0;
 const scope={LanguageDetector:{availability:async()=>'available',create:async()=>({detect:async()=>[{detectedLanguage:'en',confidence:.99}],destroy(){destroyed++}})},Translator:{availability:async options=>{assert.equal(options.targetLanguage,'zh');return 'available'},create:async()=>({translate:async text=>{assert.equal(Array.from(text).length,5000);return '你好'},destroy(){destroyed++}})}};
 const result=await translateLocally('a'.repeat(5001),'zh-CN',null,scope);
 assert.equal(result.provider,'local');assert.equal(result.text,'你好');assert.equal(result.truncated,true);assert.equal(destroyed,2);
});
test('same-language messages need no translation model and cancellation is preserved',async()=>{
 const scope={LanguageDetector:{availability:async()=>'available',create:async()=>({detect:async()=>[{detectedLanguage:'en',confidence:.99}],destroy(){}})},Translator:{}};
 assert.equal((await translateLocally('Hello','en',null,scope)).text,'Hello');
 const controller=new AbortController();controller.abort();
 await assert.rejects(translateLocally('Hello','en',controller.signal,scope));
 assert.equal(await prepareLocalTranslation('en',{}),false);
});
