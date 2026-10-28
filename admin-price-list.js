import { generatedPhotoFor } from "./product-photos.js?v=20261019-waxy-corn";
import { categoryOf, photoSource } from "./shop-utils.js?v=20261022-groups";
import { displayPrice, parsePriceInput } from "./price-utils.js?v=20261007-weight";

export function isMarketPrice(p) {
  return typeof p?.priceLabel === "string" && p.priceLabel.includes("時價");
}
export function parsePrintPrice(value) {
  if (!String(value ?? "").trim()) return null;
  const parsed = parsePriceInput(value);
  if (parsed.priceLabel) throw Error("請填入0～100000元的數字，最多兩位小數；留白則顯示時價。");
  return parsed.price;
}
export function printedPrice(p) {
  return isMarketPrice(p) && typeof p.printPrice === "number" && Number.isFinite(p.printPrice) && p.printPrice >= 0 && p.printPrice <= 100000
    ? displayPrice({price: p.printPrice}) : displayPrice(p);
}
const groups = [["leaf","葉菜類"],["root","根莖類"],["gourd","瓜類"],["mushroom","菇類"],["fruit","水果"],["other","其他商品"]];
export function priceListRows(products) {
  return groups.flatMap(([key, label]) => {
    const items = products.filter(p => p.active !== false && p.bundle3for50 !== true && categoryOf(p) === key)
      .sort((a,b) => (a.sort ?? 999) - (b.sort ?? 999) || String(a.name).localeCompare(String(b.name), "zh-Hant"));
    return items.length ? [{heading: label}, ...items.map(p => ({name: String(p.name || ""), price: printedPrice(p), unit: String(p.unit || "份"), photo: photoSource(p.photo) || generatedPhotoFor(p.name)}))] : [];
  });
}

// CORS-safe images keep PNG export available even when a remote photo fails.
export async function loadPriceListPhotos(rows) {
  const photos = new Map();
  const sources = [...new Set(rows.map(r => r.photo).filter(Boolean))];
  let next = 0;
  await Promise.all(Array.from({length: Math.min(6, sources.length)}, async () => {
    while (next < sources.length) {
      const src = sources[next++];
      const image = await new Promise(resolve => {
        const img = new Image();
        const finish = value => { clearTimeout(timer); img.onload = img.onerror = null; resolve(value); };
        const timer = setTimeout(() => finish(null), 8000);
        img.crossOrigin = "anonymous";
        img.onload = () => finish(img); img.onerror = () => finish(null); img.src = src;
      });
      if (image) photos.set(src, image);
    }
  }));
  return photos;
}

export function priceListCanvas(rows, storeName, timestamp, photos = new Map()) {
  const sections = [];
  for (const row of rows) {
    if (row.heading) sections.push({heading: row.heading, items: []});
    else sections.at(-1)?.items.push(row);
  }
  const height = Math.max(1000, 290 + sections.reduce((sum,s) => sum + 66 + Math.ceil(s.items.length / 3) * 132, 0) + 130);
  const canvas = document.createElement("canvas");
  const scale = Math.min(2, 16000 / height, Math.sqrt(14000000 / (1200 * height)));
  canvas.width = Math.floor(1200 * scale); canvas.height = Math.floor(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("此瀏覽器無法產生圖片，請改用 Safari 或 Chrome。");
  ctx.scale(scale, scale);
  const C = {bg:"#323c33", surface:"#3d483c", deep:"#28322b", ink:"#f5f0e1", muted:"#c6ccbb", line:"#626c58", gold:"#ffcd70", accent:"#b4cc88"};
  const box = (x,y,w,h,color) => {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const text = (value,x,y,size=20,color=C.ink,align="left",max=1100,bold=false) => {
    value=String(value); ctx.fillStyle=color; ctx.textAlign=align;
    const font=() => {ctx.font=`${bold?700:400} ${size}px system-ui, -apple-system, "Microsoft JhengHei", sans-serif`;};
    font(); while(ctx.measureText(value).width>max && size>12){size--;font();}
    ctx.fillText(value,x,y,max);
  };
  const lines = (value,x,y,width,size,maxLines=2,color=C.ink) => {
    ctx.font=`700 ${size}px system-ui, -apple-system, "Microsoft JhengHei", sans-serif`;
    const result=[];let line="";
    for(const char of String(value)) {
      if(line && ctx.measureText(line+char).width>width){result.push(line);line="";}
      line+=char;
    }
    if(line)result.push(line);
    // Reduce the font for unusually long names rather than omit product text.
    if(result.length>maxLines && size>12) return lines(value,x,y,width,size-1,maxLines,color);
    result.forEach((v,i)=>text(v,x,y+i*(size+5),size,color,"left",width,true));
  };
  box(0,0,1200,height,C.bg);
  box(24,24,1152,height-48,C.line);box(26,26,1148,height-52,C.bg);
  text(storeName,52,82,30,C.accent,"left",760,true);
  text("蔬菜價目表",48,170,72,C.ink,"left",840,true);
  box(870,60,278,60,C.gold);
  text(timestamp.split(" ")[0],1009,101,29,C.deep,"center",250,true);
  text("每日新鮮・單項商品",52,221,22,C.muted);
  text(`共 ${rows.filter(r=>!r.heading).length} 項｜新臺幣`,1148,221,22,C.muted,"right");
  box(52,245,1096,3,C.gold);
  let y=274;
  sections.forEach(section => {
    box(52,y,1096,48,C.deep);
    box(52,y,5,48,C.accent);
    text(section.heading,70,y+33,26,C.accent,"left",330,true);
    text("品項 ／ 單位 ／ 價格",1130,y+32,18,C.muted,"right");
    y+=54;
    section.items.forEach((row,i) => {
      const x=52+(i%3)*370, top=y+Math.floor(i/3)*132;
      box(x,top,356,124,C.surface);
      const image=photos.get(row.photo);
      if(image) {
        const ratio=Math.min(98/image.naturalWidth,100/image.naturalHeight);
        const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
        ctx.drawImage(image,x+10+(98-w)/2,top+12+(100-h)/2,w,h);
      } else {
        box(x+10,top+14,98,96,C.deep);
        text("鮮蔬",x+59,top+69,23,C.accent,"center",88);
      }
      lines(row.name,x+122,top+32,220,23,2);
      text("每"+row.unit,x+122,top+109,17,C.muted,"left",84);
      if(row.price.startsWith("NT$")) {
        text(row.price.slice(3),x+318,top+111,42,C.gold,"right",108,true);
        text("元",x+344,top+110,18,C.gold,"right");
      } else {
        lines(row.price,x+214,top+88,130,21,2,C.gold);
      }
    });
    y+=Math.ceil(section.items.length/3)*132+12;
  });
  box(52,height-108,1096,1,C.line);
  text("部分商品實際金額以現場秤重為主；時價商品請洽店家。",52,height-72,22,C.ink);
  text("更新："+timestamp+"｜價格依當日公告為準",52,height-39,18,C.muted);
  return canvas;
}

export function mountPriceList({load, save, canOpen, show}) {
  const $ = id => document.getElementById(id);
  let busy=false, url="", generation=0, drafts=[];
  const dirty = () => drafts.filter(d => d.input.value !== d.original);
  function renderEditor(products) {
    drafts=[];
    $("marketPriceFields").replaceChildren();
    const items=products.filter(p => p.bundle3for50 !== true && isMarketPrice(p))
      .sort((a,b)=>(a.sort ?? 999)-(b.sort ?? 999));
    for(const p of items) {
      const label=document.createElement("label"); label.className="form-label";
      const name=document.createElement("span");
      name.textContent=p.name+"／"+(p.unit || "份")+(p.active === false ? "（下架中）" : "");
      const input=document.createElement("input");
      input.type="text"; input.inputMode="decimal"; input.placeholder="留白顯示時價";
      input.value=typeof p.printPrice === "number" ? String(p.printPrice) : "";
      drafts.push({id:p.id, name:p.name, input, original:input.value});
      input.addEventListener("input",()=>{
        clear();
        $("marketPriceSave").disabled=!dirty().length;
        $("marketPriceStatus").textContent="價格已修改，請按「儲存並更新價目表」。";
      });
      label.append(name,input); $("marketPriceFields").append(label);
    }
    $("marketPriceSave").disabled=true;
    $("marketPriceStatus").textContent=items.length ? `共 ${items.length} 項時價商品，之後新增的時價商品會自動列入。` : "目前沒有時價商品。";
  }
  $("marketPriceSave").addEventListener("click",async()=>{
    if(busy || !canOpen() || !dirty().length) return;
    let changes;
    try { changes=dirty().map(d=>({id:d.id, printPrice:parsePrintPrice(d.input.value)})); }
    catch(error) { $("marketPriceStatus").textContent=error.message; return; }
    busy=true;
    $("marketPriceSave").disabled=true; $("priceListRefresh").disabled=true;
    drafts.forEach(d=>d.input.disabled=true);
    $("marketPriceStatus").textContent="正在儲存…";
    let saved=false;
    try {
      await save(changes);
      drafts.forEach(d=>d.original=d.input.value);
      saved=true;
    } catch(error) {
      $("marketPriceStatus").textContent="儲存失敗，輸入仍保留，請重試："+error.message;
    } finally {
      busy=false; $("priceListRefresh").disabled=false;
      drafts.forEach(d=>d.input.disabled=false);
      $("marketPriceSave").disabled=!dirty().length;
    }
    if(saved) await refresh();
  });
  function clear() {
    if(url) URL.revokeObjectURL(url);
    url=""; $("priceListImage").removeAttribute("src"); $("priceListImage").hidden=true;
    $("priceListDownload").hidden=true; $("priceListPrint").disabled=true;
    $("priceListText").replaceChildren();
  }
  async function refresh() {
    if(busy || !canOpen()) return;
    show();
    if(dirty().length) {
      $("marketPriceStatus").textContent="您有尚未儲存的價格，請先按「儲存並更新價目表」。";
      return;
    } busy=true; const current=++generation; clear();
    $("priceListRefresh").disabled=true;
    $("priceListStatus").textContent="正在讀取最新價格…";
    try {
      const {products,storeName}=await load();
      renderEditor(products);
      const rows=priceListRows(products);
      if(!rows.length) { $("priceListStatus").textContent="目前沒有已上架的單項商品。"; return; }
      await document.fonts.ready;
      const now=new Date();
      const timestamp=now.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
      $("priceListStatus").textContent="正在排版並載入商品照片…";
      const photos=await loadPriceListPhotos(rows);
      const canvas=priceListCanvas(rows,storeName,timestamp,photos);
      const blob=await new Promise((resolve,reject) => canvas.toBlob(b=>b?resolve(b):reject(Error("圖片產生失敗，請重新整理價目表。")),"image/png"));
      if(current!==generation) return;
      url=URL.createObjectURL(blob);
      $("priceListImage").src=url; $("priceListImage").hidden=false;
      $("priceListDownload").href=url;
      $("priceListDownload").download="單項商品價目表-"+now.toLocaleDateString("sv-SE",{timeZone:"Asia/Taipei"})+".png";
      $("priceListDownload").hidden=false; $("priceListPrint").disabled=false;
      $("priceListStatus").textContent=`已更新：${timestamp}｜共 ${rows.filter(r=>!r.heading).length} 項。圖片開啟後也可長按儲存。${rows.some(r=>r.photo && !photos.has(r.photo)) ? " 部分照片未能載入，已以文字替代；可按更新重試。" : ""}`;
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
  window.addEventListener("beforeunload",event => { if(busy || dirty().length) { event.preventDefault(); event.returnValue=""; } if(url) URL.revokeObjectURL(url); });
}


