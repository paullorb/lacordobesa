-- Guest manage links: they expire, and they stop offering changes once the booking has started.
--
-- 1. Expiry. A manage link in an old mail or a log used to show the guest's name, notes and order
--    lines for as long as the row existed. Now reservation_by_token() and preorder_by_token() return
--    nothing, and the cancel/move RPCs answer 'not_found', from 14 days after the booking date or
--    pickup date. That is the same "unknown token" shape the pages already turn into a 404. Links
--    in mails keep working until then, including for the days after the visit.
--
-- 2. Start time, not date. cancel_reservation_by_token() only refused a date before today, so a
--    confirmed 19:00 booking that nobody attended could still be cancelled by the guest at 21:00, and
--    staff cannot record a no-show on a booking that was cancelled (they may not cancel a started
--    one themselves). move_reservation_by_token() had no "already past" check at all: a still-open
--    booking from last week could be moved to a future slot by posting to the RPC directly. Both now
--    compare the Europe/Berlin start timestamp with now(), the same rule as hasStarted() in
--    src/lib/dates.ts (a booking has started at its start minute, inclusive).
--
-- Bodies are the live definitions (20261012093558, 20261014024537, 20261016050509) with only the two
-- checks added. Grants are untouched by create or replace.

-- ---------------------------------------------------------------- reservations
create or replace function public.reservation_by_token(p_token text)
returns table (
  name text,
  res_date date,
  start_time time,
  party_size int,
  status public.reservation_status,
  notes text,
  changes_left int
)
language plpgsql stable security definer set search_path = public as $$
declare
  max_changes constant int := 3;
  keep_days constant int := 14; -- how long after the booking date the link still works
begin
  if not public.manage_token_valid(p_token) then return; end if;
  return query
    select r.name, r.date, r.start_time, r.party_size, r.status, r.notes,
           greatest(max_changes - r.changed_count, 0)
    from public.reservations r
    where r.manage_token = p_token
      and r.date >= (now() at time zone 'Europe/Berlin')::date - keep_days;
end $$;

create or replace function public.cancel_reservation_by_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  keep_days constant int := 14;
  r public.reservations;
begin
  if not public.manage_token_valid(p_token) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into r from public.reservations where manage_token = p_token for update;
  if not found or r.date < (now() at time zone 'Europe/Berlin')::date - keep_days then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status = 'cancelled' then
    return; -- Idempotent: a double-tapped link should not look like an error.
  end if;
  if r.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  -- Started, not just "before today": a booking nobody turned up for is a no-show for staff to record.
  if (r.date + r.start_time) at time zone 'Europe/Berlin' <= now() then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  update public.reservations set status = 'cancelled' where id = r.id;
end $$;

create or replace function public.move_reservation_by_token(
  p_token text, p_date date, p_time time, p_party_size int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_changes constant int := 3;
  keep_days constant int := 14;
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
  if not found or r.date < (now() at time zone 'Europe/Berlin')::date - keep_days then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  -- A booking that has started is staff's to settle (no-show or completed), not something to move.
  if (r.date + r.start_time) at time zone 'Europe/Berlin' <= now() then
    raise exception 'in_the_past' using errcode = 'P0001';
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

-- ---------------------------------------------------------------- pre-orders
create or replace function public.preorder_by_token(p_token text)
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
declare
  keep_days constant int := 14;
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
    where p.manage_token = p_token
      and p.pickup_date >= (now() at time zone 'Europe/Berlin')::date - keep_days;
end $$;

create or replace function public.cancel_preorder_by_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  keep_days constant int := 14;
  p public.preorders;
begin
  if not public.manage_token_valid(p_token) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into p from public.preorders where manage_token = p_token for update;
  if not found or p.pickup_date < (now() at time zone 'Europe/Berlin')::date - keep_days then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p.status = 'cancelled' then
    return; -- Idempotent, like the reservation equivalent.
  end if;
  -- 'ready' is excluded on purpose: it is already baked, so cancelling is a conversation, not a click.
  if p.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  if p.pickup_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  update public.preorders set status = 'cancelled' where id = p.id;
end $$;
