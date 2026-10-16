import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {configured,supabase} from './supabase';
import {rupees,orderTotal,totalQuantity,dayOffset,summarize,statusText,datePK} from './domain';
import './style.css';

const roles={owner:{name:'Owner',icon:'◈',desc:'Sales insights & team management'},waiter:{name:'Waiter',icon:'▤',desc:'Take orders and serve plates'},counter:{name:'Accounts / POS',icon:'▣',desc:'Approve orders and collect payment'},kitchen:{name:'Kitchen',icon:'♨',desc:'Prepare confirmed orders'}};
const time = value => new Date(value).toLocaleString('en-PK',{timeZone:'Asia/Karachi',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
function Chip({status,paid}) {return <span className={'chip '+(paid?'paid':status)}>{paid?'Paid':statusText[status]||status}</span>}
function Photo({item}) {const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[item.id]);return <div className="food-photo">{failed?<div className="food-fallback">🍽️</div>:<img loading="lazy" src={`${import.meta.env.BASE_URL}images/${item.image_path||item.id+'.jpg'}`} alt={item.name} onError={()=>setFailed(true)}/>}</div>}
function Banner({children,type='info'}) {return <div className={`banner ${type}`} role="status">{children}</div>}
function CardOrder({order,action,busy,role}) {
 const items=order.order_items||[],total=orderTotal(order);
 const buttons=[];
 if ((role==='counter'||role==='owner')&&order.status==='pending_counter') {
   buttons.push(['approve','✓ Approve → Kitchen','primary'],['cancel','Cancel','soft danger']);
 }
 if (role==='kitchen'&&order.status==='kitchen_queued')buttons.push(['prepare','Start preparing','primary']);
 if (role==='kitchen'&&order.status==='preparing')buttons.push(['ready','✓ Mark ready','primary']);
 if (role==='waiter'&&order.status==='ready')buttons.push(['serve','✓ Served to table','primary']);
 if ((role==='counter'||role==='owner')&&order.approved_at&&!order.paid_at&&order.status!=='cancelled')buttons.push(['pay',`Collect ${rupees(total)}`,'primary']);
 return <article className="ticket">
  <div className="ticket-top"><div><span className="eyebrow">ORDER #{order.id}</span><h3>Table {String(order.table_number).padStart(2,'0')}</h3></div><Chip status={order.status}/></div>
  <div className="meta-line"><span>{time(order.created_at)}</span><span>{totalQuantity(order)} items</span></div>
  <div className="ticket-lines">{items.map(i=><div key={i.id} className="ticket-line"><span className="qty-dot">{i.quantity}×</span><div><strong>{i.item_name}</strong><small>{i.variant_name}</small></div><span>{rupees(i.quantity*i.unit_price)}</span></div>)}</div>
  <div className="ticket-footer"><b>{rupees(total)}</b><Chip status={order.status} paid={Boolean(order.paid_at)}/></div>
  {buttons.length>0&&<div className="ticket-actions">{buttons.map(([name,label,cls])=><button type="button" className={cls} key={name} disabled={Boolean(busy)} onClick={()=>action(order.id,name)}>{busy===`${order.id}:${name}`?'Updating…':label}</button>)}</div>}
 </article>
}
function OrderList({orders,action,busy,role,empty}) {return orders.length?<div className="ticket-grid">{orders.map(o=><CardOrder key={o.id} order={o} action={action} busy={busy} role={role}/>)}</div>:<div className="no-data"><span>✳</span><h3>All clear for now</h3><p>{empty}</p></div>}
function Login({error,login,busy}) {
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 return <main className="login-screen"><div className="login-hero"><span className="login-logo">n<span>•</span></span><span className="caps">NOSHTECH RESTAURANT WORKSPACE</span><h1>From first order<br/>to final plate.</h1><p>One connected restaurant. Four focused workspaces. Service in sync, from anywhere.</p><div className="login-steps"><span>▤ Waiter</span><span>→</span><span>▣ Counter</span><span>→</span><span>♨ Kitchen</span></div></div><div className="login-pane"><div className="login-box"><span className="eyebrow">STAFF ACCESS</span><h2>Welcome back.</h2><p>Sign in with the email and password assigned by the restaurant owner.</p>{error&&<Banner type="error">{error}</Banner>}<form onSubmit={e=>{e.preventDefault();login(email.trim(),password)}}><label>Email address<input type="email" placeholder="waiter@restaurant.com" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" placeholder="••••••••" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary full login-submit" disabled={busy}>{busy?'Signing in…':'Sign in →'}</button></form><small>Demo access only. Staff accounts are created in Supabase Authentication.</small></div></div></main>
}
function Waiter({menu,orders,place,busy}) {
 const [table,setTable]=useState(1),[cart,setCart]=useState({}),[search,setSearch]=useState(''),[category,setCategory]=useState('All');
 const cats=['All',...new Set(menu.map(m=>m.category))];
 const filtered=menu.filter(m=>(category==='All'||m.category===category)&&m.name.toLowerCase().includes(search.toLowerCase()));
 const selected=menu.flatMap(m=>(m.menu_variants||[]).map(v=>({variant:v,menu:m,qty:cart[v.id]||0}))).filter(v=>v.qty);
 const sum=selected.reduce((s,i)=>s+i.qty*i.variant.price,0);
 const own=orders.filter(o=>o.status!=='cancelled');
 const occupied=new Set(own.filter(o=>o.status!=='served'||!o.paid_at).map(o=>o.table_number));
 const submit=async()=>{const ok=await place(table,selected.map(i=>({variant_id:i.variant.id,qty:i.qty})));if(ok)setCart({});};
 return <><div className="hero-heading"><div><div className="eyebrow">DINING ROOM / ORDER DESK</div><h1>Let’s take an order.</h1><p>Select a table, add menu items and send the order to the counter for approval.</p></div><div className="micro-info">● {own.filter(o=>o.status!=='served').length} active orders</div></div>
 <section className="table-chooser"><div className="row-between"><div><h3>Choose a table</h3><p>12 demo tables · green dots show open orders</p></div><span className="eyebrow">DINE-IN</span></div><div className="table-grid">{Array.from({length:12},(_,i)=>i+1).map(n=><button type="button" key={n} className={`${table===n?'selected':''}`} onClick={()=>setTable(n)}>{String(n).padStart(2,'0')}{occupied.has(n)&&<i/>}</button>)}</div></section>
 <div className="ordering-layout"><section><div className="row-between section-title"><div><h2>Menu <span className="count-number">{menu.length}</span></h2><p>Freshly made, ready to order.</p></div><input className="menu-search" placeholder="Search dishes…" aria-label="Search dishes" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <div className="category-row">{cats.map(c=><button key={c} className={category===c?'on':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 <div className="menu-grid">{filtered.map(m=><div className="dish" key={m.id}><Photo item={m}/><div className="dish-body"><div className="dish-category">{m.category}</div><h3>{m.name}</h3><div className="variant-list">{[...(m.menu_variants||[])].sort((a,b)=>a.sort_order-b.sort_order).map(v=><div key={v.id} className="variant"><span>{v.label}<small>{rupees(v.price)}</small></span><div className="counter-stepper">{Boolean(cart[v.id])&&<button aria-label={`Remove ${v.label} ${m.name}`} onClick={()=>setCart(c=>({...c,[v.id]:Math.max(0,(c[v.id]||0)-1)}))}>−</button>}{Boolean(cart[v.id])&&<b>{cart[v.id]}</b>}<button aria-label={`Add ${v.label} ${m.name}`} onClick={()=>setCart(c=>({...c,[v.id]:Math.min(20,(c[v.id]||0)+1)}))}>+</button></div></div>)}</div></div></div>)}</div>{filtered.length===0&&<div className="no-data">No matching dishes.</div>}</section>
 <aside className="cart"><div className="cart-heading"><span className="eyebrow">NEW COUNTER REQUEST</span><h2>Table {String(table).padStart(2,'0')}</h2><p>These items won't reach the kitchen until approved at the POS counter.</p></div><div className="cart-list">{selected.length?selected.map(i=><div className="cart-row" key={i.variant.id}><div><b>{i.qty} × {i.menu.name}</b><small>{i.variant.label}</small></div><b>{rupees(i.qty*i.variant.price)}</b></div>):<div className="empty-cart">✧<h3>Your tray is empty</h3><p>Add something delicious from the menu.</p></div>}</div><div className="cart-bottom"><div className="row-between"><span>Total</span><strong>{rupees(sum)}</strong></div><button className="primary full" disabled={!selected.length||Boolean(busy)} onClick={submit}>{busy==='place'?'Sending…':'Send to counter →'}</button></div></aside></div>
 <section className="bottom-orders"><div className="section-title"><h2>My orders <span className="count-number">{own.length}</span></h2><p>Ready dishes can be marked served after the kitchen finishes.</p></div><OrderList role="waiter" orders={own} action={place.action} busy={busy} empty="Your new orders will appear here after you send them."/></section></>;
}
function Counter({orders,action,busy}) {
 const [tab,setTab]=useState('pending');
 const pending=orders.filter(o=>o.status==='pending_counter');
 const open=orders.filter(o=>o.status!=='pending_counter'&&o.status!=='cancelled'&&!o.paid_at);
 const paid=orders.filter(o=>Boolean(o.paid_at));
 const viewed=tab==='pending'?pending:tab==='open'?open:paid;
 return <><div className="hero-heading"><div><div className="eyebrow">CASH COUNTER / APPROVALS</div><h1>Every order, accounted for.</h1><p>Approve waiter orders, then collect and record payments.</p></div><div className="micro-info">● {pending.length} awaiting approval</div></div>
 <div className="metric-grid"><Metric label="Needs approval" value={pending.length} note="Not yet sent to kitchen"/><Metric label="Open unpaid bills" value={open.length} note="Kitchen approved"/><Metric label="Payments recorded" value={paid.length} note="All-time in demo"/></div>
 <div className="tab-row">{[['pending',`Needs approval (${pending.length})`],['open',`Open orders (${open.length})`],['paid',`Paid (${paid.length})`]].map(([key,label])=><button className={tab===key?'on':''} key={key} onClick={()=>setTab(key)}>{label}</button>)}</div>
 <OrderList orders={viewed} role="counter" action={action} busy={busy} empty={tab==='pending'?'Waiters have not submitted any orders for approval.':tab==='open'?'All approved orders are paid.':'No payments recorded yet.'}/></>
}
function Kitchen({orders,action,busy}) {
 const active=orders.filter(o=>['kitchen_queued','preparing','ready'].includes(o.status));
 return <><div className="hero-heading"><div><div className="eyebrow">KITCHEN DISPLAY</div><h1>On the kitchen line.</h1><p>Only counter-approved orders appear here. Mark each ticket preparing, then ready.</p></div><div className="micro-info">● Live kitchen queue</div></div>
 <div className="metric-grid"><Metric label="To start" value={active.filter(o=>o.status==='kitchen_queued').length} note="Approved and waiting"/><Metric label="In preparation" value={active.filter(o=>o.status==='preparing').length} note="Cooking now"/><Metric label="Ready" value={active.filter(o=>o.status==='ready').length} note="Waiter can serve"/></div>
 <OrderList orders={active} role="kitchen" action={action} busy={busy} empty="The counter has not approved any orders yet."/></>;
}
function Metric({label,value,note}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function Owner({orders,profiles,changeRole,busy}) {
 const [start,setStart]=useState(dayOffset(0)),[end,setEnd]=useState(dayOffset(0)),[query,setQuery]=useState(''),[tab,setTab]=useState('analytics');
 const stats=useMemo(()=>summarize(orders,{start,end,query}),[orders,start,end,query]);
 const max=Math.max(1,...stats.products.map(p=>p.sales));
 const range=n=>{setStart(dayOffset(-(n-1)));setEnd(dayOffset(0));};
 return <><div className="hero-heading"><div><div className="eyebrow">MANAGEMENT / NOSHTECH</div><h1>Your restaurant, in numbers.</h1><p>Real revenue from recorded payments, item-by-item sales, and staff access.</p></div><div className="micro-info">● Owner access</div></div>
 <div className="tab-row owner-tabs"><button className={tab==='analytics'?'on':''} onClick={()=>setTab('analytics')}>◈ Sales & analytics</button><button className={tab==='users'?'on':''} onClick={()=>setTab('users')}>♧ Team & permissions <span className="count-number">{profiles.length}</span></button></div>
 {tab==='users'?<section className="white-section"><h2>Staff accounts & roles</h2><p className="muted">Create users in Supabase Authentication, then assign each person a role here. Updates affect their next refresh or login.</p><div className="team-list">{profiles.map(p=><div className="team-member" key={p.id}><div className="team-avatar">{(p.display_name||'?').slice(0,1).toUpperCase()}</div><div className="team-detail"><b>{p.display_name||'New staff member'}</b><small>{p.id.slice(0,8)}… {p.role==='owner'?'· Owner':'· Staff'}</small></div>{p.role==='owner'?<span className="chip owner">Owner · Locked</span>:<select aria-label={`Role for ${p.display_name}`} disabled={Boolean(busy)} value={p.role} onChange={e=>changeRole(p.id,e.target.value)}><option value="waiter">Waiter</option><option value="counter">Accounts / POS</option><option value="kitchen">Kitchen</option></select>}</div>)}</div></section>:<>
 <section className="filter-bar"><div className="quick-filters">{[['Today',1],['7 days',7],['30 days',30]].map(([label,n])=><button key={label} onClick={()=>range(n)}>{label}</button>)}</div><label>From<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>To<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label className="wide-filter">Search<input placeholder="Dish, table, order ID…" value={query} onChange={e=>setQuery(e.target.value)}/></label></section>
 <div className="metric-grid four"><Metric label="Revenue collected" value={rupees(stats.revenue)} note="Paid orders only"/><Metric label="Paid orders" value={stats.orders.length} note="In selected range"/><Metric label="Items / portions sold" value={stats.plates} note="All sold quantities"/><Metric label="Average order value" value={rupees(stats.orders.length?stats.revenue/stats.orders.length:0)} note="Per paid order"/></div>
 <div className="analytics-grid"><section className="white-section"><h2>Revenue by menu item</h2><p className="muted">Revenue from paid bills within your filters.</p>{stats.products.length?stats.products.map(p=><div className="bar-item" key={p.name}><div className="row-between"><span>{p.name}</span><b>{rupees(p.sales)}</b></div><div className="bar-bg"><div style={{width:`${p.sales/max*100}%`}}/></div><small>{p.quantity} sold</small></div>):<div className="no-data">No paid sales in this range.</div>}</section>
 <section className="white-section"><h2>Portions sold</h2><p className="muted">Detailed size/variant breakdown</p><div className="portion-rows">{stats.variants.length?stats.variants.map(i=><div key={i.name}><span>{i.name}</span><strong>{i.quantity}</strong></div>):<div className="no-data">No sales to display.</div>}</div></section></div>
 <section className="white-section recent"><h2>Paid transactions</h2><div className="transaction-list"><div className="transaction header"><span>Order / table</span><span>Payment date</span><span>Amount</span></div>{stats.orders.map(o=><div className="transaction" key={o.id}><span>#{o.id} · Table {o.table_number}</span><span>{time(o.paid_at)}</span><b>{rupees(orderTotal(o))}</b></div>)}</div>{!stats.orders.length&&<p className="muted">No recorded payments in this period.</p>}</section></>}</>;
}
function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [menu,setMenu]=useState([]),[orders,setOrders]=useState([]),[profiles,setProfiles]=useState([]),[lastSync,setLastSync]=useState('');
 const fetchProfile=useCallback(async(user)=>{if(!user){setProfile(null);setLoading(false);return;}const {data,error:err}=await supabase.from('profiles').select('id,display_name,role').eq('id',user.id).single();if(err){setError(`Couldn't load your staff role: ${err.message}`);setProfile(null);}else{setError('');setProfile(data);}setLoading(false);},[]);
 useEffect(()=>{if(!configured)return;let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted)setSession(data.session);});const {data:{subscription}}=supabase.auth.onAuthStateChange((_ev,s)=>{if(mounted)setSession(s);});return()=>{mounted=false;subscription.unsubscribe();};},[]);
 useEffect(()=>{if(configured)fetchProfile(session?.user);},[session?.user?.id,fetchProfile]);
 const refresh=useCallback(async()=>{if(!profile)return;const queries=[
   supabase.from('menu_items').select('id,name,category,image_path,sort_order,menu_variants(id,label,price,sort_order)').eq('active',true).order('sort_order'),
   supabase.from('orders').select('id,table_number,status,created_at,approved_at,paid_at,created_by,order_items(id,menu_item_id,item_name,variant_name,unit_price,quantity)').order('created_at',{ascending:false}).limit(500)];
   if(profile.role==='owner')queries.push(supabase.from('profiles').select('id,display_name,role').order('display_name'));
   const [m,o,p]=await Promise.all(queries);const err=m.error||o.error||p?.error;
   if(err){setError(`Couldn't sync restaurant data: ${err.message}`);return;}setMenu(m.data||[]);setOrders(o.data||[]);if(p)setProfiles(p.data||[]);setLastSync(new Date().toLocaleTimeString('en-PK'));setError('');
 },[profile?.id,profile?.role]);
 useEffect(()=>{if(!profile)return;refresh();const channel=supabase.channel(`noshtech-${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'orders'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'profiles'},async()=>{const {data:{user}}=await supabase.auth.getUser();if(user)await fetchProfile(user);refresh();}).subscribe();const interval=setInterval(refresh,10000);const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return()=>{supabase.removeChannel(channel);clearInterval(interval);window.removeEventListener('focus',onFocus);};},[profile?.id,profile?.role,refresh,fetchProfile]);
 const login=async(email,password)=>{setBusy('login');setError('');try{const {error:e}=await supabase.auth.signInWithPassword({email,password});if(e)throw e;}catch(e){setError(e.message)}finally{setBusy('')}};
 const logout=async()=>{setBusy('logout');await supabase.auth.signOut();setSession(null);setProfile(null);setOrders([]);setProfiles([]);setBusy('')};
 const call=async(fn,args,key)=>{setBusy(key);setError('');try{const {data,error:e}=await supabase.rpc(fn,args);if(e)throw e;await refresh();return data??true;}catch(e){setError(e.message);return false;}finally{setBusy('')}};
 const action=async(id,actionName)=>{await call('advance_order',{p_order_id:id,p_action:actionName},`${id}:${actionName}`)};
 const place=async(table,items)=>Boolean(await call('place_order',{p_table_number:table,p_items:items},'place'));
 place.action=action;
 const changeRole=async(id,role)=>{if(!['waiter','counter','kitchen'].includes(role))return;setBusy('role');setError('');const {error:e}=await supabase.from('profiles').update({role}).eq('id',id);if(e)setError(e.message);else await refresh();setBusy('')};
 if(!configured)return <div className="setup-screen"><div className="setup-mark">n•</div><h1>Connect your Supabase project</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, enter your Supabase project URL and publishable key, then restart Vite. For GitHub Pages, add the same two values as repository Actions secrets.</p><pre>VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_PUBLISHABLE_KEY=...</pre><p>See <b>README.md</b> for the exact setup checklist.</p></div>;
 if(loading)return <div className="loading">Loading NoshTech…</div>;
 if(!session)return <Login error={error} login={login} busy={Boolean(busy)}/>;
 if(!profile)return <div className="setup-screen"><h1>Staff profile unavailable</h1><Banner type="error">{error||'This account is not yet assigned a staff profile.'}</Banner><button className="primary" onClick={()=>fetchProfile(session.user)}>Retry profile</button> <button className="soft" onClick={logout}>Sign out</button></div>;
 const role=roles[profile.role]||roles.waiter;
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-symbol">n<span>•</span></span><div>Nosh<span>Tech</span><small>RESTAURANT WORKSPACE</small></div></div><div className="sidebar-label">YOUR WORKSPACE</div><div className="role-nav"><div className="role-icon">{role.icon}</div><div><b>{role.name}</b><small>{role.desc}</small></div></div><div className="sidebar-spacer"/><div className="live-card"><span className="live-spark">●</span> SHARED DEMO<h3>Orders move between devices.</h3><p>Waiter → Counter → Kitchen → Owner</p></div><button className="signout" onClick={logout} disabled={Boolean(busy)}>↪ Sign out</button></aside>
 <div className="workspace"><header className="topbar"><span className="breadcrumb">NoshTech <span>/</span> {role.name}</span><div className="topbar-right"><span className="sync">● Shared via Supabase</span><span className="date-top">{lastSync&&`Synced ${lastSync}`}</span><span className="avatar">{(profile.display_name||'N').slice(0,2).toUpperCase()}</span></div></header><main className="main-content">{error&&<Banner type="error">{error} <button onClick={()=>{setError('');refresh()}}>Retry</button></Banner>}
 {profile.role==='waiter'?<Waiter menu={menu} orders={orders} place={place} busy={busy}/>:
 profile.role==='counter'?<Counter orders={orders} action={action} busy={busy}/>:
 profile.role==='kitchen'?<Kitchen orders={orders} action={action} busy={busy}/>:
 <Owner orders={orders} profiles={profiles} changeRole={changeRole} busy={busy}/>}
 <footer>© NoshTech · Connected demo · All amounts in PKR · Times in Pakistan Standard Time</footer></main></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
