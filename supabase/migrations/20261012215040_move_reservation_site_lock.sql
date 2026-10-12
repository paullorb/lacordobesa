-- A move and a new booking could both take the last seats of a slot.
--
-- 20261012085300 made request_reservation() serialize on one site-wide advisory lock,
-- hashtext('reservation_request'), instead of one lock per day. move_reservation_by_token() still
-- took the per-day locks, which nothing else takes any more, so the two never waited for each other:
-- both read seats_left before the other committed, both passed the capacity check, and the slot was
-- overbooked.
--
-- The move now takes the same site-wide lock. One lock also means there is no lock ordering left to
-- get wrong, so the sorted per-day loop goes. Everything else is unchanged from 20261012093558.

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
         status = 'pending', changed_count = r.changed_count + 1
   where id = r.id;
end $$;
