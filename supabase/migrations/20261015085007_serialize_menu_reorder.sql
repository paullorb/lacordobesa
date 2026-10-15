-- Two people reordering at once could still leave a mixed order.
--
-- 20261015061507 made a reorder one UPDATE, but that UPDATE only writes rows whose position
-- differs ("is distinct from"), and it decides that from the snapshot it took when it started.
-- Take [A1,B2,C3] and two concurrent requests, [B1,A2,C3] and [A1,C2,B3]. The second one sees A as
-- already in place and leaves it out of its write set; when the first commits A2,B1 and the second
-- then waits out the row lock on B and rewrites B3,C2, the list ends as A2,C2,B3: a position held
-- twice, none held by A's request. Updating every supplied row would not be enough on its own for
-- items (they can change category), so the whole reorder is serialized instead.
--
-- pg_advisory_xact_lock is held until the RPC's transaction ends. The UPDATE below starts after the
-- lock is granted, and under READ COMMITTED each statement takes a fresh snapshot, so it sees the
-- previous reorder's committed result and works out its unchanged rows from that. One lock covers
-- both functions and every category: a menu has a handful of editors and reorders are a drag and
-- drop, so contention is not a concern, and a single key rules out a lock-order deadlock between an
-- item moving from one category to another and a category being reordered.
--
-- Everything else is as in 20261015061507, including the grants, so those are restated by
-- create or replace (which keeps them) and not repeated here.

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

  perform pg_advisory_xact_lock(hashtextextended('lacordobesa.menu_order', 0));

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

  perform pg_advisory_xact_lock(hashtextextended('lacordobesa.menu_order', 0));

  update public.menu_categories c
     set sort_order = o.ord::int
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id
     and c.sort_order is distinct from o.ord::int;

  get diagnostics moved = row_count;
  return moved;
end;
$$;
