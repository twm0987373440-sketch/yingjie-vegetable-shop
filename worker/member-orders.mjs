// Private member order reads. Deploy with a Firestore read-only service account.
const MEMBER_ORIGIN = 'https://twm0987373440-sketch.github.io';
const MEMBER_FIRESTORE = 'https://firestore.googleapis.com/v1/projects/apple-6b54f/databases/(default)/documents';
const memberEncoder = new TextEncoder();
function memberB64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function memberUnb64(text) { return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0)); }
async function authenticatedMember(request, env) {
 const token = (request.headers.get('Authorization') || '').match(/^Bearer ([\w.-]+)$/)?.[1];
 if (!token || token.length > 8192 || !env.LINE_CHANNEL_SECRET) return null;
 try {
  const [head,body,signature,...extra] = token.split('.');
  if(extra.length || !signature || JSON.parse(new TextDecoder().decode(memberUnb64(head))).alg !== 'HS256') return null;
  const key = await crypto.subtle.importKey('raw',memberEncoder.encode(env.LINE_CHANNEL_SECRET + ':member-v2'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,memberUnb64(signature),memberEncoder.encode(head+'.'+body))) return null;
  const claims=JSON.parse(new TextDecoder().decode(memberUnb64(body)));
  if(!/^U[0-9a-f]{32}$/i.test(claims.sub||'') || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000) return null;
  return claims;
 } catch { return null; }
}
let memberGoogleToken;
async function memberReadToken(env) {
 const service=JSON.parse(env.FIRESTORE_READER_JSON || '{}');
 if(service.project_id !== 'apple-6b54f' || !service.private_key || !service.client_email) throw Error('Reader not configured');
 if(memberGoogleToken?.email===service.client_email && memberGoogleToken.expires>Date.now()+60000) return memberGoogleToken.token;
 const now=Math.floor(Date.now()/1000);
 const encode=value=>memberB64(memberEncoder.encode(JSON.stringify(value)));
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:service.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const key=await crypto.subtle.importKey('pkcs8',memberUnb64(service.private_key.replace(/-----[^-]+-----|\s/g,'')),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=memberB64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,memberEncoder.encode(unsigned))));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),signal:AbortSignal.timeout(10000)});
 const data=await response.json();
 if(!response.ok || !data.access_token) throw Error('Reader authentication failed');
 memberGoogleToken={email:service.client_email,token:data.access_token,expires:Date.now()+Math.min(data.expires_in||3600,3600)*1000};
 return data.access_token;
}
function memberField(value) {
 if(!value) return null;
 if('stringValue' in value) return value.stringValue;
 if('integerValue' in value) return Number(value.integerValue);
 if('doubleValue' in value) return value.doubleValue;
 if('timestampValue' in value) return value.timestampValue;
 if('booleanValue' in value) return value.booleanValue;
 if(value.arrayValue) return (value.arrayValue.values||[]).map(memberField);
 if(value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,memberField(v)]));
 return null;
}
function memberJson(data,status=200) { return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':MEMBER_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization'}}); }
async function memberOrdersApi(request,env) {
 if(request.method==='OPTIONS') return memberJson(null,204);
 if(request.method!=='GET') return memberJson({ok:false,error:'Method not allowed'},405);
 const member=await authenticatedMember(request,env);
 if(!member) return memberJson({ok:false,error:'登入已到期，請重新使用 LINE 登入。'},401);
 try {
  // Only the verified LINE subject can choose the member filter. Never accept a client memberId.
  const token=await memberReadToken(env);
  const response=await fetch(MEMBER_FIRESTORE+':runQuery',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({structuredQuery:{from:[{collectionId:'orders'}],where:{fieldFilter:{field:{fieldPath:'memberId'},op:'EQUAL',value:{stringValue:member.sub}}}}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw Error('Order read failed');
  const rows=await response.json();
  if(!Array.isArray(rows) || rows.some(r=>r.error)) throw Error('Invalid query result');
  const orders=rows.filter(r=>r.document).map(({document:d})=>({id:d.name.split('/').pop(),memberId:memberField(d.fields?.memberId),createdAt:memberField(d.fields?.createdAt),status:memberField(d.fields?.status),items:memberField(d.fields?.items),subtotal:memberField(d.fields?.subtotal),discount:memberField(d.fields?.discount),total:memberField(d.fields?.total),note:memberField(d.fields?.note)})).filter(o=>o.memberId===member.sub).map(o=>({id:o.id,createdAt:o.createdAt,status:o.status||'new',items:o.items||[],subtotal:o.subtotal,discount:o.discount||0,total:o.total||0,note:o.note||''})).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return memberJson({ok:true,orders});
 } catch { return memberJson({ok:false,error:'訂單暫時無法載入，請稍後重新查詢，或聯絡英姐商行。'},503); }
}
export {authenticatedMember,memberOrdersApi,memberField};
