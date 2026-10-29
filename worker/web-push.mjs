// Empty-payload Web Push: customer details never leave the order backend.
const PUSH_ORIGIN = 'https://twm0987373440-sketch.github.io';
const PUSH_ADMIN = 'r8lFDyFoDTUffnwN6waBm0cMlHl1';
const PUSH_FIREBASE_KEY = 'AIzaSyCUvk_siNwOMobU3rHKPJob76jirvFP0Ts';
const PUSH_SCHEMA = [
 `CREATE TABLE IF NOT EXISTS web_push_devices (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, created INTEGER NOT NULL, last_test INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS web_push_jobs (order_id TEXT NOT NULL, device_id TEXT NOT NULL, created INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, error TEXT, PRIMARY KEY(order_id,device_id))`,
 `CREATE INDEX IF NOT EXISTS web_push_pending ON web_push_jobs(sent,next_attempt)`
];
const pushB64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const pushUnb64 = s => Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
const pushEncode = s => new TextEncoder().encode(s);
async function pushHash(s) { return pushB64(await crypto.subtle.digest('SHA-256',pushEncode(s))); }
function pushEndpoint(s) {
 if(typeof s!=='string'||s.length>2048) throw Error('Invalid subscription');
 const u=new URL(s);
 const allowed = u.hostname==='web.push.apple.com' || /^[a-z0-9-]+\.push\.apple\.com$/.test(u.hostname) || u.hostname==='fcm.googleapis.com' || u.hostname==='updates.push.services.mozilla.com';
 if(!allowed||u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.pathname==='/') throw Error('Invalid push endpoint');
 return u.href;
}
function pushConfig(env) {
 const jwk=JSON.parse(env.WEB_PUSH_PRIVATE_JWK||'null');
 if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||!jwk.d||!jwk.x||!jwk.y) throw Error('Push not configured');
 const x=pushUnb64(jwk.x),y=pushUnb64(jwk.y);
 if(x.length!==32||y.length!==32) throw Error('Push key invalid');
 return {jwk,publicKey:pushB64(new Uint8Array([4,...x,...y]))};
}
async function pushInit(env) { for(const sql of PUSH_SCHEMA) await env.ORDER_DB.prepare(sql).run(); }
async function pushAdmin(request,fetcher=fetch) {
 const token=(request.headers.get('Authorization')||'').match(/^Bearer ([\w.-]+)$/)?.[1];
 if(!token||token.length>8192) return false;
 try { const claims=JSON.parse(new TextDecoder().decode(pushUnb64(token.split('.')[1]))); if(claims.aud!=='apple-6b54f'||claims.iss!=='https://securetoken.google.com/apple-6b54f'||claims.sub!==PUSH_ADMIN||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000) return false; } catch {return false;}
 const r=await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+PUSH_FIREBASE_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
 if(!r.ok) return false;
 const data=await r.json();
 return data.users?.length===1 && data.users[0].localId===PUSH_ADMIN && !data.users[0].disabled;
}
function pushJson(data,status=200) {
 return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':PUSH_ORIGIN,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS'}});
}
async function sendWebPush(env,endpoint,topic,fetcher=fetch) {
 endpoint=pushEndpoint(endpoint);
 const {jwk,publicKey}=pushConfig(env);
 const encode=o=>pushB64(pushEncode(JSON.stringify(o)));
 const unsigned=encode({typ:'JWT',alg:'ES256'})+'.'+encode({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:PUSH_ORIGIN+'/yingjie-vegetable-shop/'});
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=pushB64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,pushEncode(unsigned)));
 // Workers does not implement redirect:'error'. Manual returns 3xx without
 // forwarding the VAPID Authorization header to another destination.
 return fetcher(endpoint,{method:'POST',headers:{Authorization:`vapid t=${unsigned}.${signature}, k=${publicKey}`,TTL:'86400',Urgency:'high',Topic:topic.slice(0,32)},body:new Uint8Array(0),redirect:'manual',signal:AbortSignal.timeout(10000)});
}
async function webPushApi(request,env) {
 const path=new URL(request.url).pathname;
 if(request.headers.get('Origin')!==PUSH_ORIGIN) return pushJson({ok:false,error:'Origin not allowed'},403);
 if(request.method==='OPTIONS') return pushJson(null,204);
 if(!['/push/config','/push/subscription','/push/test'].includes(path)) return pushJson({ok:false},404);
 const method=path==='/push/config'?'GET':path==='/push/test'?'POST':null;
 if((method&&request.method!==method)||(!method&&!['POST','DELETE'].includes(request.method))) return pushJson({ok:false},405);
 try {
  if(!await pushAdmin(request)) return pushJson({ok:false,error:'請先登入管理員帳號。'},401);
  if(!env.ORDER_DB) throw Error('Database not configured');
  const {publicKey}=pushConfig(env);
  if(path==='/push/config') return pushJson({ok:true,publicKey});
  const text=await request.text();
  if(text.length>4096) return pushJson({ok:false,error:'資料過長。'},413);
  let endpoint;
  try { endpoint=pushEndpoint(JSON.parse(text).endpoint); } catch { return pushJson({ok:false,error:'通知訂閱資料不正確。'},400); }
  const id=await pushHash(endpoint);
  await pushInit(env);
  if(request.method==='DELETE') {
   await env.ORDER_DB.batch([env.ORDER_DB.prepare('DELETE FROM web_push_devices WHERE id=?').bind(id),env.ORDER_DB.prepare('DELETE FROM web_push_jobs WHERE device_id=?').bind(id)]);
   return pushJson({ok:true});
  }
  if(path==='/push/subscription') {
   const existing=await env.ORDER_DB.prepare('SELECT id FROM web_push_devices WHERE id=?').bind(id).first();
   const count=await env.ORDER_DB.prepare('SELECT COUNT(*) AS n FROM web_push_devices').first();
   if(!existing&&count.n>=10) return pushJson({ok:false,error:'最多綁定10部裝置，請先停用不再使用的裝置。'},409);
   await env.ORDER_DB.prepare('INSERT OR IGNORE INTO web_push_devices(id,endpoint,created) VALUES(?,?,?)').bind(id,endpoint,Date.now()).run();
   return pushJson({ok:true});
  }
  const row=await env.ORDER_DB.prepare('SELECT * FROM web_push_devices WHERE id=?').bind(id).first();
  if(!row) return pushJson({ok:false,error:'請先啟用本機通知。'},404);
  const now=Date.now();
  const claimed=await env.ORDER_DB.prepare('UPDATE web_push_devices SET last_test=? WHERE id=? AND last_test<? RETURNING id').bind(now,id,now-30000).first();
  if(!claimed) return pushJson({ok:false,error:'請等30秒再傳送測試。'},429);
  const response=await sendWebPush(env,endpoint,'yingjie-test');
  if(!response.ok) return pushJson({ok:false,error:'推播服務未接受測試，請停用後重新啟用。'},503);
  return pushJson({ok:true,message:'測試已送交推播服務。請確認手機收到「收到新訂單」提醒；這不會建立訂單。'});
 } catch(e) { console.error('WEB_PUSH_API_ERROR',e.name); return pushJson({ok:false,error:'通知服務暫時無法使用，請稍後重試。'},503); }
}
async function enqueueWebPush(env,row) {
 if(!env.WEB_PUSH_PRIVATE_JWK||!row.saved) return;
 await pushInit(env);
 await env.ORDER_DB.prepare(`INSERT OR IGNORE INTO web_push_jobs(order_id,device_id,created) SELECT ?,id,? FROM web_push_devices WHERE created<=?`).bind(row.order_id,Date.now(),row.created).run();
 await drainWebPush(env);
}
async function drainWebPush(env) {
 const now=Date.now();
 const {results}=await env.ORDER_DB.prepare(`SELECT j.*,d.endpoint FROM web_push_jobs j JOIN web_push_devices d ON d.id=j.device_id WHERE j.sent=0 AND j.next_attempt<=? ORDER BY j.created LIMIT 20`).bind(now).all();
 for(const job of results) {
  // Atomic lease prevents concurrent request/cron sends. A crashed lease is retried.
  const claim=await env.ORDER_DB.prepare(`UPDATE web_push_jobs SET next_attempt=?,attempts=attempts+1 WHERE order_id=? AND device_id=? AND sent=0 AND next_attempt<=? RETURNING attempts`).bind(now+120000,job.order_id,job.device_id,now).first();
  if(!claim) continue;
  let sent=0,error=null,retryAt=now+Math.min(3600000,60000*2**Math.min(claim.attempts,6));
  if(now-job.created>86400000||claim.attempts>12) {sent=-1;error='retry_expired';}
  else {
   try {
    const response=await sendWebPush(env,job.endpoint,await pushHash(job.order_id));
    if(response.ok) sent=1;
    else {
     error='HTTP '+response.status;
     if(response.status===404||response.status===410) {
      await env.ORDER_DB.prepare('DELETE FROM web_push_devices WHERE id=?').bind(job.device_id).run();
      await env.ORDER_DB.prepare('UPDATE web_push_jobs SET sent=-1,error=? WHERE device_id=? AND sent=0').bind('subscription_expired',job.device_id).run();
      sent=-1;
     } else if(response.status>=400&&response.status<500&&response.status!==429) sent=-1;
    }
   } catch {error='network_error';}
  }
  await env.ORDER_DB.prepare('UPDATE web_push_jobs SET sent=?,error=?,next_attempt=? WHERE order_id=? AND device_id=?').bind(sent,error,retryAt,job.order_id,job.device_id).run();
 }
}
async function retryWebPush(env) {
 if(!env.ORDER_DB||!env.WEB_PUSH_PRIVATE_JWK) return;
 await pushInit(env);
 // Recover saved orders even if the immediate enqueue was interrupted. No historical flood.
 await env.ORDER_DB.prepare(`INSERT OR IGNORE INTO web_push_jobs(order_id,device_id,created)
 SELECT o.order_id,d.id,o.created FROM order_notifications o JOIN web_push_devices d ON d.created<=o.created
 WHERE o.saved=1 AND o.created>=?`).bind(Date.now()-86400000).run();
 await drainWebPush(env);
 await env.ORDER_DB.prepare('DELETE FROM web_push_jobs WHERE created<?').bind(Date.now()-7*86400000).run();
}
export {webPushApi,enqueueWebPush,retryWebPush,drainWebPush,sendWebPush,pushAdmin,pushEndpoint,pushConfig,pushInit,PUSH_SCHEMA};
