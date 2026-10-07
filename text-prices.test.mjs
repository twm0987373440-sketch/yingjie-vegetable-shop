import test from "node:test";
import assert from "node:assert/strict";
import {parsePriceInput, productPriceInput, displayPrice, orderItemName, isWeighedOrderItem} from "./price-utils.js";
import {priceCart, isBundleProduct} from "./bundle-pricing.js";
import {cartProduct, reconcileCart} from "./shop-utils.js";
import {validateOrder} from "./worker/order-service.mjs";

const weighed = {id:"w", name:"高麗菜", unit:"斤", ...parsePriceInput("依重量計價")};
const numeric = {id:"n", name:"紅蘿蔔", unit:"條", price:35};
const bundle = {id:"b", name:"青江菜", unit:"包", price:20, bundle3for50:true};
test("numeric and text price inputs round-trip and can switch back", () => {
  for(const value of ["0", "35", "35.50", ".50", "100000"]) {
    const p = parsePriceInput(value);
    assert.equal(p.price, Number(value)); assert.equal(p.priceLabel, "");
  }
  for(const value of ["時價", "依重量計價", "每斤35元"]) {
    const p = parsePriceInput(value);
    assert.equal(p.price, 0); assert.equal(productPriceInput(p), value);
    assert.equal(displayPrice(p), value);
  }
  const p = {...weighed, ...parsePriceInput("45")};
  assert.equal(p.priceLabel, ""); assert.equal(productPriceInput(p), "45");
  for(const value of ["", " ", "-1", "1.234", "100001", "Infinity", "1e3", "x".repeat(31)]) assert.throws(()=>parsePriceInput(value));
});
test("text prices excluded from mixed and all-weighed estimates and promotions", () => {
  assert.deepEqual(priceCart([{p:weighed,qty:2},{p:numeric,qty:2},{p:bundle,qty:3}]), {subtotal:130,bundleQty:3,discount:10,total:120});
  assert.equal(priceCart([{p:weighed,qty:4}]).total, 0);
  assert.equal(isBundleProduct({...bundle,priceLabel:"時價"}), false);
  assert.equal(priceCart([{p:{...bundle,priceLabel:"時價"},qty:3}]).discount, 0);
  assert.equal(priceCart([{p:bundle,qty:6}]).total, 100);
});
test("cart persists text label and reconciles price changes", () => {
  const cart = JSON.parse(JSON.stringify({w:{p:cartProduct(weighed),qty:2}}));
  assert.equal(reconcileCart(cart).w.p.priceLabel, "依重量計價");
  const updated = reconcileCart(cart,[{...weighed,...parsePriceInput("50")}]);
  assert.equal(priceCart(Object.values(updated)).total, 100);
  assert.equal(updated.w.p.priceLabel, "");
  assert.deepEqual(reconcileCart(cart,[{...weighed,active:false}]), {});
});
test("existing Worker accepts zero estimates and retains explicit weighing instructions", () => {
  for(const cart of [[{p:weighed,qty:2}], [{p:weighed,qty:2},{p:numeric,qty:2},{p:bundle,qty:3}]]) {
    const priced = priceCart(cart);
    const order = {customerName:"測試", customerPhone:"0900000000",note:"",...priced,
      items:cart.map(({p,qty})=>({name:orderItemName(p),unit:p.unit,price:p.price,qty}))};
    const saved = validateOrder({requestId:"12345678-1234-4123-8123-123456789012",order});
    assert.equal(saved.total, priced.total);
    assert.equal(saved.items[0].name, "【櫃檯秤重】高麗菜（依重量計價）");
    assert.equal(isWeighedOrderItem(saved.items[0]), true);
    assert.equal(isWeighedOrderItem({name:"免費贈品",price:0}), false);
  }
});
