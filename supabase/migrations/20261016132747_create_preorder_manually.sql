-- A pre-order taken by staff, as one transaction.
--
-- createPreorderManually() used to insert the order and then its lines as two requests, with a
-- compensating delete if the second failed. If the action died between them, or the delete itself
-- failed, a confirmed order with no dishes stayed on the staff board (Codex thread on #129, #115).
-- A function body is one transaction: the order and every line commit together or not at all.
--
-- SECURITY INVOKER on purpose: the caller is the signed-in staff member, so the "staff all"
-- policies on preorders and preorder_lines still decide whether the inserts are allowed. Line
-- name, unit and price are snapshotted from menu_items as request_preorder() does it, pack sizes
-- are not enforced, and the preparation is kept only for a basket with an empanada (category slug
-- 'empanadas'), as in 20261016050509.

create or replace function public.create_preorder_manually(
  p_name text,
  p_phone text,
  p_pickup_date date,
  p_pickup_time time,
  p_notes text,
  p_preparation text,
  p_lines jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_preparation text := nullif(trim(coalesce(p_preparation, '')), '');
  has_empanadas boolean;
  line jsonb;
  item record;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;
  if v_preparation is not null and v_preparation not in ('fresh', 'frozen') then
    v_preparation := null;
  end if;

  select exists (
    select 1
    from public.menu_items mi
    join public.menu_categories c on c.id = mi.category_id
    where c.slug = 'empanadas'
      and mi.id in (select (l->>'item_id')::uuid from jsonb_array_elements(p_lines) l)
  ) into has_empanadas;
  if not has_empanadas then
    v_preparation := null;
  end if;

  insert into public.preorders (name, phone, pickup_date, pickup_time, notes, preparation, status, source)
  values (p_name, p_phone, p_pickup_date, p_pickup_time, nullif(p_notes, ''), v_preparation, 'confirmed', 'staff')
  returning id into v_id;

  for line in select * from jsonb_array_elements(p_lines) loop
    select id, name, preorder_unit, price_label into item
    from public.menu_items where id = (line->>'item_id')::uuid;
    if not found then
      raise exception 'item_unavailable' using errcode = 'P0001';
    end if;
    insert into public.preorder_lines (preorder_id, menu_item_id, label, unit_label, price_label, quantity)
    values (v_id, item.id, item.name, item.preorder_unit, item.price_label, (line->>'quantity')::int);
  end loop;

  return v_id;
end $$;

revoke execute on function public.create_preorder_manually(text, text, date, time, text, text, jsonb) from public, anon;
grant  execute on function public.create_preorder_manually(text, text, date, time, text, text, jsonb) to authenticated;
