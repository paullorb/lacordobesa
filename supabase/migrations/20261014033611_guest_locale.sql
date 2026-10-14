-- The language a guest booked in, so what we send back is in that language (#38).
--
-- A guest can book or pre-order on /es and then got a German confirmation e-mail with a link to the
-- German management page. The form already knows its locale; this stores it on the row.
--
-- Both RPCs gain a trailing `p_locale` with a default, so they have to be dropped and recreated:
-- `create or replace` cannot change a signature, and adding an overload next to the old one would
-- make every call that omits p_locale ambiguous. The bodies are the live definitions
-- (pg_get_functiondef, 2026-10-14) with only the locale added.

alter table public.reservations
  add column locale text not null default 'de' constraint reservations_locale_check check (locale in ('de', 'es'));
alter table public.preorders
  add column locale text not null default 'de' constraint preorders_locale_check check (locale in ('de', 'es'));

comment on column public.reservations.locale is 'Language the guest booked in; picks the language of the confirmation e-mail and the management link.';
comment on column public.preorders.locale is 'Language the guest ordered in; picks the language of the link staff send back.';

drop function public.request_reservation(text, text, text, int, date, time, text);
drop function public.request_preorder(text, text, text, date, time, jsonb, text);

create function public.request_reservation(p_name text, p_phone text, p_email text, p_party_size integer, p_date date, p_time time without time zone, p_notes text DEFAULT NULL::text, p_locale text DEFAULT 'de'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Abuse limits. A bakery with ~20 seats never gets close to these in honest use.
  max_name_len      constant int := 100;
  max_phone_len     constant int := 30;
  max_email_len     constant int := 254;
  max_notes_len     constant int := 500;
  max_per_contact_24h constant int := 3;   -- requests created per phone number / e-mail in 24 h
  max_upcoming_per_phone constant int := 3; -- open (pending/confirmed) future bookings per phone number
  max_global_1h     constant int := 15;    -- requests created across the whole site per hour
  max_global_24h    constant int := 80;    -- ... and per 24 hours

  s jsonb := public.reservation_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  -- Anything but a locale the site has falls back to German rather than failing the booking.
  v_locale text := case when p_locale in ('de', 'es') then p_locale else 'de' end;
  v_phone_key text;
  left_seats int;
  new_id uuid;
begin
  if not (s->>'enabled')::boolean then
    raise exception 'reservations_disabled' using errcode = 'P0001';
  end if;

  -- Input validation (lengths are checked on the raw value so padding cannot sneak past trim).
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
  if p_party_size is null or p_party_size < 1 or p_party_size > (s->>'max_party_size')::int then
    raise exception 'party_too_large' using errcode = 'P0001';
  end if;
  if p_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;
  if (p_date + p_time) at time zone 'Europe/Berlin' < now() + make_interval(hours => (s->>'min_lead_hours')::int) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;

  -- Everything below reads a count and then inserts, so it all has to happen under one lock: a single
  -- site-wide one, held until commit, instead of the per-phone and per-day locks 0005 used.
  perform pg_advisory_xact_lock(hashtext('reservation_request'));

  -- Per-contact limits.
  if (select count(*) from public.reservations r
      where r.created_at > now() - interval '24 hours'
        and (public.phone_key(r.phone) = v_phone_key
             or (v_email is not null and lower(r.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reservations r
      where r.date >= (now() at time zone 'Europe/Berlin')::date and r.status in ('pending', 'confirmed')
        and public.phone_key(r.phone) = v_phone_key) >= max_upcoming_per_phone then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reservations r
             where r.date = p_date and r.status in ('pending', 'confirmed')
               and public.phone_key(r.phone) = v_phone_key) then
    raise exception 'duplicate_booking' using errcode = 'P0001';
  end if;

  -- Site-wide brake: stops a script that rotates phone numbers from filling the calendar unattended.
  if (select count(*) from public.reservations r where r.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.reservations r where r.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  select a.seats_left into left_seats
  from public.reservation_availability(p_date) a where a.slot = p_time;
  if left_seats is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  if left_seats < p_party_size then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;

  insert into public.reservations (name, phone, email, party_size, date, start_time, notes, locale)
  values (v_name, v_phone, v_email, p_party_size, p_date, p_time, v_notes, v_locale)
  returning id into new_id;
  return new_id;
end $function$;

create function public.request_preorder(p_name text, p_phone text, p_email text, p_pickup_date date, p_pickup_time time without time zone, p_lines jsonb, p_notes text DEFAULT NULL::text, p_locale text DEFAULT 'de'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_locale text := case when p_locale in ('de', 'es') then p_locale else 'de' end;
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

  -- Pickup window: far enough ahead to actually bake it, not beyond the planning horizon, and
  -- during opening hours on a day the shop is open.
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

  -- One dish, one line. Lines are checked one at a time below, so a repeated item_id would add up
  -- past max_quantity and count as several dishes. The form never sends duplicates. Compared as
  -- uuid, not as text: 'ABC...' and 'abc...' are two strings but the same dish.
  if (select count(distinct (l->>'item_id')::uuid) from jsonb_array_elements(p_lines) l) <> jsonb_array_length(p_lines) then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  -- Quotas, serialized on one site-wide lock. A lock per phone number let requests with different
  -- numbers pass the global counts side by side.
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
    select mi.id, mi.name, mi.preorder_unit, mi.price_label into item
    from public.menu_items mi
    where mi.id = (line->>'item_id')::uuid and mi.is_preorderable and mi.is_available;
    if not found then
      raise exception 'item_unavailable' using errcode = 'P0001';
    end if;
    -- Snapshot the name, unit and price so a later menu edit cannot rewrite this order.
    insert into public.preorder_lines (preorder_id, menu_item_id, label, unit_label, price_label, quantity)
    values (new_id, item.id, item.name, item.preorder_unit, item.price_label, (line->>'quantity')::int);
  end loop;

  return new_token;
end $function$;

-- The same grants the old signatures had: the form Server Actions call these as anon (publishable
-- key) or service_role (secret key), nobody else. A new function in public gets PUBLIC and
-- Supabase's default grants, so those come off again.
revoke execute on function public.request_reservation(text, text, text, int, date, time, text, text) from public, authenticated;
grant  execute on function public.request_reservation(text, text, text, int, date, time, text, text) to anon, service_role;
revoke execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text) from public, authenticated;
grant  execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text) to anon, service_role;
