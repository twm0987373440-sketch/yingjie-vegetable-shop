// Appended to the existing LINE login Worker; login routes stay unchanged.
const ORDER_ORIGIN = 'https://twm0987373440-sketch.github.io';
const ORDER_SITE = ORDER_ORIGIN + '/yingjie-vegetable-shop/';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/apple-6b54f/databases/(default)/documents';
const ORDER_SCHEMA = `CREATE TABLE IF NOT EXISTS order_notifications (
 request_id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
 payload TEXT, total REAL NOT NULL, created INTEGER NOT NULL,
 saved INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
 first_push INTEGER, last_error TEXT, recipient TEXT NOT NULL
)`;

function orderJson(data, status=200) {
 return new Response(status===204?null:JSON.stringify(data), {status, headers:{
  'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
  'Access-Control-Allow-Origin':ORDER_ORIGIN, 'Vary':'Origin',
  'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization'
 }});
}
function firestoreValue(value) {
 if(value === null) return {nullValue:null};
 if(typeof value === 'string') return {stringValue:value};
 if(typeof value === 'boolean') return {booleanValue:value};
 if(typeof value === 'number') return {doubleValue:value};
 if(Array.isArray(value)) return {arrayValue:{values:value.map(firestoreValue)}};
 return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,firestoreValue(v)]))}};
}
async function orderHash(text) {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
}
function validateOrder(body) {
 const o=body.order;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId||'') || !o) throw Error('請重新整理後再試。');
 if(typeof o.customerName!=='string'||!o.customerName.trim()||o.customerName.length>100) throw Error('請填寫姓名（最多100字）。');
 if(typeof o.customerPhone!=='string'||!o.customerPhone.trim()||o.customerPhone.length>40) throw Error('請填寫電話。');
 if(typeof o.note!=='string'||o.note.length>1000) throw Error('備註最多1000字。');
 if(!Array.isArray(o.items)||!o.items.length||o.items.length>100) throw Error('請確認購物車商品。');
 const items=o.items.map(i=>{
  if(typeof i.name!=='string'||!i.name||i.name.length>100||typeof i.unit!=='string'||i.unit.length>20||!Number.isFinite(i.price)||i.price<0||i.price>100000||!Number.isInteger(i.qty)||i.qty<1||i.qty>999) throw Error('商品資料不正確，請重新整理。');
  return {name:i.name,unit:i.unit,price:i.price,qty:i.qty};
 });
 const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
 const discount=o.discount||0;
 if(!Number.isFinite(o.total)||o.total<0||o.total>1000000||!Number.isFinite(discount)||discount<0||discount>subtotal||Math.abs(subtotal-discount-o.total)>0.01) throw Error('金額不正確，請重新整理。');
 return {customerName:o.customerName.trim(),customerPhone:o.customerPhone.trim(),note:o.note,items,subtotal,discount,bundleQty:Number.isInteger(o.bundleQty)?o.bundleQty:0,promotion:discount?'3包50元':'',total:o.total,status:'new',memberLoggedIn:Boolean(o.memberLoggedIn),memberId:typeof o.memberId==='string'?o.memberId.slice(0,100):null,memberName:typeof o.memberName==='string'?o.memberName.slice(0,100):null};
}
async function pushOrderNotice(env,row) {
 if(!row.saved||row.sent) return;
 const now=Date.now();
 // Stop before LINE's 24-hour deduplication window expires.
 if(row.first_push && now-row.first_push>23*60*60*1000) {
  await env.ORDER_DB.prepare('UPDATE order_notifications SET sent=-1,last_error=? WHERE request_id=? AND sent=0').bind('LINE retry window expired; manual review required',row.request_id).run(); return;
 }
 await env.ORDER_DB.prepare('UPDATE order_notifications SET first_push=COALESCE(first_push,?), attempts=attempts+1, next_attempt=? WHERE request_id=? AND sent=0').bind(now,now+Math.min(3600000,60000*2**Math.min(row.attempts,6)),row.request_id).run();
 try {
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'2-digit',month:'2-digit',day:'2-digit'}).format(new Date(row.created)).replaceAll('-','');
  const short=row.order_id.replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toUpperCase();
  const text=`🥬 英姐蔬果商行｜收到新訂單\n訂單編號：${day}-${short}\n金額：NT$${row.total.toLocaleString('zh-TW')}\n\n請開啟後台查看商品與聯絡資料：\n${ORDER_SITE}admin.html`;
  const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,'X-Line-Retry-Key':row.order_id},body:JSON.stringify({to:row.recipient,messages:[{type:'text',text}]}),signal:AbortSignal.timeout(10000)});
  if(response.ok||(response.status===409&&response.headers.get('x-line-accepted-request-id'))) {
   await env.ORDER_DB.prepare('UPDATE order_notifications SET sent=1,payload=NULL,last_error=NULL WHERE request_id=?').bind(row.request_id).run();
  } else {
   const permanent=response.status>=400&&response.status<500&&response.status!==429;
   await env.ORDER_DB.prepare('UPDATE order_notifications SET sent=?,last_error=? WHERE request_id=? AND sent=0').bind(permanent?-1:0,'LINE HTTP '+response.status,row.request_id).run();
  }
 } catch { await env.ORDER_DB.prepare('UPDATE order_notifications SET last_error=? WHERE request_id=? AND sent=0').bind('LINE network error',row.request_id).run(); }
}
async function orderApi(request,env,ctx,getMember=async(_request,_env)=>null) {
 if(request.method==='OPTIONS') return orderJson(null,204);
 if(request.method!=='POST') return orderJson({ok:false,error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==ORDER_ORIGIN) return orderJson({ok:false,error:'Origin not allowed'},403);
 if(!env.ORDER_DB||!env.LINE_CHANNEL_ACCESS_TOKEN||!/^U[0-9a-f]{32}$/i.test(env.LINE_OWNER_USER_ID||'')) return orderJson({ok:false,error:'訂單服務設定中，請稍後再試。'},503);
 try {
  const text=await request.text();
  if(text.length>50000) return orderJson({ok:false,error:'訂單內容過長。'},413);
  let body,order;
  try {body=JSON.parse(text);order=validateOrder(body);} catch(e) {return orderJson({ok:false,error:e.message||'訂單格式錯誤。'},400);}
  const verifiedMember=await getMember(request,env);
  if((order.memberLoggedIn || request.headers.has('Authorization')) && !verifiedMember) return orderJson({ok:false,error:'會員登入已到期，請重新登入後送出。'},401);
  if(verifiedMember && order.memberId!==verifiedMember.sub) return orderJson({ok:false,error:'會員身分已變更，請重新整理後送出。'},401);
  order.memberLoggedIn=Boolean(verifiedMember);
  order.memberId=verifiedMember?.sub||null;
  order.memberName=verifiedMember?.name||null;
  const payload=JSON.stringify(order), hash=await orderHash(payload);
  await env.ORDER_DB.prepare(ORDER_SCHEMA).run();
  await env.ORDER_DB.prepare('INSERT OR IGNORE INTO order_notifications(request_id,order_id,payload_hash,payload,total,created,recipient) VALUES(?,?,?,?,?,?,?)').bind(body.requestId,crypto.randomUUID(),hash,payload,order.total,Date.now(),env.LINE_OWNER_USER_ID).run();
  const row=await env.ORDER_DB.prepare('SELECT * FROM order_notifications WHERE request_id=?').bind(body.requestId).first();
  if(row.payload_hash!==hash) return orderJson({ok:false,error:'前一筆訂單尚待確認，請勿變更內容後重送。'},409);
  if(!row.saved) {
   const name='projects/apple-6b54f/databases/(default)/documents/orders/'+row.order_id;
   let response;
   try {response=await fetch(FIRESTORE_BASE+':commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes:[{update:{name,fields:firestoreValue(JSON.parse(row.payload)).mapValue.fields},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]}),signal:AbortSignal.timeout(15000)});} catch {return orderJson({ok:false,pending:true,error:'網路連線中斷，請保留購物車並再次按送出，我們會使用同一筆訂單確認。'},503);}
   const result=await response.json();
   if(!response.ok&&result.error?.status!=='ALREADY_EXISTS') {
    await env.ORDER_DB.prepare('UPDATE order_notifications SET last_error=? WHERE request_id=?').bind('Firestore '+(result.error?.status||response.status),row.request_id).run();
    return orderJson({ok:false,pending:true,error:'訂單尚未確認，請稍後用相同內容重試；若持續出現，請聯絡店家確認，勿重複建立訂單。'},503);
   }
   await env.ORDER_DB.prepare('UPDATE order_notifications SET saved=1,payload=NULL,last_error=NULL WHERE request_id=?').bind(row.request_id).run(); row.saved=1;
  }
  ctx.waitUntil(pushOrderNotice(env,row));
  return orderJson({ok:true,orderId:row.order_id,total:row.total});
 } catch { return orderJson({ok:false,pending:true,error:'系統暫時忙碌，請稍後以相同內容重試。'},503); }
}
async function retryOrderNotifications(env) {
 if(!env.ORDER_DB||!env.LINE_CHANNEL_ACCESS_TOKEN) return;
 await env.ORDER_DB.prepare(ORDER_SCHEMA).run();
 const {results}=await env.ORDER_DB.prepare('SELECT * FROM order_notifications WHERE saved=1 AND sent=0 AND next_attempt<=? ORDER BY created LIMIT 20').bind(Date.now()).all();
 for(const row of results) await pushOrderNotice(env,row);
}

export {orderApi,retryOrderNotifications,ORDER_SCHEMA,pushOrderNotice,validateOrder};
