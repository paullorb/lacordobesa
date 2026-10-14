-- Closing the gaps the review threads on the earlier RPC migrations found. Each function is the
-- latest definition with only the change described here; `create or replace` keeps its grants.
--
-- request_preorder, request_event_inquiry, join_waitlist: the quota checks took an advisory lock
-- keyed on the phone number, so parallel requests with different numbers all read the same counts
-- and all passed the global limits. Each now takes one site-wide lock, as request_reservation does.
--
-- request_preorder: rejects a repeated item_id, which let one dish exceed max_quantity.
--
-- join_waitlist: only accepts a day that is actually full. It used to accept any date in range,
-- including closed days and days where a seat came free after the page loaded.
--
-- move_reservation_by_token: clears confirmation_sent_at, so the new slot's confirmation is mailed
-- instead of being skipped as already sent.

create or replace function public.request_preorder(
  p_name text, p_phone text, p_email text,
  p_pickup_date date, p_pickup_time time, p_lines jsonb, p_notes text default null
) returns text
language plpgsql security definer set search_path = public as $$
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

  insert into public.preorders (name, phone, email, pickup_date, pickup_time, notes)
  values (v_name, v_phone, v_email, p_pickup_date, p_pickup_time, v_notes)
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
end $$;

create or replace function public.request_event_inquiry(
  p_name text, p_phone text, p_email text, p_occasion text, p_budget_band text,
  p_event_date date default null, p_guests int default null, p_message text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_per_contact_24h constant int := 2;
  max_global_1h     constant int := 10;
  max_global_24h    constant int := 40;

  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_phone_key text;
begin
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_email, '')) > 254 or char_length(coalesce(p_message, '')) > 1500 then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  v_phone_key := public.phone_key(v_phone);
  if char_length(v_name) < 2
     or v_phone !~ '^[0-9+()./ -]+$' or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;
  -- The check constraints would catch these too, but a named error gives the form something to say.
  if p_occasion is null or p_occasion not in ('geburtstag', 'firmenfeier', 'taufe', 'hochzeit', 'catering', 'andere') then
    raise exception 'invalid_occasion' using errcode = 'P0001';
  end if;
  if p_budget_band is null or p_budget_band not in ('unsicher', 'bis-500', '500-1000', '1000-2500', 'ueber-2500') then
    raise exception 'invalid_budget' using errcode = 'P0001';
  end if;
  if p_guests is not null and (p_guests < 1 or p_guests > 500) then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;
  -- A date in the past is a typo, not a plan. Null stays allowed: "wir sind flexibel".
  if p_event_date is not null and p_event_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;

  -- One site-wide lock, so requests with different phone numbers cannot pass the counts together.
  perform pg_advisory_xact_lock(hashtext('event_inquiry'));

  if (select count(*) from public.event_inquiries e
      where e.created_at > now() - interval '24 hours'
        and (public.phone_key(e.phone) = v_phone_key
             or (v_email is not null and lower(e.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.event_inquiries e where e.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.event_inquiries e where e.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.event_inquiries (name, phone, email, event_date, guests, occasion, budget_band, message)
  values (v_name, v_phone, v_email, p_event_date, p_guests, p_occasion, p_budget_band, v_message);
end $$;

create or replace function public.join_waitlist(
  p_name text, p_phone text, p_email text, p_date date, p_party_size int, p_time_preference text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_per_contact_24h constant int := 3;
  max_waiting_per_phone constant int := 3;
  max_global_1h     constant int := 20;
  max_global_24h    constant int := 100;

  s jsonb := public.reservation_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_pref  text := nullif(trim(coalesce(p_time_preference, '')), '');
  v_phone_key text;
begin
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_email, '')) > 254 or char_length(coalesce(p_time_preference, '')) > 120 then
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
  if p_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  if p_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;

  -- The booking lock, not one per phone: it serializes the global counts below, and it means the
  -- availability read next cannot interleave with a booking or a cancellation.
  perform pg_advisory_xact_lock(hashtext('reservation_request'));

  -- Only a full day has a waitlist: every slot exists and none has a free seat, the same rule the
  -- form uses to offer it. A closed day has no slots, and a day where a seat came free since the
  -- page loaded should be booked rather than queued for.
  if not exists (select 1 from public.reservation_availability(p_date))
     or exists (select 1 from public.reservation_availability(p_date) a where a.seats_left > 0) then
    raise exception 'not_full' using errcode = 'P0001';
  end if;

  -- One entry per phone number per day. A second one is the same guest tapping twice, not a second
  -- group, and it would push a different guest down the list.
  if exists (select 1 from public.waitlist_entries w
             where w.date = p_date and w.status = 'waiting'
               and public.phone_key(w.phone) = v_phone_key) then
    raise exception 'already_on_list' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w
      where w.created_at > now() - interval '24 hours'
        and (public.phone_key(w.phone) = v_phone_key
             or (v_email is not null and lower(w.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w
      where w.date >= (now() at time zone 'Europe/Berlin')::date and w.status = 'waiting'
        and public.phone_key(w.phone) = v_phone_key) >= max_waiting_per_phone then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w where w.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.waitlist_entries w where w.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.waitlist_entries (name, phone, email, date, party_size, time_preference)
  values (v_name, v_phone, v_email, p_date, p_party_size, v_pref);
end $$;

create or replace function public.move_reservation_by_token(
  p_token text, p_date date, p_time time, p_party_size int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_changes constant int := 3;
  s jsonb := public.reservation_settings();
  r public.reservations;
  left_seats int;
begin
  if not public.manage_token_valid(p_token) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not (s->>'enabled')::boolean then
    raise exception 'reservations_disabled' using errcode = 'P0001';
  end if;

  select * into r from public.reservations where manage_token = p_token for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  if r.changed_count >= max_changes then
    raise exception 'too_many_changes' using errcode = 'P0001';
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

  -- The same site-wide lock as request_reservation(), so a move and a new booking cannot both pass
  -- the capacity check for the last seats.
  perform pg_advisory_xact_lock(hashtext('reservation_request'));

  update public.reservations set status = 'cancelled' where id = r.id;

  select a.seats_left into left_seats
  from public.reservation_availability(p_date) a where a.slot = p_time;
  if left_seats is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;
  if left_seats < p_party_size then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;

  update public.reservations
     set date = p_date, start_time = p_time, party_size = p_party_size,
         status = 'pending', changed_count = r.changed_count + 1,
         -- The mail described the old slot. Cleared, so confirming the new one mails the guest again.
         confirmation_sent_at = null
   where id = r.id;
end $$;
