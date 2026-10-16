import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty, transition} from './store.js';
import {orderNotifications} from './notifications.js';

const items = [{id:'dal',name:'Dal',variant:'Full',price:180,qty:1}];
const place = (state, orderType='Dine-in') => transition(state,{type:'place',orderType,table:5,items});

test('kitchen receives new tickets, including additional batches, without replaying old ones',()=>{
  const initial=empty(), first=place(initial), additional=place(first);
  assert.deepEqual(orderNotifications(initial,first,'Kitchen'),['Table 05 · new kitchen ticket']);
  assert.deepEqual(orderNotifications(first,additional,'Kitchen'),['Table 05 · new kitchen ticket']);
  assert.deepEqual(orderNotifications(additional,additional,'Kitchen'),[]);
  assert.deepEqual(orderNotifications(initial,first,'Waiter'),[]);
  assert.deepEqual(orderNotifications(first,empty(),'Kitchen'),[]);
});

test('waiter sees preparation updates for dine-in, even with other batches pending',()=>{
  const initial=place(empty());
  const preparing=transition(initial,{type:'advance',id:1001,batch:1});
  assert.deepEqual(orderNotifications(initial,preparing,'Waiter'),['Table 05 · preparing']);
  const additional=place(preparing);
  const ready=transition(additional,{type:'advance',id:1001,batch:1});
  assert.equal(ready.orders[0].batches[1].status,'Pending');
  assert.deepEqual(orderNotifications(additional,ready,'Waiter'),['Table 05 · ready to serve']);
  const served=transition(ready,{type:'serve',id:1001});
  assert.deepEqual(orderNotifications(ready,served,'Waiter'),[]);
  assert.deepEqual(orderNotifications(additional,ready,'POS'),[]);
});

test('takeaway updates notify the kitchen without alerting the waiter',()=>{
  const initial=place(empty(),'Takeaway');
  const preparing=transition(initial,{type:'advance',id:1001,batch:1});
  const ready=transition(preparing,{type:'advance',id:1001,batch:1});
  assert.deepEqual(orderNotifications(preparing,ready,'Waiter'),[]);
  assert.deepEqual(orderNotifications(preparing,ready,'Kitchen'),['Takeaway #1001 · ready for handover']);
});
