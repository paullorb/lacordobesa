-- A few addresses must not be able to shut online booking for everyone.
--
-- The per-visitor quota (take_request_quota) stops one address, but request_reservation() also
-- stopped *everyone* once the site as a whole had taken 15 requests an hour or 80 a day. A handful of
-- addresses sending the per-visitor maximum each could reach that, and every real guest then got
-- too_many_requests while the fake pending bookings held the seats.
--
-- There is no CAPTCHA to put in front of it (the CSP allows scripts from 'self' only), so the site-wide
-- limit becomes a circuit breaker with two stages:
--
--   1. Pressure (form_under_pressure(), below). Past about half of the old limits, the Server Actions
--      only accept a submission that carries a valid, old enough, signed form ticket
--      (src/lib/form-ticket.ts). A real guest always has one; a script that posts straight at the
--      action does not. This stage is enforced in the application, so the RPCs need no new parameter
--      and a deploy that runs before this migration still works (the check then reports "no pressure").
--   2. Hard ceiling, inside request_reservation(): raised from 15/h and 80/24h to 40/h and 200/24h, so
--      reaching it takes a sustained, ticketed flood rather than a few addresses.
--
-- Per-contact limits, which no rotation of addresses gets around, are tightened for the seat-holding
-- reservation: open bookings are now limited per e-mail address as well as per phone number, and the
-- seats a contact has waiting for staff confirmation are capped, so a few fake bookings cannot hold
-- a whole evening.
--
-- The other form RPCs keep their limits; for them the pressure stage sits below their cap.

create or replace function public.form_under_pressure(p_form text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  per_hour int;
  per_day int;
  recent_hour int;
  recent_day int;
begin
  -- Roughly half of each RPC's own site-wide cap (reservation: of its old, pre-ceiling-raise cap).
  case p_form
    when 'reservation' then
      per_hour := 8; per_day := 40;
      select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
        into recent_hour, recent_day from public.reservations where created_at > now() - interval '24 hours';
    when 'preorder' then
      per_hour := 8; per_day := 30;
      select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
        into recent_hour, recent_day from public.preorders where created_at > now() - interval '24 hours';
    when 'inquiry' then
      per_hour := 5; per_day := 20;
      select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
        into recent_hour, recent_day from public.event_inquiries where created_at > now() - interval '24 hours';
    when 'waitlist' then
      per_hour := 10; per_day := 50;
      select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
        into recent_hour, recent_day from public.waitlist_entries where created_at > now() - interval '24 hours';
    when 'specials' then
      per_hour := 10; per_day := 60;
      select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
        into recent_hour, recent_day from public.broadcast_optins where created_at > now() - interval '24 hours';
    else
      return false;
  end case;
  return recent_hour >= per_hour or recent_day >= per_day;
end $$;

revoke execute on function public.form_under_pressure(text) from public, anon, authenticated;
grant execute on function public.form_under_pressure(text) to service_role;

-- request_reservation(): the live definition (20261014033611, with 'en' patched in by 20261015101518),
-- with the raised ceiling and the two per-contact limits added.
create or replace function public.request_reservation(p_name text, p_phone text, p_email text, p_party_size integer, p_date date, p_time time without time zone, p_notes text DEFAULT NULL::text, p_locale text DEFAULT 'de'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  max_name_len      constant int := 100;
  max_phone_len     constant int := 30;
  max_email_len     constant int := 254;
  max_notes_len     constant int := 500;
  max_per_contact_24h constant int := 3;   -- requests created per phone number / e-mail in 24 h
  max_upcoming_per_phone constant int := 3; -- open (pending/confirmed) future bookings per phone number
  max_upcoming_per_email constant int := 3; -- ... and per e-mail address (rotating phone numbers is free)
  max_pending_seats_per_contact constant int := 12; -- seats a contact has waiting for staff to confirm
  max_global_1h     constant int := 40;    -- circuit-breaker ceiling: requests across the site per hour
  max_global_24h    constant int := 200;   -- ... and per 24 hours

  s jsonb := public.reservation_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_locale text := case when p_locale in ('de', 'es', 'en') then p_locale else 'de' end;
  v_phone_key text;
  left_seats int;
  new_id uuid;
begin
  if not (s->>'enabled')::boolean then
    raise exception 'reservations_disabled' using errcode = 'P0001';
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
  if p_party_size is null or p_party_size < 1 or p_party_size > (s->>'max_party_size')::int then
    raise exception 'party_too_large' using errcode = 'P0001';
  end if;
  if p_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;
  if (p_date + p_time) at time zone 'Europe/Berlin' < now() + make_interval(hours => (s->>'min_lead_hours')::int) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;

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
  if v_email is not null and (select count(*) from public.reservations r
      where r.date >= (now() at time zone 'Europe/Berlin')::date and r.status in ('pending', 'confirmed')
        and lower(r.email) = lower(v_email)) >= max_upcoming_per_email then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  -- Seats still waiting for staff: what a fake booking costs the shop until somebody cancels it.
  if coalesce((select sum(r.party_size) from public.reservations r
      where r.date >= (now() at time zone 'Europe/Berlin')::date and r.status = 'pending'
        and (public.phone_key(r.phone) = v_phone_key
             or (v_email is not null and lower(r.email) = lower(v_email)))), 0) + p_party_size > max_pending_seats_per_contact then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reservations r
             where r.date = p_date and r.status in ('pending', 'confirmed')
               and public.phone_key(r.phone) = v_phone_key) then
    raise exception 'duplicate_booking' using errcode = 'P0001';
  end if;

  -- Circuit-breaker ceiling. The stage before it (form_under_pressure) is enforced by the Server Action.
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
