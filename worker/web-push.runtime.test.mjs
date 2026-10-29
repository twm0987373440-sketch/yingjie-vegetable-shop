// Run with Miniflare installed, or MINIFLARE_MODULE=/absolute/path/to/miniflare/dist/src/index.js.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {Miniflare}=await import(process.env.MINIFLARE_MODULE||'miniflare');
const source=await readFile(new URL('./web-push.mjs',import.meta.url),'utf8');
let calls=0,upstreamStatus=201;
const runtime=new Miniflare({
 modules:true,compatibilityDate:process.env.WORKERS_TEST_DATE||'2026-08-06',
 script:source+`
export default {async fetch(request) {
 if(new URL(request.url).pathname==='/old-mode') {
  try {new Request('https://web.push.apple.com/test-only',{redirect:'error'});return Response.json({threw:false});}
  catch(e){return Response.json({threw:true,name:e.name});}
 }
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 const response=await sendWebPush({WEB_PUSH_PRIVATE_JWK:JSON.stringify(jwk)},'https://web.push.apple.com/test-only','runtime-test');
 return Response.json({status:response.status,ok:response.ok});
}};`,
 // All outbound traffic is intercepted locally. No live device or secret is used.
 outboundService:async request=>{
  calls++;
  assert.equal(request.url,'https://web.push.apple.com/test-only');
  assert.equal(request.method,'POST');
  assert.match(request.headers.get('Authorization'),/^vapid t=.+, k=.+$/);
  assert.equal((await request.arrayBuffer()).byteLength,0);
  return new Response(null,{status:upstreamStatus,headers:upstreamStatus===302?{Location:'https://must-not-follow.invalid/'}:{}});
 }
});
try {
 assert.deepEqual(await (await runtime.dispatchFetch('https://test/old-mode')).json(),{threw:true,name:'TypeError'});
 assert.equal(calls,0);
 assert.deepEqual(await (await runtime.dispatchFetch('https://test/send')).json(),{status:201,ok:true});
 assert.equal(calls,1);
 upstreamStatus=302;
 assert.deepEqual(await (await runtime.dispatchFetch('https://test/send')).json(),{status:302,ok:false});
 assert.equal(calls,2,'redirect must not send a second request or forward credentials');
 console.log('PASS: actual Workers runtime reproduces old redirect error; fixed push sends successfully and does not follow redirects.');
} finally {await runtime.dispose();}
