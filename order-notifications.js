const API='https://yingjie-line-login.twm0987373440.workers.dev';
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export function mountOrderNotifications(auth,adminUid) {
 const panel=document.getElementById('orderNotifications');
 const status=document.getElementById('pushStatus');
 const enable=document.getElementById('pushEnable'),disable=document.getElementById('pushDisable'),test=document.getElementById('pushTest');
 let registration,subscription,busy=false,ready=false;
 const owner=()=>auth.currentUser?.uid===adminUid;
 const buttons=()=>{enable.disabled=busy||!owner()||!ready;disable.disabled=busy||!owner()||!subscription;test.disabled=busy||!owner()||!subscription;};
 async function api(path,method='GET',data) {
  if(!owner()) throw Error('請先登入管理員。');
  const token=await auth.currentUser.getIdToken();
  const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000),cache:'no-store'});
  let result;try{result=await r.json();}catch{throw Error('通知服務尚未就緒，請稍後再試。');}
  if(!r.ok||!result.ok) throw Error(result.error||'通知設定失敗，請重試。');
  return result;
 }
 const run=fn=>async()=>{if(busy)return;busy=true;buttons();try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;buttons();}};
 enable.addEventListener('click',run(async()=>{
  if(!ready||!owner())return;
  // Permission is requested directly from this user gesture, before network awaits (iOS).
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw Error('尚未允許通知。請在 iPhone「設定 → 通知 → 英姐訂單」開啟通知。');
  const config=await api('/push/config');
  subscription=await registration.pushManager.getSubscription();
  if(subscription) {
   const old=new Uint8Array(subscription.options.applicationServerKey||[]),next=decode(config.publicKey);
   if(old.length!==next.length||old.some((v,i)=>v!==next[i])) {await subscription.unsubscribe();subscription=null;}
  }
  subscription ||= await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(config.publicKey)});
  try{await api('/push/subscription','POST',{endpoint:subscription.endpoint});}
  catch(e){status.textContent='手機已允許通知，但綁定失敗；請再按啟用通知。';throw e;}
  status.textContent='這部手機已綁定。請按「傳送測試通知」確認收得到；關閉後台後仍可收到通知。';
 }));
 disable.addEventListener('click',run(async()=>{
  if(!subscription)return;
  await api('/push/subscription','DELETE',{endpoint:subscription.endpoint});
  await subscription.unsubscribe();subscription=null;
  status.textContent='已停止這部裝置的新訂單通知。';
 }));
 test.addEventListener('click',run(async()=>{const r=await api('/push/test','POST',{endpoint:subscription.endpoint});status.textContent=r.message;}));
 async function refresh() {
  panel.hidden=false;
  if(isIOS()&&!standalone()) {status.textContent='請先用 Safari 開啟本頁 → 分享 → 加入主畫面，名稱設為「英姐訂單」。再從桌面圖示開啟並登入。';buttons();return;}
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)) {status.textContent='這個瀏覽器不支援通知。iPhone 請更新系統，並從主畫面的「英姐訂單」開啟。';buttons();return;}
  try {
   registration=await navigator.serviceWorker.register('./order-sw.js',{scope:'./',updateViaCache:'none'});
   await navigator.serviceWorker.ready;
   subscription=await registration.pushManager.getSubscription();ready=true;
   status.textContent=!owner()?'請先登入管理員，再啟用這部手機的通知。':subscription?'此裝置已有通知訂閱；可按啟用通知確認綁定，或傳送測試。':'登入後按「啟用這部手機通知」，並允許通知。';
  }catch{status.textContent='通知元件載入失敗，請確認網路後重新開啟。';}
  buttons();
 }
 refresh();
 return {refresh};
}
