import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTotal, summarize, datePK, dayOffset} from './domain.js';
test('total and filtered paid revenue excludes unpaid orders', () => {
  const paidAt = '2026-10-16T22:00:00Z'; // 17 October in Pakistan
  const items = [{item_name:'Dal Chawal Plate',variant_name:'Full',unit_price:200,quantity:2}];
  const orders = [{id:1,table_number:2,status:'served',paid_at:paidAt,order_items:items},
                  {id:2,table_number:3,status:'preparing',paid_at:null,order_items:items}];
  assert.equal(orderTotal(orders[0]),400);
  assert.equal(datePK(paidAt),'2026-10-17');
  const report = summarize(orders,{start:'2026-10-17',end:'2026-10-17'});
  assert.equal(report.revenue,400);
  assert.equal(report.plates,2);
  assert.equal(report.products[0].quantity,2);
  assert.equal(summarize(orders,{start:'2026-10-18'}).revenue,0);
  assert.equal(summarize(orders,{query:'water'}).revenue,0);
});
test('day offsets produce valid date strings',()=>assert.match(dayOffset(-6),/^\d{4}-\d{2}-\d{2}$/));
