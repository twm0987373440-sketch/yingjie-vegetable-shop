import test from 'node:test';
import assert from 'node:assert/strict';
import {printedPrice, parsePrintPrice, priceListRows, isMarketPrice} from './admin-price-list.js';
import {displayPrice} from './price-utils.js';
test('print override never changes storefront price and applies to newly added products',()=>{
 const p={id:'new',name:'高麗菜',unit:'斤',price:0,priceLabel:'時價',printPrice:35,active:true};
 assert.equal(displayPrice(p),'時價'); assert.equal(printedPrice(p),'NT$35');
 assert.equal(priceListRows([p]).find(r=>r.name).price,'NT$35');
 assert.equal(printedPrice({...p,printPrice:0}),'NT$0');
 for(const printPrice of [null,undefined,-1,Infinity,'35']) assert.equal(printedPrice({...p,printPrice}),'時價');
 assert.equal(printedPrice({...p,price:45,priceLabel:''}),'NT$45');
 assert.equal(printedPrice({...p,priceLabel:'依重量計價'}),'依重量計價');
 assert.equal(isMarketPrice({...p,priceLabel:' 時價 '}),true);
 assert.deepEqual(priceListRows([{...p,active:false},{...p,bundle3for50:true}]),[]);
});
test('print price accepts blank resets and finite monetary amounts only',()=>{
 assert.equal(parsePrintPrice(' '),null);
 for(const v of ['0','35.50','100000']) assert.equal(parsePrintPrice(v),Number(v));
 for(const v of ['時價','-1','100001','1.234','Infinity','1e3']) assert.throws(()=>parsePrintPrice(v));
});
