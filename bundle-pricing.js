import { isWeighedProduct } from "./price-utils.js?v=20261007-weight";
// Participation is opt-in; existing products are excluded until the merchant selects them.
export function isBundleProduct(product) {
  const unit = String(product?.unit || "").replace(/\s/g, "");
  return !isWeighedProduct(product) && product?.bundle3for50 === true && product?.active !== false && Number(product?.price) === 20
    && ["包", "1包", "１包", "每包", "/包", "／包"].includes(unit);
}

export function priceCart(items) {
  let subtotal = 0;
  let bundleQty = 0;
  for (const { p, qty } of items) {
    if (!Number.isSafeInteger(qty) || qty <= 0) continue;
    if (isWeighedProduct(p)) continue;
    subtotal += Number(p.price) * qty;
    if (isBundleProduct(p)) bundleQty += qty;
  }
  const discount = Math.floor(bundleQty / 3) * 10;
  return { subtotal, bundleQty, discount, total: subtotal - discount };
}

