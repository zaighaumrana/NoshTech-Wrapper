export const rupees = (value) => `Rs. ${Number(value || 0).toLocaleString('en-PK')}`;
export const lineTotal = (item) => Number(item.unit_price) * Number(item.quantity);
export const orderTotal = (order) => (order.order_items || []).reduce((sum, item) => sum + lineTotal(item), 0);
export const totalQuantity = (order) => (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
export const datePK = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(date));
  const get = (key) => parts.find(p => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export const dayOffset = (n) => {
  // Use Pakistan-local date, avoiding UTC midnight drift in date filters.
  const [y,m,d] = datePK(new Date()).split('-').map(Number);
  const start = new Date(Date.UTC(y, m-1, d+n, 12, 0, 0));
  return start.toISOString().slice(0, 10);
};
export function summarize(orders, {start, end, query = ''} = {}) {
  const needle = query.trim().toLowerCase();
  const paid = orders.filter(o => {
    if (!o.paid_at || o.status === 'cancelled') return false;
    const date = datePK(o.paid_at);
    return (!start || date >= start) && (!end || date <= end) &&
      (!needle || String(o.id).includes(needle) || String(o.table_number).includes(needle) ||
        (o.order_items || []).some(i => `${i.item_name} ${i.variant_name}`.toLowerCase().includes(needle)));
  });
  const byProduct = new Map();
  const byVariant = new Map();
  for (const order of paid) for (const item of (order.order_items || [])) {
    const k = item.item_name, v = `${item.item_name} • ${item.variant_name}`;
    const p = byProduct.get(k) || {name:k, quantity:0, sales:0};
    p.quantity += Number(item.quantity); p.sales += lineTotal(item); byProduct.set(k,p);
    const row = byVariant.get(v) || {name:v, quantity:0, sales:0};
    row.quantity += Number(item.quantity); row.sales += lineTotal(item); byVariant.set(v,row);
  }
  return {orders:paid, revenue:paid.reduce((s,o)=>s+orderTotal(o),0),
    plates:paid.reduce((s,o)=>s+totalQuantity(o),0),
    products:[...byProduct.values()].sort((a,b)=>b.quantity-a.quantity),
    variants:[...byVariant.values()].sort((a,b)=>b.quantity-a.quantity)};
}
export const statusText = {pending_counter:'Awaiting counter',kitchen_queued:'Kitchen queue',preparing:'Preparing',ready:'Ready to serve',served:'Served',cancelled:'Cancelled'};
