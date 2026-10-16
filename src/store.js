export const MENU = [
  {id:'dal-chawal',name:'Dal Chawal Plate',category:'Meals',icon:'🍛',color:'#f0e4cf',description:'Comfort in every spoonful',variants:[['Single',150],['Full',200],['Special (Anda Shami)',350]]},
  {id:'dal',name:'Dal',category:'Meals',icon:'🥘',color:'#f5e6ba',description:'Slow cooked, perfectly spiced',variants:[['Single',120],['Full',180]]},
  {id:'anda',name:'Anda',category:'Sides',icon:'🍳',color:'#e7eadd',description:'A little extra goodness',variants:[['Regular',80]]},
  {id:'shami',name:'Shami',category:'Sides',icon:'🧆',color:'#e7dace',description:'Golden, crisp & full of flavor',variants:[['Regular',90]]},
  {id:'water',name:'Water',category:'Drinks',icon:'💧',color:'#dcebee',description:'Freshen up your meal',variants:[['500 ml',70],['1.5 L',100]]},
  {id:'cold-drinks',name:'Cold Drinks',category:'Drinks',icon:'🥤',color:'#eeded8',description:'Chilled & ready to enjoy',variants:[['250 ml',80],['NR 300 ml',100],['1 Liter',170],['1.5 Liter',200]]}
];
export const KEY='noshtech-demo-v1';
export const empty=()=>({orders:[],next:1001});
export const total=o=>o.batches.flatMap(b=>b.items).reduce((n,i)=>n+i.price*i.qty,0);
export const lines=o=>{const grouped={};for(const i of o.batches.flatMap(b=>b.items)){const key=i.id+'|'+i.variant;grouped[key]=grouped[key]?{...grouped[key],qty:grouped[key].qty+i.qty}:{...i};}return Object.values(grouped);};
export const kitchenStatus=o=>o.batches.every(b=>b.status==='Ready')?'Ready':o.batches.some(b=>b.status==='Preparing')?'Preparing':'Pending';
export function transition(state,action){
 const s=structuredClone(state),now=action.now||new Date().toISOString();
 if(action.type==='place'){
  const items=action.items.filter(i=>i.qty>0);if(!items.length)return state;
  const existing=s.orders.find(o=>o.type==='Dine-in'&&o.table===action.table&&!o.closed);
  if(action.orderType==='Dine-in'&&existing){if(existing.billing)return state;existing.batches.push({id:existing.batches.length+1,items,status:'Pending',served:false,created:now});}
  else s.orders.push({id:s.next++,type:action.orderType,table:action.orderType==='Dine-in'?action.table:null,created:now,billing:action.orderType==='Takeaway',paid:false,closed:false,batches:[{id:1,items,status:'Pending',served:false,created:now}]});
  return s;
 }
 const o=s.orders.find(o=>o.id===action.id);if(!o)return state;
 if(action.type==='advance'){const b=o.batches.find(b=>b.id===action.batch);if(b)b.status=b.status==='Pending'?'Preparing':'Ready';}
 if(action.type==='serve')o.batches.filter(b=>b.status==='Ready').forEach(b=>b.served=true);
 if(action.type==='bill'&&o.type==='Dine-in')o.billing=true;
 if(action.type==='pay'&&o.billing&&!o.paid){o.paid=true;o.paidAt=now;if(o.type==='Dine-in')o.closed=true;}
 if(action.type==='handover'&&o.type==='Takeaway'&&o.paid&&kitchenStatus(o)==='Ready')o.closed=true;
 return s;
}
export function analytics(state,date=new Date()){
 const paid=state.orders.filter(o=>o.paid&&new Date(o.paidAt).toDateString()===date.toDateString());
 const quantities=MENU.flatMap(m=>m.variants.map(([variant])=>({id:m.id,name:m.name,variant,qty:paid.flatMap(lines).filter(i=>i.id===m.id&&i.variant===variant).reduce((n,i)=>n+i.qty,0)})));
 const products=MENU.map(m=>({...m,qty:quantities.filter(i=>i.id===m.id).reduce((n,i)=>n+i.qty,0),sales:paid.flatMap(lines).filter(i=>i.id===m.id).reduce((n,i)=>n+i.price*i.qty,0)}));
 return {paid,sales:paid.reduce((n,o)=>n+total(o),0),dine:paid.filter(o=>o.type==='Dine-in').reduce((n,o)=>n+total(o),0),takeaway:paid.filter(o=>o.type==='Takeaway').reduce((n,o)=>n+total(o),0),quantities,products};
}
