-- Two things the owner asked for on 2026-10-16.
--
-- 1. Pre-orders in packs. Empanadas go out by the half dozen, so a guest orders 6, 12 or 18 of
--    them, never 7. preorder_step is that pack size per dish; request_preorder() refuses a
--    quantity that is not a multiple of it, because the form is only a suggestion to a script.
--    Empanadas and pizzas become pre-orderable: until now no dish was, so /vorbestellen only ever
--    showed its "call us" state.
--
-- 2. Two kinds of team account. 'admin' is the agency (whoever built and runs the site); 'staff' is
--    the restaurant. Admins see the visitor analytics and manage the team's logins; staff see
--    everything else. Every account created from the staff UI is 'staff'.

-- ---------------------------------------------------------------- 1. packs
alter table public.menu_items
  add column if not exists preorder_step int not null default 1;
alter table public.menu_items
  drop constraint if exists menu_items_preorder_step_range;
alter table public.menu_items
  add constraint menu_items_preorder_step_range check (preorder_step between 1 and 24);

-- The public view lists its columns, so it has to be recreated to carry the new one.
create or replace view public.menu_items_public with (security_invoker = false) as
 select i.id,
    i.category_id,
    i.name,
    i.subtitle,
    i.description,
    i.description_es,
    i.description_en,
        case
            when (coalesce(c.show_prices, true) or i.is_preorderable) then i.price_label
            else null::text
        end as price_label,
    i.is_available,
    i.is_featured,
    i.sort_order,
    i.is_preorderable,
    i.preorder_unit,
    i.created_at,
    i.updated_at,
    c.label as category_label,
    c.sort_order as category_sort,
    i.preorder_step
   from (public.menu_items i
     left join public.menu_categories c on ((c.id = i.category_id)))
  where i.is_available;

-- The single dishes, not the three-empanada plate or the burrata topping.
update public.menu_items i
   set is_preorderable = true, preorder_step = 6, preorder_unit = 'Stück'
  from public.menu_categories c
 where c.id = i.category_id and c.slug = 'empanadas' and i.name ilike 'Empanada %';
update public.menu_items i
   set is_preorderable = true, preorder_step = 1, preorder_unit = 'Pizza'
  from public.menu_categories c
 where c.id = i.category_id and c.slug = 'pizzas' and i.price_label !~ '^\s*\+';

-- 50 empanadas is a family dinner, not a party. 96 is sixteen packs.
update public.site_settings
   set value = jsonb_set(value, '{max_quantity}', '96'::jsonb)
 where key = 'preorders' and coalesce((value->>'max_quantity')::int, 0) < 96;

create or replace function public.request_preorder(p_name text, p_phone text, p_email text, p_pickup_date date, p_pickup_time time without time zone, p_lines jsonb, p_notes text default null::text, p_locale text default 'de'::text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  -- Abuse limits, mirroring request_reservation(). A bakery never approaches these honestly.
  max_name_len      constant int := 100;
  max_phone_len     constant int := 30;
  max_email_len     constant int := 254;
  max_notes_len     constant int := 500;
  max_per_contact_24h constant int := 3;
  max_open_per_phone  constant int := 3;
  max_global_1h     constant int := 15;
  max_global_24h     constant int := 60;

  s jsonb := public.preorder_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_locale text := case when p_locale in ('de', 'es', 'en') then p_locale else 'de' end;
  v_phone_key text;
  line jsonb;
  line_count int := 0;
  item record;
  oh record;
  new_id uuid;
  new_token text;
begin
  if not (s->>'enabled')::boolean then
    raise exception 'preorders_disabled' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_name, '')) > max_name_len or char_length(coalesce(p_phone, '')) > max_phone_len
     or char_length(coalesce(p_email, '')) > max_email_len or char_length(coalesce(p_notes, '')) > max_notes_len then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  v_phone_key := public.phone_key(v_phone);
  if char_length(v_name) < 2
     or v_phone !~ '^[0-9+()./ -]+$' or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;

  if p_pickup_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;
  if (p_pickup_date + p_pickup_time) at time zone 'Europe/Berlin'
       < now() + make_interval(hours => (s->>'min_lead_hours')::int) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.closures c where c.date = p_pickup_date) then
    raise exception 'closed_that_day' using errcode = 'P0001';
  end if;
  select * into oh from public.opening_hours h where h.weekday = extract(dow from p_pickup_date)::int;
  if not found or oh.is_closed then
    raise exception 'closed_that_day' using errcode = 'P0001';
  end if;
  if p_pickup_time < oh.opens or p_pickup_time > oh.closes then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_lines) > (s->>'max_lines')::int then
    raise exception 'too_many_lines' using errcode = 'P0001';
  end if;

  if (select count(distinct (l->>'item_id')::uuid) from jsonb_array_elements(p_lines) l) <> jsonb_array_length(p_lines) then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('preorder_request'));

  if (select count(*) from public.preorders p
      where p.created_at > now() - interval '24 hours'
        and (public.phone_key(p.phone) = v_phone_key
             or (v_email is not null and lower(p.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.preorders p
      where p.pickup_date >= (now() at time zone 'Europe/Berlin')::date
        and p.status in ('pending', 'confirmed', 'ready')
        and public.phone_key(p.phone) = v_phone_key) >= max_open_per_phone then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.preorders p where p.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.preorders p where p.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.preorders (name, phone, email, pickup_date, pickup_time, notes, locale)
  values (v_name, v_phone, v_email, p_pickup_date, p_pickup_time, v_notes, v_locale)
  returning id, manage_token into new_id, new_token;

  for line in select * from jsonb_array_elements(p_lines) loop
    line_count := line_count + 1;
    if (line->>'quantity')::int is null or (line->>'quantity')::int < 1
       or (line->>'quantity')::int > (s->>'max_quantity')::int then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;
    select mi.id, mi.name, mi.preorder_unit, mi.price_label, mi.preorder_step into item
    from public.menu_items mi
    where mi.id = (line->>'item_id')::uuid and mi.is_preorderable and mi.is_available;
    if not found then
      raise exception 'item_unavailable' using errcode = 'P0001';
    end if;
    -- Sold in packs: six empanadas, twelve, never seven.
    if (line->>'quantity')::int % item.preorder_step <> 0 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;
    insert into public.preorder_lines (preorder_id, menu_item_id, label, unit_label, price_label, quantity)
    values (new_id, item.id, item.name, item.preorder_unit, item.price_label, (line->>'quantity')::int);
  end loop;

  return new_token;
end $function$;

-- ---------------------------------------------------------------- 2. roles
alter table public.staff
  add column if not exists role text not null default 'staff';
alter table public.staff
  drop constraint if exists staff_role_valid;
alter table public.staff
  add constraint staff_role_valid check (role in ('admin', 'staff'));

-- The agency's own logins: claude on production, paul on staging. Matched by address so the same
-- file runs on both projects; an address that does not exist there simply updates nothing.
update public.staff s
   set role = 'admin'
  from auth.users u
 where u.id = s.user_id
   and u.email in ('claude@staff.lacordobesa.local', 'paul@staff.lacordobesa.local');

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Visitor analytics are the agency's, not the restaurant's.
create or replace function public.analytics_breakdown(p_from date, p_to date, p_event text, p_by text, p_detail text default null::text)
 returns table(bucket text, total bigint)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;
  if p_by not in ('day', 'detail', 'path', 'referrer', 'device', 'browser', 'lang') then
    raise exception 'unknown dimension %', p_by using errcode = '22023';
  end if;

  return query execute format(
    'select %1$I::text, sum(hits)::bigint
       from public.analytics_daily
      where day between $1 and $2 and event = $3 and ($4 is null or detail = $4)
      group by 1
      order by 2 desc',
    p_by
  ) using p_from, p_to, p_event, p_detail;
end;
$function$;

drop policy if exists "staff read" on public.analytics_daily;
drop policy if exists "admin read" on public.analytics_daily;
create policy "admin read" on public.analytics_daily for select to authenticated
  using ((select public.is_admin()));
