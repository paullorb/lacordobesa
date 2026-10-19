-- A SQL NULL basket is an empty basket.
--
-- create_preorder_manually() guarded its basket with
--   if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0
-- and a caller passing p_lines => null makes both operands SQL NULL, so the condition is NULL,
-- the IF body never runs, and the function commits a 'confirmed' preorder with no dishes: the
-- one state it exists to prevent (Codex thread on #138). `p_lines is null` first, explicitly.
--
-- The rest of the body is 20261016132747 unchanged; the whole function is restated because that
-- is the only way to change one line of it.


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
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
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
