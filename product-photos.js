// AI-generated illustrative photos. Merchant uploads in Firestore take priority.
const paths = new Map([
  ["小白菜", "images/products/xiaobaicai.webp"],
  ["紅蔥頭", "images/products/shallots.webp"],
  ["地瓜葉", "images/products/sweet-potato-leaves.webp"],
  ["冬粉", "images/products/glass-noodles.webp"],
  ["老薑", "images/products/ginger.webp"],
  ["金針菇", "images/products/enoki.webp"],
  ["蒜頭", "images/products/garlic.webp"],
  ["水果彩椒", "images/products/mini-peppers.webp"],
  ["小刈菜", "images/products/mustard.webp"],
  ["嫩薑", "images/products/young-ginger.webp"],
  ["米粉", "images/products/rice-noodles.webp"],
  ["油菜", "images/products/yu-choy.webp"],
  ["青江菜", "images/products/bok-choy.webp"],
  ["牛蒡", "images/products/burdock.webp"],
  ["秋葵", "images/products/01.webp"],
  ["糯米椒", "images/products/02.webp"],
  ["杏鮑菇", "images/products/03.webp"],
  ["蘆筍", "images/products/04.webp"],
  ["空心菜", "images/products/05.webp"],
  ["地瓜", "images/products/06.webp"],
  ["黃玉米", "images/products/07.webp"],
  ["大陸妹", "images/products/08.webp"],
  ["馬鈴薯", "images/products/09.webp"],
  ["紫米玉米", "images/products/10.webp"],
  ["白蘿蔔", "images/products/11.webp"],
  ["彩椒", "images/products/12.webp"],
  ["青蔥", "images/products/13.webp"],
  ["長豆", "images/products/14.webp"],
  ["四季豆", "images/products/15.webp"],
  ["絲瓜", "images/products/16.webp"],
  ["貝貝南瓜", "images/products/17.webp"],
  ["芹菜", "images/products/18.webp"],
  ["現切竹筍", "images/products/19.webp"],
  ["香菜", "images/products/20.webp"],
  ["香菇", "images/products/21.webp"],
  ["茄子", "images/products/22.webp"],
  ["九層塔", "images/products/23.webp"],
  ["雙色菇", "images/products/24.webp"],
  ["苦瓜", "images/products/25.webp"],
  ["韭菜", "images/products/26.webp"],
  ["皇宮菜", "images/products/27.webp"],
  ["小黃瓜", "images/products/28.webp"],
  ["金瓜", "images/products/29.webp"],
  ["櫛瓜", "images/products/30.webp"],
  ["青花椰菜", "images/products/31.webp"],
  ["芋頭", "images/products/32.webp"],
  ["番茄", "images/products/33.webp"],
  ["皎白筍", "images/products/34.webp"],
  ["高麗菜", "images/products/35.webp"],
  ["竹筍", "images/products/36.webp"],
  ["西洋芹", "images/products/37.webp"],
  ["紅蘿蔔", "images/products/38.webp"],
  ["豆芽菜", "images/products/39.webp"],
  ["紅莧菜", "images/products/40.webp"],
  ["冬瓜", "images/products/41.webp"],
  ["龍鬚菜", "images/products/42.webp"],
  ["玉米筍", "images/products/43.webp"],
  ["洋蔥", "images/products/44.webp"],
  ["韓國白菜", "images/products/45.webp"]
]);
// Allow different merchant spellings, origins and pack sizes to use existing photos.
// These are catalogue illustrations, never a substitute for merchant-uploaded photos.
const aliasRules = [
  [/栗子南瓜|板栗南瓜|日本南瓜|東昇南瓜|南瓜/, "貝貝南瓜"],
  [/青椒|甜椒|燈籠椒|紅椒|黃椒|綠椒/, "彩椒"],
  [/辣椒|糯米椒|青龍椒|青龍/, "糯米椒"],
  [/高麗菜|甘藍菜|包心菜|椰菜/, "高麗菜"],
  [/青江菜|青梗菜|上海青|湯匙菜/, "青江菜"],
  [/小白菜|奶油白菜|娃娃菜/, "小白菜"],
  [/大白菜|結球白菜|山東白菜|包心白菜/, "韓國白菜"],
  [/菠菜|莧菜|紅鳳菜|茼蒿|春菊|皇宮菜|葉菜/, "皇宮菜"],
  [/A菜|萵苣|生菜|油麥菜|福山萵苣/, "大陸妹"],
  [/地瓜葉|番薯葉/, "地瓜葉"],
  [/空心菜|蕹菜|通菜/, "空心菜"],
  [/菜心|油菜|小松菜/, "油菜"],
  [/花椰菜|青花菜|綠花菜|西蘭花/, "青花椰菜"],
  [/韭黃|韭菜花|韭菜/, "韭菜"],
  [/青蔥|蔥花|蔥段|三星蔥|香蔥|珠蔥|大蔥/, "青蔥"],
  [/紅蔥|油蔥頭/, "紅蔥頭"],
  [/九層塔|羅勒|打拋葉/, "九層塔"],
  [/香菜|芫荽|胡荽/, "香菜"],
  [/芹菜|香芹|水芹/, "芹菜"],
  [/西洋芹|西芹/, "西洋芹"],
  [/蒜頭|大蒜|蒜瓣|蒜米/, "蒜頭"],
  [/老薑|生薑|薑母|薑塊/, "老薑"],
  [/嫩薑|仔薑/, "嫩薑"],
  [/馬鈴薯|馬鈴瓜|土豆|洋芋/, "馬鈴薯"],
  [/紅蘿蔔|胡蘿蔔/, "紅蘿蔔"],
  [/白蘿蔔|菜頭/, "白蘿蔔"],
  [/洋蔥|蔥頭/, "洋蔥"],
  [/地瓜|番薯|甘藷|甘薯/, "地瓜"],
  [/芋頭|芋仔/, "芋頭"],
  [/牛蒡/, "牛蒡"],
  [/玉米筍|小玉米/, "玉米筍"],
  [/紫糯玉米|紫玉米|黑玉米/, "紫米玉米"],
  [/玉米|苞米/, "黃玉米"],
  [/小黃瓜|迷你黃瓜|水果小黃瓜/, "小黃瓜"],
  [/大黃瓜|胡瓜|黃瓜/, "小黃瓜"],
  [/絲瓜|菜瓜|角瓜/, "絲瓜"],
  [/苦瓜|涼瓜/, "苦瓜"],
  [/櫛瓜|節瓜|夏南瓜/, "櫛瓜"],
  [/茄子|茄瓜/, "茄子"],
  [/番茄|蕃茄|西紅柿|牛番茄|小番茄|聖女番茄/, "番茄"],
  [/長豆|豇豆/, "長豆"],
  [/四季豆|敏豆|菜豆/, "四季豆"],
  [/豆芽|芽菜|銀芽/, "豆芽菜"],
  [/秋葵|羊角豆/, "秋葵"],
  [/蘆筍|露筍/, "蘆筍"],
  [/金針菇/, "金針菇"],
  [/杏鮑菇/, "杏鮑菇"],
  [/香菇|冬菇/, "香菇"],
  [/鴻喜菇|雪白菇|雙色菇|秀珍菇|美白菇/, "雙色菇"],
  [/菇|蘑菇|木耳/, "香菇"],
  [/冬粉|粉絲/, "冬粉"],
  [/米粉|炊粉/, "米粉"],
  [/茭白筍|皎白筍|筊白筍|美人腿/, "皎白筍"],
  [/綠竹筍|麻竹筍|竹筍|筍子/, "竹筍"]
];

function photoUrl(path) {
  return new URL(path, import.meta.url).href;
}

function cleanName(name) {
  return String(name || "")
    .normalize("NFKC")
    .replace(/[（(][^()（）]*[）)]/g, "")
    .replace(/[\s\u3000.,，、\-–—_]/g, "")
    .replace(/^(新鮮|嚴選|特選|特級|有機|本土|本地|進口|台灣|臺灣)+/, "");
}

// Returns a generic produce illustration for an unknown name. Do not show
// a specific, unrelated vegetable as if it were the customer's product.
export function fallbackPhotoFor(category = "") {
  if (category === "leaf") return photoUrl("images/products/bok-choy.webp");
  if (category === "root") return photoUrl("images/products/09.webp");
  if (category === "mushroom") return photoUrl("images/products/21.webp");
  return photoUrl("vegetable-hero.png");
}

export function generatedPhotoFor(name, category = "") {
  const clean = cleanName(name);
  if (paths.has(clean)) return photoUrl(paths.get(clean));
  // Exact asset names inside expanded product names (e.g. "高麗菜 1顆").
  const matching = [...paths.keys()]
    .filter(key => clean.includes(key))
    .sort((a, b) => b.length - a.length);
  if (matching.length) return photoUrl(paths.get(matching[0]));
  for (const [pattern, canonical] of aliasRules) {
    if (pattern.test(clean) && paths.has(canonical)) {
      return photoUrl(paths.get(canonical));
    }
  }
  return fallbackPhotoFor(category);
}
