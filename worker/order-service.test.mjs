import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {orderApi,retryOrderNotifications,ORDER_SCHEMA} from './order-service.mjs';
const db=new DatabaseSync(':memory:');
const ORDER_DB={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async run(){return db.prepare(sql).run(...this.args)},async first(){return db.prepare(sql).get(...this.args)},async all(){return {results:db.prepare(sql).all(...this.args)}}}}};
const env={ORDER_DB,LINE_CHANNEL_ACCESS_TOKEN:'test-only',LINE_OWNER_USER_ID:'U'+'a'.repeat(32)};
const order={customerName:'測試',customerPhone:'0000000000',note:'測試資料',items:[{name:'青菜',unit:'包',price:20,qty:3}],subtotal:60,discount:10,bundleQty:3,total:50,memberLoggedIn:false};
const jobs=[];const ctx={waitUntil(p){jobs.push(p)}};
let commits=0,pushes=0,lineMode=200,fireMode=200,delay=false;
globalThis.fetch=async (url,options)=>{
 if(url.includes('firestore')) {
  commits++;const body=JSON.parse(options.body);
  assert.equal(body.writes[0].currentDocument.exists,false);
  assert.equal(body.writes[0].updateTransforms[0].setToServerValue,'REQUEST_TIME');
  if(fireMode!==200)return Response.json({error:{status:'PERMISSION_DENIED'}},{status:403});
  return Response.json({commitTime:new Date().toISOString()});
 }
 pushes++; assert.match(options.headers['X-Line-Retry-Key'],/^[0-9a-f-]{36}$/);
 const message=JSON.parse(options.body); assert.equal(message.to,env.LINE_OWNER_USER_ID);
 assert.ok(!message.messages[0].text.includes('0000000000'));assert.ok(message.messages[0].text.includes('NT$50'));
 if(lineMode===0)throw Error('network');
 return Response.json({}, {status:lineMode,headers:lineMode===409?{'x-line-accepted-request-id':'accepted'}:{}});
};
const call=(id,o=order,origin='https://twm0987373440-sketch.github.io')=>orderApi(new Request('https://example.test/order',{method:'POST',headers:{Origin:origin},body:JSON.stringify({requestId:id,order:o})}),env,ctx);
const drain=async()=>{while(jobs.length)await jobs.shift()};
let id=crypto.randomUUID();let r=await call(id);assert.equal(r.status,200);let data=await r.json();await drain();assert.equal(pushes,1);assert.equal(commits,1);
assert.equal(db.prepare('SELECT saved,sent,payload FROM order_notifications WHERE request_id=?').get(id).payload,null);
r=await call(id);assert.equal((await r.json()).orderId,data.orderId);await drain();assert.equal(commits,1);assert.equal(pushes,1);
assert.equal((await call(id,{...order,note:'changed'})).status,409);
assert.equal((await call(crypto.randomUUID(),order,'https://evil.test')).status,403);
assert.equal((await call(crypto.randomUUID(),{...order,total:-1})).status,400);
const preflight=await orderApi(new Request('https://example.test/order',{method:'OPTIONS'}),env,ctx);assert.equal(preflight.status,204);
lineMode=500;id=crypto.randomUUID();assert.equal((await call(id)).status,200);await drain();assert.equal(db.prepare('SELECT sent FROM order_notifications WHERE request_id=?').get(id).sent,0);
db.prepare('UPDATE order_notifications SET next_attempt=0 WHERE request_id=?').run(id);lineMode=409;await retryOrderNotifications(env);assert.equal(db.prepare('SELECT sent FROM order_notifications WHERE request_id=?').get(id).sent,1);
lineMode=400;id=crypto.randomUUID();await call(id);await drain();assert.equal(db.prepare('SELECT sent FROM order_notifications WHERE request_id=?').get(id).sent,-1);
lineMode=200;fireMode=403;id=crypto.randomUUID();const before=pushes;assert.equal((await call(id)).status,503);await drain();assert.equal(pushes,before);
console.log('PASS: saved-order notification, idempotent retry, payload conflict, origin validation, invalid totals, CORS, LINE retry/deduplication, permanent failure, no notification for failed saves.');