import { categoryOf } from "./shop-utils.js?v=20261022-groups";
import { displayPrice } from "./price-utils.js?v=20261007-weight";

const groups = [["leaf","葉菜類"],["root","根莖類"],["gourd","瓜類"],["mushroom","菇類"],["fruit","水果"],["other","其他商品"]];
export function priceListRows(products) {
  return groups.flatMap(([key, label]) => {
    const items = products.filter(p => p.active !== false && p.bundle3for50 !== true && categoryOf(p) === key)
      .sort((a,b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return items.length ? [{heading: label}, ...items.map(p => ({name: String(p.name || ""), price: displayPrice(p), unit: String(p.unit || "份")}))] : [];
  });
}

// Draw text directly, without remote images or HTML, so PNG export works on phones.
export function priceListCanvas(rows, storeName, timestamp) {
  const columns = [[], [], []];
  const target = Math.ceil(rows.length / 3);
  let col = 0;
  rows.forEach((row, i) => {
    if (col < 2 && columns[col].length >= target && !rows[i-1]?.heading) col++;
    columns[col].push(row);
  });
  const count = rows.filter(r => !r.heading).length;
  const height = Math.max(1200, 320 + Math.max(...columns.map(c => c.length)) * 42);
  const canvas = document.createElement("canvas");
  // Stay below common mobile canvas area limits for larger catalogues.
  const scale = Math.min(2, Math.sqrt(14000000 / (1200 * height)));
  canvas.width = Math.floor(1200 * scale); canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("此瀏覽器無法產生圖片，請改用 Safari 或 Chrome。");
  ctx.scale(scale, scale);
  const green = "#244b39", cream = "#f8f6ee";
  const text = (value,x,y,size=20,color=green,align="left",max=1000) => {
    ctx.fillStyle=color; ctx.textAlign=align;
    ctx.font=`${size}px system-ui, -apple-system, "Microsoft JhengHei", sans-serif`;
    while (ctx.measureText(value).width > max && size > 10) {
      size--; ctx.font=`${size}px system-ui, -apple-system, "Microsoft JhengHei", sans-serif`;
    }
    ctx.fillText(value,x,y,max);
  };
  ctx.fillStyle=cream; ctx.fillRect(0,0,1200,height);
  ctx.fillStyle=green; ctx.fillRect(0,0,1200,195);
  text(storeName,44,55,25,"#e6d9ac","left",1100);
  text("單項商品價目表",44,125,48,"#ffffff");
  text(`共 ${count} 項商品｜新臺幣`,44,170,20,"#e6d9ac");
  text(timestamp,1156,170,18,"#e6d9ac","right",650);
  columns.forEach((items,i) => {
    const x=44+i*380; let y=240;
    items.forEach(row => {
      if(row.heading) {
        ctx.fillStyle="#e3eadd"; ctx.fillRect(x,y-26,352,36);
        text(row.heading,x+10,y,23);
      } else {
        text(row.name,x+2,y,21,green,"left",210);
        text(row.price+" / "+row.unit,x+350,y,18,green,"right",133);
        ctx.strokeStyle="#dce2d6"; ctx.beginPath(); ctx.moveTo(x,y+12);ctx.lineTo(x+352,y+12);ctx.stroke();
      }
      y+=42;
    });
  });
  text("時價商品請洽店家，依現場秤重計價。",44,height-65,20);
  text("價格依當日公告為準；部分商品實際金額以現場秤重為主。",44,height-30,18,"#5d685f");
  return canvas;
}

export function mountPriceList({load, canOpen, show}) {
  const $ = id => document.getElementById(id);
  let busy=false, url="", generation=0;
  function clear() {
    if(url) URL.revokeObjectURL(url);
    url=""; $("priceListImage").removeAttribute("src"); $("priceListImage").hidden=true;
    $("priceListDownload").hidden=true; $("priceListPrint").disabled=true;
    $("priceListText").replaceChildren();
  }
  async function refresh() {
    if(busy || !canOpen()) return;
    show(); busy=true; const current=++generation; clear();
    $("priceListRefresh").disabled=true;
    $("priceListStatus").textContent="正在讀取最新價格…";
    try {
      const {products,storeName}=await load();
      const rows=priceListRows(products);
      if(!rows.length) { $("priceListStatus").textContent="目前沒有已上架的單項商品。"; return; }
      await document.fonts.ready;
      const now=new Date();
      const timestamp=now.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
      const canvas=priceListCanvas(rows,storeName,timestamp);
      const blob=await new Promise((resolve,reject) => canvas.toBlob(b=>b?resolve(b):reject(Error("圖片產生失敗，請重新整理價目表。")),"image/png"));
      if(current!==generation) return;
      url=URL.createObjectURL(blob);
      $("priceListImage").src=url; $("priceListImage").hidden=false;
      $("priceListDownload").href=url;
      $("priceListDownload").download="單項商品價目表-"+now.toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"})+".png";
      $("priceListDownload").hidden=false; $("priceListPrint").disabled=false;
      $("priceListStatus").textContent=`已更新：${timestamp}｜共 ${rows.filter(r=>!r.heading).length} 項。圖片開啟後也可長按儲存。`;
      for(const row of rows) {
        const el=document.createElement(row.heading?"h3":"p");
        el.textContent=row.heading || row.name+"　"+row.price+" / "+row.unit;
        $("priceListText").append(el);
      }
    } catch(error) {
      clear(); $("priceListStatus").textContent="無法產生最新價目表："+(error.message || "請確認網路後重試。");
    } finally { busy=false; $("priceListRefresh").disabled=false; }
  }
  $("priceListTab").addEventListener("click",refresh);
  $("priceListRefresh").addEventListener("click",refresh);
  $("priceListPrint").addEventListener("click",() => { if(url) window.print(); });
  window.addEventListener("beforeunload",() => { if(url) URL.revokeObjectURL(url); });
}
