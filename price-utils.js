// Text prices are excluded from estimates. Keep numeric order prices compatible
// with the existing Worker, and retain the weighing instruction in the saved name.
export const WEIGHED_PREFIX = "【櫃檯秤重】";
export function parsePriceInput(value) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 30) throw Error("請輸入價格或30字以內的計價說明。");
  if (/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) {
    const price = Number(text);
    if (price > 100000) throw Error("數字價格須為0～100000元，最多兩位小數。");
    return {price, priceLabel: ""};
  }
  if (/^[\d\s.,+\-eE]+$/.test(text) || !Number.isNaN(Number(text))) throw Error("數字價格須為0～100000元，最多兩位小數。");
  return {price: 0, priceLabel: text};
}
export function isWeighedProduct(p) { return typeof p?.priceLabel === "string" && !!p.priceLabel.trim(); }
export function productPriceInput(p) { return isWeighedProduct(p) ? p.priceLabel : String(p.price ?? 0); }
export function displayPrice(p) { return isWeighedProduct(p) ? p.priceLabel : "NT$" + Number(p.price || 0).toLocaleString("zh-TW"); }
export function orderItemName(p) { return isWeighedProduct(p) ? WEIGHED_PREFIX + p.name + "（" + p.priceLabel + "）" : p.name; }
export function isWeighedOrderItem(item) { return String(item?.name || "").startsWith(WEIGHED_PREFIX); }
