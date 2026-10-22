export function photoSource(value) {
  if (typeof value !== "string") return "";
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}
export function inferCategory(name) {
  name = String(name || "").trim();
  if (/地瓜葉|番薯葉|甘薯葉|蒜苗|蒜葉/.test(name)) return "leaf";
  if (/菇|木耳|銀耳/.test(name)) return "mushroom";
  if (/蘿蔔|萝卜|馬鈴薯|土豆|洋蔥|地瓜|番薯|甘薯|薑|姜|蒜頭|大蒜|芋|蓮藕|山藥|牛蒡|竹筍|筊白筍|茭白筍|荸薺/.test(name)) return "root";
  if (/蘋果|香蕉|橘|桔|橙|柑|檸檬|葡萄|芒果|鳳梨|西瓜|木瓜|草莓|芭樂|番石榴|梨|桃|奇異果|火龍果|百香果|哈密瓜|香瓜|荔枝|龍眼|柿子|櫻桃|藍莓|酪梨/.test(name)) return "fruit";
  if (/小黃瓜|大黃瓜|胡瓜|黃瓜|絲瓜|苦瓜|南瓜|冬瓜|櫛瓜|節瓜|瓠瓜|蒲瓜|佛手瓜|隼人瓜|扁蒲|越瓜/.test(name)) return "gourd";
  if (/大陸妹|花椰菜|青花菜|高麗菜|白菜|青江菜|小松菜|空心菜|菠菜|地瓜葉|莧菜|萵苣|生菜|油菜|芥菜|芥藍|茼蒿|韭菜|芹菜|香菜|九層塔|蔥|葱|菜/.test(name)) return "leaf";
  return "other";
}
export function categoryOf(product) {
  // Older products stored as "other" can now resolve to the added categories.
  if (["leaf", "root", "gourd", "mushroom", "fruit"].includes(product.category)) return product.category;
  return inferCategory(product.name);
}
// Do not copy photos into the persisted cart or order payload.
export function cartProduct(p) {
  return { id: String(p.id), name: String(p.name || ""), unit: String(p.unit || "份"), price: Number(p.price) || 0, priceLabel: typeof p.priceLabel === "string" ? p.priceLabel : "", bundle3for50: p.bundle3for50 === true };
}
export function reconcileCart(cart, products = null) {
  const out = {};
  for (const [id, item] of Object.entries(cart || {})) {
    if (!item?.p || !Number.isSafeInteger(item.qty) || item.qty <= 0) continue;
    const p = products ? products.find(p => p.id === id && p.active !== false) : item.p;
    if (!p || !Number.isFinite(Number(p.price)) || Number(p.price) < 0) continue;
    out[id] = {p: cartProduct({...p, id}), qty: item.qty};
  }
  return out;
}
export async function compressPhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("請選擇 JPG、PNG 或 WebP 圖片；HEIC 請先轉成 JPG。");
  if(file.size > 20 * 1024 * 1024) throw new Error("原始照片請小於 20 MB。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    // Keep the full photo; cards crop with CSS, the zoom view shows the full image.
    const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4f1e8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for(const quality of [0.82, 0.7, 0.58, 0.46]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if(data.length <= 550000) return data;
    }
    throw new Error("照片壓縮後仍太大，請換一張較小的照片。");
  } catch(error) {
    if(error.name === "EncodingError") throw new Error("無法讀取照片，請換一張 JPG 或 PNG 圖片。");
    throw error;
  } finally { URL.revokeObjectURL(url); }
}

