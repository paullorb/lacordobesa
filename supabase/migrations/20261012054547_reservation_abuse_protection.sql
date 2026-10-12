-- Abuse protection for the public reservation endpoint.
-- request_reservation() is callable by anon straight through the REST API, so the Next.js server action
-- (and any Vercel firewall rule / CAPTCHA in front of it) can be bypassed. The limits below therefore live
-- in the function itself.

-- Cap text sizes at the table level too, so no write path can store megabytes of text.
alter table public.reservations
  add constraint reservations_name_len  check (char_length(name)  <= 100),
  add constraint reservations_phone_len check (char_length(phone) <= 30),
  add constraint reservations_email_len check (email is null or char_length(email) <= 254),
  add constraint reservations_notes_len check (notes is null or char_length(notes) <= 500),
  add constraint reservations_staff_notes_len check (staff_notes is null or char_length(staff_notes) <= 2000);

-- Phone numbers are compared by their last 8 digits, so "+49 69 123456", "0049-69-123456" and
-- "069 123456" count as the same guest.
create or replace function public.phone_key(p text)
returns text language sql immutable set search_path = '' as $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 8);
$$;

-- Rate-limit lookups scan recent rows by creation time / phone.
create index if not exists reservations_created_at_idx on public.reservations (created_at desc);
create index if not exists reservations_phone_key_idx on public.reservations (public.phone_key(phone));

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

  -- Per-contact limits. Serialize on the phone number so parallel requests cannot all pass the count.
  perform pg_advisory_xact_lock(hashtext('reservation_phone:' || v_phone_key));

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

  -- Serialize per day so two concurrent requests can't both pass the capacity check.
  perform pg_advisory_xact_lock(hashtext('reservation:' || p_date::text));

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

revoke all on function public.request_reservation(text, text, text, int, date, time, text) from public;
grant execute on function public.request_reservation(text, text, text, int, date, time, text) to anon, authenticated;
