import test from 'node:test';
import assert from 'node:assert/strict';
import { isLinkPreviewImageType,previewRequestFailure,previewFailureKey } from '../../mail-vue/src/utils/link-preview.mjs';
test('client accepts all backend raster preview formats, including AVIF, and rejects active formats',()=>{
 for(const type of ['image/png','image/jpeg','image/gif','image/webp','image/avif','IMAGE/AVIF; charset=binary'])assert.equal(isLinkPreviewImageType(type),true,type);
 for(const type of ['image/svg+xml','text/html','application/octet-stream','image/avif-script',null,undefined])assert.equal(isLinkPreviewImageType(type),false,String(type));
});
test('API authorization errors and website refusal are separate diagnostic paths',()=>{
 assert.equal(previewRequestFailure({code:403}),'permission');
 assert.equal(previewRequestFailure({response:{status:401}}),'permission');
 assert.equal(previewRequestFailure({code:'ECONNABORTED'}),'timeout');
 assert.equal(previewRequestFailure(Error('unavailable')),'api');
 assert.notEqual(previewFailureKey('permission'),previewFailureKey('blocked'));
 assert.notEqual(previewFailureKey('dns'),previewFailureKey('network'));
 assert.notEqual(previewFailureKey('challenge'),previewFailureKey('blocked'));
});
