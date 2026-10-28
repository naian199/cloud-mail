import test from 'node:test';
import assert from 'node:assert/strict';
import {finishStartupLoader} from '../../mail-vue/src/utils/startup-loader.mjs';

function fixture(){
 const classes=new Set(),attributes={};
 return {dataset:{startedAt:'0'},isConnected:true,classList:{add:name=>classes.add(name)},setAttribute:(k,v)=>attributes[k]=v,remove(){this.isConnected=false;},classes,attributes};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('success is shown only after arrival, then fades and removes the blocking overlay',async()=>{
 const loader=fixture(),steps=[];
 const job=finishStartupLoader(loader,{reducedMotion:false,now:()=>100,wait:ms=>new Promise(resolve=>steps.push({ms,resolve}))});
 assert.equal(steps[0].ms,460);assert(!loader.classes.has('loading-complete'));
 steps[0].resolve();await tick();assert(loader.classes.has('loading-complete'));assert.equal(loader.attributes['aria-busy'],'false');assert.equal(steps[1].ms,360);
 steps[1].resolve();await tick();assert(loader.classes.has('loading-hide'));assert.equal(steps[2].ms,160);assert(loader.isConnected);
 steps[2].resolve();await job;assert.equal(loader.isConnected,false);
});
test('reduced motion avoids entrance/fade delays, while duplicate completion does not start extra timers',async()=>{
 const loader=fixture(),steps=[];let release;
 const options={reducedMotion:true,wait:ms=>{steps.push(ms);return new Promise(resolve=>release=resolve);}};
 const job=finishStartupLoader(loader,options);await finishStartupLoader(loader,options);
 assert.deepEqual(steps,[80]);assert(loader.classes.has('loading-complete'));release();await job;assert.equal(loader.isConnected,false);
});
test('a loader removed while waiting never flashes a success state',async()=>{
 const loader=fixture();let release;
 const job=finishStartupLoader(loader,{reducedMotion:false,now:()=>100,wait:()=>new Promise(resolve=>release=resolve)});
 loader.remove();release();await job;assert(!loader.classes.has('loading-complete'));
});
