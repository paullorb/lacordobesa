-- One statement per reorder, instead of one UPDATE per moved row.
--
-- arrangeMenuItems/arrangeCategories read the current order and then fired an update per changed
-- row through Promise.all. Any one of those failing, or two people dragging at once, committed
-- part of the new order and left the rest: duplicate or mixed sort_order values, and returning an
-- error rolled none of it back. A single UPDATE is atomic, and the ordering comes from the array
-- the caller sent rather than from a round trip that could be stale by the time it is used.
--
-- SECURITY INVOKER: the "staff update" policies from 20261012074936 still apply, so this grants
-- nothing the caller did not already have. The is_staff() check is only so a non-staff caller gets
-- an error instead of a silent "0 rows changed", which the action would otherwise report as success.

create or replace function public.arrange_menu_items(p_category uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  moved integer;
begin
  if not public.is_staff() then
    raise exception 'not staff' using errcode = '42501';
  end if;

  -- `with ordinality` is 1-based, which is the numbering the staff pages already write.
  -- `is distinct from` keeps untouched rows out of the write set, so updated_at and the
  -- replication stream only see dishes that actually moved.
  update public.menu_items m
     set category_id = p_category,
         sort_order = o.ord::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where m.id = o.id
     and (m.category_id is distinct from p_category or m.sort_order is distinct from o.ord::int);

  get diagnostics moved = row_count;
  return moved;
end;
$$;

create or replace function public.arrange_menu_categories(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  moved integer;
begin
  if not public.is_staff() then
    raise exception 'not staff' using errcode = '42501';
  end if;

  update public.menu_categories c
     set sort_order = o.ord::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id
     and c.sort_order is distinct from o.ord::int;

  get diagnostics moved = row_count;
  return moved;
end;
$$;

-- Nothing anonymous reorders a menu. `from public` alone is not enough: Supabase's default
-- privileges grant EXECUTE on a new function in this schema to anon as well, and anon is not a
-- member of PUBLIC's grant, so it has to be named. Same reasoning as 20261014072715.
revoke execute on function public.arrange_menu_items(uuid, uuid[]) from public, anon;
revoke execute on function public.arrange_menu_categories(uuid[]) from public, anon;
grant execute on function public.arrange_menu_items(uuid, uuid[]) to authenticated;
grant execute on function public.arrange_menu_categories(uuid[]) to authenticated;

-- The is_staff() guard inside each function already refuses a visitor, and the staff RLS policies
-- refuse them again. This fails the migration rather than relying on either, the way the form RPCs
-- are checked.
do $$
declare leaked text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('arrange_menu_items', 'arrange_menu_categories')
    and has_function_privilege('anon', p.oid, 'execute');
  if leaked is not null then
    raise exception 'reorder RPCs still callable with the publishable key: %', leaked;
  end if;
end $$;
