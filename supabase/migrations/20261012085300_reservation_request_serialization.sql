-- Serialize the whole quota-check-and-insert in request_reservation().
--
-- 0005 took a lock on the phone number before the per-contact counts and a second one on the date before the
-- capacity check. Neither covers the site-wide 15/h and 80/24h caps or the per-e-mail count: a burst with
-- different phone numbers takes different locks, so every transaction can read the same counts and insert.
-- One site-wide lock, taken before the first count and held until commit, makes all of those checks exact.
-- The shop books a handful of tables a day, so serializing requests costs nothing in practice.

create or replace function public.request_reservation(
  p_name text, p_phone text, p_email text, p_party_size int,
  p_date date, p_time time, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
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

  insert into public.reservations (name, phone, email, party_size, date, start_time, notes)
  values (v_name, v_phone, v_email, p_party_size, p_date, p_time, v_notes)
  returning id into new_id;
  return new_id;
end $$;

-- An e-mail match in the per-contact count above would otherwise be a sequential scan on every request.
create index if not exists reservations_email_lower_idx on public.reservations (lower(email));
