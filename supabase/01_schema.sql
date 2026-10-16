-- NoshTech restaurant demo. Run once in a NEW Supabase project > SQL Editor.
-- Staff log in with email/password via Supabase Auth. Only authenticated users can read data.
-- Safe to rerun menu seeds but not intended as an upgrade migration for an existing schema.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Staff member',
  role text not null default 'waiter' check (role in ('owner','waiter','counter','kitchen')),
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category text not null,
  image_path text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);
create table if not exists public.menu_variants (
  id text primary key,
  menu_item_id text not null references public.menu_items(id),
  label text not null,
  price numeric(12,2) not null check(price >= 0),
  sort_order integer not null default 0,
  unique(menu_item_id,label)
);
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  table_number integer not null check(table_number between 1 and 30),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'pending_counter' check (status in ('pending_counter','kitchen_queued','preparing','ready','served','cancelled')),
  approved_at timestamptz,
  paid_at timestamptz
);
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  menu_item_id text not null references public.menu_items(id),
  variant_id text not null references public.menu_variants(id),
  item_name text not null,
  variant_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20)
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_paid_at_idx on public.orders(paid_at) where paid_at is not null;
create index if not exists order_items_order_idx on public.order_items(order_id);

-- The function is not exposed through the public Data API. It reads the server-side
-- profiles row, never client-editable user_metadata.
create or replace function private.current_role()
returns text language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;
revoke all on function private.current_role() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;

-- Every newly created email/password Auth user gets a basic waiter profile.
-- Owner can later assign one of three staff roles in the application.
create or replace function private.make_staff_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id,display_name,role)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(new.email,'@',1),'Staff member'), 'waiter');
  return new;
end $$;
revoke all on function private.make_staff_profile() from public, anon, authenticated;
drop trigger if exists on_noshtech_user_created on auth.users;
create trigger on_noshtech_user_created after insert on auth.users
for each row execute function private.make_staff_profile();
-- Covers users created before you ran this script.
insert into public.profiles(id,display_name)
select id, coalesce(split_part(email,'@',1),'Staff member') from auth.users
on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Clients can SELECT only. Transactions are made through the validated RPC functions.
revoke all on public.profiles,public.menu_items,public.menu_variants,public.orders,public.order_items from anon, authenticated;
grant select on public.profiles,public.menu_items,public.menu_variants,public.orders,public.order_items to authenticated;
grant update (display_name,role) on public.profiles to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'owner');
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
using ((select private.current_role()) = 'owner' and id <> (select auth.uid()))
with check ((select private.current_role()) = 'owner' and role in ('waiter','counter','kitchen') and id <> (select auth.uid()));

drop policy if exists menu_read on public.menu_items;
create policy menu_read on public.menu_items for select to authenticated using (active = true);
drop policy if exists variants_read on public.menu_variants;
create policy variants_read on public.menu_variants for select to authenticated
using (exists(select 1 from public.menu_items m where m.id = menu_item_id and m.active));

drop policy if exists orders_read_by_role on public.orders;
create policy orders_read_by_role on public.orders for select to authenticated
using (
  ((select private.current_role()) in ('owner','counter'))
  or (created_by = (select auth.uid()) and (select private.current_role()) = 'waiter')
  or ((select private.current_role()) = 'kitchen' and status in ('kitchen_queued','preparing','ready','served'))
);
drop policy if exists order_items_read_by_role on public.order_items;
create policy order_items_read_by_role on public.order_items for select to authenticated
using (exists(select 1 from public.orders o where o.id = order_id));

-- Inserts a complete order and authentic price snapshots inside ONE database transaction.
-- The caller cannot supply their own unit price or skip counter approval.
create or replace function public.place_order(p_table_number integer,p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_order_id bigint;
  v_expected integer;
  v_valid integer;
begin
  if (select private.current_role()) is distinct from 'waiter' then
    raise exception 'Only waiters can submit an order';
  end if;
  if p_table_number is null or p_table_number not between 1 and 30 then
    raise exception 'Invalid table number';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array';
  end if;
  v_expected := jsonb_array_length(p_items);
  if v_expected < 1 or v_expected > 40 then raise exception 'Order must have 1–40 lines'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'qty') is distinct from 'number'
      or coalesce(e->>'qty','') !~ '^[1-9][0-9]?$'
      or (e->>'qty')::integer > 20
      or nullif(e->>'variant_id','') is null
  ) then raise exception 'Invalid order item or quantity'; end if;

  select count(*) into v_valid
  from jsonb_array_elements(p_items) e
  join public.menu_variants v on v.id=e->>'variant_id'
  join public.menu_items m on m.id=v.menu_item_id and m.active;
  if v_valid <> v_expected then raise exception 'Unknown or inactive menu variant'; end if;

  insert into public.orders(table_number,created_by,status)
    values(p_table_number,(select auth.uid()),'pending_counter') returning id into v_order_id;
  insert into public.order_items(order_id,menu_item_id,variant_id,item_name,variant_name,unit_price,quantity)
    select v_order_id,m.id,v.id,m.name,v.label,v.price,(e->>'qty')::integer
    from jsonb_array_elements(p_items) e
    join public.menu_variants v on v.id=e->>'variant_id'
    join public.menu_items m on m.id=v.menu_item_id and m.active;
  return v_order_id;
end $$;

-- Allowed state transitions are enforced at the database, not just by hiding buttons.
create or replace function public.advance_order(p_order_id bigint,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
 v_role text := (select private.current_role());
 v_count integer;
begin
  if p_action = 'approve' and v_role in ('owner','counter') then
    update public.orders set status='kitchen_queued', approved_at=now()
    where id=p_order_id and status='pending_counter';
  elsif p_action = 'cancel' and v_role in ('owner','counter') then
    update public.orders set status='cancelled' where id=p_order_id and status='pending_counter';
  elsif p_action = 'prepare' and v_role = 'kitchen' then
    update public.orders set status='preparing' where id=p_order_id and status='kitchen_queued';
  elsif p_action = 'ready' and v_role = 'kitchen' then
    update public.orders set status='ready' where id=p_order_id and status='preparing';
  elsif p_action = 'serve' and v_role = 'waiter' then
    update public.orders set status='served' where id=p_order_id
      and status='ready' and created_by=(select auth.uid());
  elsif p_action = 'pay' and v_role in ('owner','counter') then
    update public.orders set paid_at=now() where id=p_order_id
      and approved_at is not null and status <> 'cancelled' and paid_at is null;
  else
    raise exception 'Role is not permitted to perform this action';
  end if;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Order is no longer in the required state. Refresh and retry.'; end if;
end $$;
revoke all on function public.place_order(integer,jsonb) from public, anon;
revoke all on function public.advance_order(bigint,text) from public, anon;
grant execute on function public.place_order(integer,jsonb) to authenticated;
grant execute on function public.advance_order(bigint,text) to authenticated;

-- Existing six NoshTech dishes, portions and prices.
insert into public.menu_items(id,name,category,image_path,sort_order) values
('dal-chawal','Dal Chawal Plate','Meals','dal-chawal.jpg',1),
('dal','Dal','Meals','dal.jpg',2),
('anda','Anda','Sides','anda.jpg',3),
('shami','Shami','Sides','shami.jpg',4),
('water','Water','Drinks','water.jpg',5),
('cold-drinks','Cold Drinks','Drinks','cold-drinks.jpg',6)
on conflict(id) do update set name=excluded.name,category=excluded.category,image_path=excluded.image_path,sort_order=excluded.sort_order;
insert into public.menu_variants(id,menu_item_id,label,price,sort_order) values
('dal-chawal-single','dal-chawal','Single',150,1),
('dal-chawal-full','dal-chawal','Full',200,2),
('dal-chawal-special','dal-chawal','Special (Anda Shami)',350,3),
('dal-single','dal','Single',120,1),
('dal-full','dal','Full',180,2),
('anda-regular','anda','Regular',80,1),
('shami-regular','shami','Regular',90,1),
('water-500','water','500 ml',70,1),
('water-1500','water','1.5 L',100,2),
('cold-250','cold-drinks','250 ml',80,1),
('cold-nr300','cold-drinks','NR 300 ml',100,2),
('cold-1000','cold-drinks','1 Liter',170,3),
('cold-1500','cold-drinks','1.5 Liter',200,4)
on conflict(id) do update set label=excluded.label,price=excluded.price,sort_order=excluded.sort_order;

-- Enables push refresh across waiter, counter and kitchen devices.
-- Polling every 10 seconds is also enabled in the client as a fallback.
do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
 end if;
end $$;
