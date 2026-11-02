import test from 'node:test';
import assert from 'node:assert/strict';
import { installVisualViewport } from '../../mail-vue/src/utils/visual-viewport.js';
function fixture(withViewport=true) {
 const values=new Map(),classes=new Set(),callbacks=new Map();let next=0;
 const doc=Object.assign(new EventTarget(),{activeElement:{matches:()=>false},documentElement:{style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)},classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k),remove:k=>classes.delete(k)}}});
 const viewport=withViewport?Object.assign(new EventTarget(),{height:800,offsetTop:0,scale:1}):null;
 const win=Object.assign(new EventTarget(),{document:doc,innerHeight:800,visualViewport:viewport,matchMedia:()=>({matches:true}),requestAnimationFrame:callback=>{callbacks.set(++next,callback);return next;},cancelAnimationFrame:id=>callbacks.delete(id)});
 const flush=()=>{for(const [id,callback] of [...callbacks]){callbacks.delete(id);callback();}};
 return {win,doc,viewport,values,classes,callbacks,flush};
}
test('visible viewport is shared with dialogs, coalesced, and restored after keyboard dismissal',()=>{
 const f=fixture(),stop=installVisualViewport(f.win);
 assert.equal(f.values.get('--app-viewport-height'),'800px');
 f.doc.activeElement={matches:()=>true};f.viewport.height=410;f.viewport.offsetTop=18;
 f.viewport.dispatchEvent(new Event('resize'));f.viewport.dispatchEvent(new Event('scroll'));
 assert.equal(f.callbacks.size,1);f.flush();
 assert.equal(f.values.get('--app-viewport-height'),'410px');assert.equal(f.values.get('--app-viewport-top'),'18px');assert(f.classes.has('mobile-keyboard-open'));
 f.viewport.scale=2;f.viewport.height=200;f.viewport.dispatchEvent(new Event('resize'));f.flush();assert.equal(f.values.get('--app-viewport-height'),'410px');
 f.viewport.scale=1;f.viewport.height=800;f.viewport.offsetTop=0;f.doc.activeElement={matches:()=>false};f.doc.dispatchEvent(new Event('focusout'));f.flush();assert(!f.classes.has('mobile-keyboard-open'));
 stop();assert.equal(f.values.size,0);f.viewport.dispatchEvent(new Event('resize'));assert.equal(f.callbacks.size,0);
});
test('browsers without VisualViewport use their window height without inventing a keyboard state',()=>{
 const f=fixture(false),stop=installVisualViewport(f.win);assert.equal(f.values.get('--app-viewport-height'),'800px');
 f.win.innerHeight=430;f.win.dispatchEvent(new Event('resize'));f.flush();assert.equal(f.values.get('--app-viewport-height'),'430px');assert(!f.classes.has('mobile-keyboard-open'));stop();
});
