import test from 'node:test';
import assert from 'node:assert/strict';
import {installPlatform,standaloneApp,promptAppInstall} from '../../mail-vue/src/utils/app-install.mjs';
test('install instructions distinguish iOS including desktop-mode iPad, Android and desktop Safari',()=>{
 assert.equal(installPlatform({userAgent:'Mozilla iPhone Safari'}),'ios');assert.equal(installPlatform({userAgent:'Mozilla Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),'ios');
 assert.equal(installPlatform({userAgent:'Mozilla Android Chrome'}),'android');assert.equal(installPlatform({userAgent:'Mozilla Macintosh Version/17 Safari',platform:'MacIntel',maxTouchPoints:0}),'macos');assert.equal(installPlatform({userAgent:'Mozilla Macintosh Chrome Safari',platform:'MacIntel'}),'desktop');
});
test('standalone detection suppresses installed windows without mistaking ordinary fullscreen for installation',()=>{
 const window={matchMedia:mode=>({matches:mode==='(display-mode: standalone)'})};assert(standaloneApp(window,{}));assert(standaloneApp({matchMedia:()=>({matches:false})},{standalone:true}));assert(!standaloneApp({matchMedia:()=>({matches:false})},{}));
});
test('native install prompt is invoked synchronously inside the click and acceptance is not fabricated',async()=>{
 let calls=0;const result=promptAppInstall({prompt:()=>{calls++;},userChoice:Promise.resolve({outcome:'accepted'})});assert.equal(calls,1);assert.equal(await result,'accepted');
 assert.equal(await promptAppInstall({prompt:()=>{},userChoice:Promise.resolve({outcome:'dismissed'})}),'dismissed');
 await assert.rejects(()=>promptAppInstall({prompt:()=>{throw Error('unsupported');}}),/unsupported/);
});
