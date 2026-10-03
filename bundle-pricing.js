// Price-based membership keeps the offer in sync with the existing product editor.
export function isBundleProduct(product) {
  const unit = String(product?.unit || "").replace(/\s/g, "");
  return product?.active !== false && Number(product?.price) === 20
    && ["包", "1包", "１包", "每包", "/包", "／包"].includes(unit);
}

export function priceCart(items) {
  let subtotal = 0;
  let bundleQty = 0;
  for (const { p, qty } of items) {
    if (!Number.isSafeInteger(qty) || qty <= 0) continue;
    subtotal += Number(p.price) * qty;
    if (isBundleProduct(p)) bundleQty += qty;
  }
  const discount = Math.floor(bundleQty / 3) * 10;
  return { subtotal, bundleQty, discount, total: subtotal - discount };
}
