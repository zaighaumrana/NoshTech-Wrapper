-- Apply once to the EXISTING project in Supabase SQL Editor before deploying the UI.
-- NULL table_number identifies a takeaway; existing table numbers and RPCs stay intact.
begin;
alter table public.orders alter column table_number drop not null;

create or replace function public.place_takeaway_order(p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_order_id bigint;
  v_expected integer;
  v_valid integer;
begin
  if (select auth.uid()) is null or coalesce((select private.current_role()),'') not in ('counter','owner') then
    raise exception 'Only the counter or owner can create a takeaway';
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
    values(null,(select auth.uid()),'pending_counter') returning id into v_order_id;
  insert into public.order_items(order_id,menu_item_id,variant_id,item_name,variant_name,unit_price,quantity)
    select v_order_id,m.id,v.id,m.name,v.label,v.price,(e->>'qty')::integer
    from jsonb_array_elements(p_items) e
    join public.menu_variants v on v.id=e->>'variant_id'
    join public.menu_items m on m.id=v.menu_item_id and m.active;
  return v_order_id;
end $$;

-- Same validated price snapshots. Payment must be recorded before kitchen submission.
revoke all on function public.place_takeaway_order(jsonb) from public, anon;
grant execute on function public.place_takeaway_order(jsonb) to authenticated;

create or replace function public.handover_takeaway(p_order_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select auth.uid()) is null or coalesce((select private.current_role()),'') not in ('counter','owner') then
    raise exception 'Only the counter or owner can hand over a takeaway';
  end if;
  update public.orders set status='served'
  where id=p_order_id and table_number is null and status='ready' and paid_at is not null;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Takeaway must be ready and paid before handover. Refresh and retry.'; end if;
end $$;
revoke all on function public.handover_takeaway(bigint) from public, anon;
grant execute on function public.handover_takeaway(bigint) to authenticated;
-- Recording payment and sending to the kitchen happen atomically in one update.
-- The existing approve RPC action is retained for compatibility with the client.
-- The pay action remains for previously approved, unpaid bills only.
create or replace function public.advance_order(p_order_id bigint,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
 v_role text := (select private.current_role());
 v_count integer;
begin
  if p_action = 'approve' and v_role in ('owner','counter') then
    update public.orders set status='kitchen_queued', approved_at=now(), paid_at=now()
    where id=p_order_id and status='pending_counter';
  elsif p_action = 'cancel' and v_role in ('owner','counter') then
    update public.orders set status='cancelled' where id=p_order_id and status='pending_counter';
  elsif p_action = 'prepare' and v_role = 'kitchen' then
    update public.orders set status='preparing' where id=p_order_id and status='kitchen_queued' and paid_at is not null;
  elsif p_action = 'ready' and v_role = 'kitchen' then
    update public.orders set status='ready' where id=p_order_id and status='preparing' and paid_at is not null;
  elsif p_action = 'serve' and v_role = 'waiter' then
    update public.orders set status='served' where id=p_order_id
      and status='ready' and paid_at is not null and created_by=(select auth.uid());
  elsif p_action = 'pay' and v_role in ('owner','counter') then
    update public.orders set paid_at=now() where id=p_order_id
      and approved_at is not null and status <> 'cancelled' and paid_at is null;
  else
    raise exception 'Role is not permitted to perform this action';
  end if;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Order is no longer in the required state. Refresh and retry.'; end if;
end $$;
revoke all on function public.advance_order(bigint,text) from public, anon;
grant execute on function public.advance_order(bigint,text) to authenticated;
notify pgrst, 'reload schema';
commit;
