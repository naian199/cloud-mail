import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {recoverNavigation,clearNavigationRecovery} from '../../mail-vue/src/utils/navigation-recovery.mjs';
test('missing lazy chunks recover the exact same-origin destination once and never reload indefinitely',()=>{
 const data=new Map(),visits=[],storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},location={origin:'https://example.com',assign:url=>visits.push(url)};
 const error=new TypeError('Failed to fetch dynamically imported module: /assets/page-old.js');
 assert.equal(recoverNavigation(error,'/all-users?tab=official#list',{location,storage,now:100000}),true);
 assert.equal(visits[0],'https://example.com/all-users?tab=official#list');
 assert.equal(recoverNavigation(error,'/all-users',{location,storage,now:101000}),false);
 assert.equal(recoverNavigation(error,'/role',{location,storage,now:101000}),false);
 clearNavigationRecovery('/other',storage);assert.equal(data.size,1);
 clearNavigationRecovery('/all-users?tab=official#list',storage);assert.equal(data.size,0);
 assert.equal(recoverNavigation(Error('setup failed'),'/role',{location,storage}),false);
 assert.equal(recoverNavigation(error,'//evil.example',{location,storage}),false);
 assert.equal(recoverNavigation(error,'/role',{location,storage,online:false}),false);
 assert.equal(recoverNavigation(error,'/role',{location,storage:{getItem(){throw Error('blocked');}}}),false);
});
test('permission changes add newly available administration routes and remove old account routes',()=>{
 const source=readFileSync(new URL('../../mail-vue/src/perm/perm.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace('export default {','const directive={').replaceAll('export function ','function ')+'\n;({syncPermissionRoutes});';
 const {syncPermissionRoutes}=vm.runInNewContext(source,{Set,Object,useUserStore:()=>({user:{permKeys:[]}})});
 const routes=new Map(),router={hasRoute:name=>routes.has(name),addRoute:(parent,route)=>{assert.equal(parent,'layout');routes.set(route.name,route);},removeRoute:name=>routes.delete(name)};
 syncPermissionRoutes(router,['user:query']);assert(routes.has('user'));assert(!routes.has('analysis'));
 syncPermissionRoutes(router,['user:query','analysis:query']);assert(routes.has('analysis'));
 const removed=syncPermissionRoutes(router,['analysis:query']);assert(removed.includes('user'));assert(!routes.has('user'));
 syncPermissionRoutes(router,['*']);assert(routes.has('sys-setting'));assert(routes.has('reg-key'));assert(routes.has('all-email'));
 syncPermissionRoutes(router,[]);assert.equal(routes.size,0);
});
