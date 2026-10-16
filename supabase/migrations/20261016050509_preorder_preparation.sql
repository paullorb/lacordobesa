-- Empanadas: freshly baked to take away, or par-baked to keep in the guest's freezer.
--
-- The owner asked on 2026-10-16 that a pre-order containing empanadas says which of the two it is,
-- because the bakery prepares them differently. The wizard asks only when the basket holds an
-- empanada; any other basket stores null, as does every order placed before this migration.
--
--   1. preorders.preparation: nullable, 'fresh' or 'frozen'.
--   2. request_preorder() takes p_preparation (last, defaulted). It rejects a value outside the two
--      with 'invalid_preparation', requires one for a basket with an empanada ('preparation_required',
--      empanadas being the dishes whose category slug is 'empanadas', as in 20261016030801), and
--      stores null for a basket without. Adding a parameter makes a new overload, so the eight
--      argument version is dropped first; the new one gets the same grants as 20261014072715 gave it
--      (service_role only: the Server Action calls it with the secret key).
--   3. preorder_by_token() returns the preparation too, so the guest's status page can show it. A
--      table-returning function cannot gain a column in place, so it is dropped and recreated; the
--      default grants are what the original had.

alter table public.preorders
  add column if not exists preparation text;
alter table public.preorders
  drop constraint if exists preorders_preparation_check;
alter table public.preorders
  add constraint preorders_preparation_check check (preparation is null or preparation in ('fresh', 'frozen'));
comment on column public.preorders.preparation is 'Empanadas only: fresh (baked for collection) or frozen (par-baked, to freeze at home). Null for other orders and for orders placed before this column existed.';

drop function if exists public.request_preorder(text, text, text, date, time without time zone, jsonb, text, text);

create or replace function public.request_preorder(p_name text, p_phone text, p_email text, p_pickup_date date, p_pickup_time time without time zone, p_lines jsonb, p_notes text default null::text, p_locale text default 'de'::text, p_preparation text default null::text)
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
  v_preparation text := nullif(trim(coalesce(p_preparation, '')), '');
  has_empanadas boolean;
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

  -- Empanadas can leave the shop freshly baked or par-baked for the guest's freezer, and the bakery
  -- needs to know which before it starts. Anything else in the basket has no such choice, so for a
  -- basket without empanadas the answer is dropped rather than stored against the wrong thing.
  if v_preparation is not null and v_preparation not in ('fresh', 'frozen') then
    raise exception 'invalid_preparation' using errcode = 'P0001';
  end if;
  select exists (
    select 1
    from public.menu_items mi
    join public.menu_categories c on c.id = mi.category_id
    where c.slug = 'empanadas'
      and mi.id in (select (l->>'item_id')::uuid from jsonb_array_elements(p_lines) l)
  ) into has_empanadas;
  if has_empanadas and v_preparation is null then
    raise exception 'preparation_required' using errcode = 'P0001';
  end if;
  if not has_empanadas then
    v_preparation := null;
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

  insert into public.preorders (name, phone, email, pickup_date, pickup_time, notes, locale, preparation)
  values (v_name, v_phone, v_email, p_pickup_date, p_pickup_time, v_notes, v_locale, v_preparation)
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

revoke execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text, text)
  to service_role;

-- Same check as the one that closed the form RPCs to the publishable key: a stale overload that
-- is still callable would pass unnoticed otherwise.
do $$
declare leaked text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into leaked
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname = 'request_preorder'
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  if leaked is not null then
    raise exception 'request_preorder still callable with the publishable key: %', leaked;
  end if;
end $$;

-- ---------------------------------------------------------------- guest read by token
drop function if exists public.preorder_by_token(text);
create function public.preorder_by_token(p_token text)
returns table (
  name text,
  pickup_date date,
  pickup_time time,
  status public.preorder_status,
  notes text,
  lines jsonb,
  preparation text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.manage_token_valid(p_token) then return; end if;
  return query
    select p.name, p.pickup_date, p.pickup_time, p.status, p.notes,
           coalesce(
             (select jsonb_agg(jsonb_build_object('label', l.label, 'unit', l.unit_label,
                                                  'price', l.price_label, 'quantity', l.quantity)
                               order by l.label)
              from public.preorder_lines l where l.preorder_id = p.id),
             '[]'::jsonb),
           p.preparation
    from public.preorders p
    where p.manage_token = p_token;
end $$;

-- A dropped-and-recreated function loses its ACL (see 20261014072715), so repeat the original's:
-- anon only, as the guest's own token is the credential.
revoke execute on function public.preorder_by_token(text) from public, authenticated;
grant  execute on function public.preorder_by_token(text) to anon;
