import React from 'react';
import {MENU, total} from './store';

export function waiterStatus(order) {
  if (order.batches.some(b => b.status === 'Ready' && !b.served)) return 'Ready to serve';
  if (order.billing) return 'Billing requested';
  if (order.batches.every(b => b.served)) return 'Served';
  if (order.batches.some(b => b.status === 'Preparing' && !b.served)) return 'Preparing';
  return 'Pending';
}

export default function OpenOrders({orders, selectedTable, selectTable, serve, Thumbnail, Badge}) {
  const dineIn = orders.filter(o => o.type === 'Dine-in');
  const ready = dineIn.filter(o => o.batches.some(b => b.status === 'Ready' && !b.served)).length;
  return <section className="open-orders" aria-label="Open table orders">
    <div className="open-orders-heading">
      <div><h2>Open orders <span className="count-label">{dineIn.length}</span></h2><p>Every table’s progress, at a glance.</p></div>
      {ready > 0 && <span className="ready-count" role="status">● {ready} {ready === 1 ? 'table' : 'tables'} ready to serve</span>}
    </div>
    {!dineIn.length ? <p className="open-orders-empty">No open orders yet. Send a table’s order to the kitchen to see its progress here.</p> :
      <div className="open-orders-grid">{[...dineIn].sort((a,b) => Number(waiterStatus(b) === 'Ready to serve') - Number(waiterStatus(a) === 'Ready to serve') || a.table-b.table).map(order => {
        const status = waiterStatus(order);
        const readyBatches = order.batches.filter(b => b.status === 'Ready' && !b.served);
        const pending = order.batches.filter(b => !b.served && b.status !== 'Ready');
        const items = order.batches.flatMap(b => b.items);
        const products = MENU.filter(m => items.some(i => i.id === m.id));
        return <article key={order.id} className={`open-order-card ${status === 'Ready to serve' ? 'food-ready' : ''} ${selectedTable === order.table ? 'selected-table' : ''}`}>
          <button className="open-order-select" onClick={() => selectTable(order.table)} aria-label={`Open Table ${String(order.table).padStart(2,'0')}, ${status}`}>
            <div className="open-order-title"><strong>Table {String(order.table).padStart(2,'0')}</strong><Badge>{status}</Badge></div>
            <span className="open-order-detail">#{order.id} · {items.reduce((n,i) => n+i.qty,0)} items · Rs. {total(order).toLocaleString('en-PK')}</span>
            <div className="order-thumbnails">{products.slice(0,4).map(m => <Thumbnail key={m.id} item={m} small/>)}{products.length > 4 && <span>+{products.length-4}</span>}</div>
            <span className="open-order-progress">{readyBatches.length ? `${readyBatches.length} ${readyBatches.length === 1 ? 'batch' : 'batches'} ready${pending.length ? ` · ${pending.length} still in kitchen` : ''}` : status === 'Served' ? 'All food served · ordering open' : status === 'Billing requested' ? 'Waiting for payment at the counter' : `${pending.length} ${pending.length === 1 ? 'batch' : 'batches'} in the kitchen`}</span>
          </button>
          {readyBatches.length > 0 && <button className="serve-from-card" onClick={() => serve(order.id)}>✓ Mark ready food served</button>}
        </article>;
      })}</div>}
  </section>;
}
