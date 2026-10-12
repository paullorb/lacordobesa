-- Guest self-service: let a guest cancel or move their own booking from a link, without an account.
--
-- Every reservation gets a `manage_token`: 18 random bytes as hex, so 144 bits of entropy. The token is
-- the credential. It is never exposed by a public read (public.reservations has no anon select policy),
-- only handed to the guest in the confirmation message, and the three RPCs below are the only way to
-- use it. They are SECURITY DEFINER for the same reason request_reservation() is: the alternative is
-- opening public.reservations to anon, which is strictly worse.
--
-- Why this exists: a no-show costs a seat that request_reservation() already counted against capacity.
-- A guest who can cancel in one tap returns that seat to the availability calculation automatically.

-- Added nullable and backfilled, rather than relying on ALTER TABLE evaluating a volatile default per
-- row, so every existing booking demonstrably gets its own token.
alter table public.reservations add column manage_token text;
update public.reservations set manage_token = encode(gen_random_bytes(18), 'hex') where manage_token is null;
alter table public.reservations
  alter column manage_token set not null,
  alter column manage_token set default encode(gen_random_bytes(18), 'hex');

-- Caps how often one guest can move the same booking, so a bored visitor cannot churn the calendar.
alter table public.reservations add column changed_count int not null default 0;

create unique index reservations_manage_token_idx on public.reservations (manage_token);

-- Tokens are hex of a fixed length; checking the shape first keeps junk from reaching the index lookup.
create or replace function public.manage_token_valid(p_token text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_token, '') ~ '^[0-9a-f]{36}$';
$$;

-- ---------------------------------------------------------------- read
-- What the guest is shown on /reservierung/<token>. Deliberately omits phone, e-mail and staff_notes:
-- the token is a bearer credential that may sit in a forwarded message, so it unlocks only the booking
-- facts the guest needs to recognise it, never the internal note or the contact details on file.
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
begin
  if not public.manage_token_valid(p_token) then return; end if;
  return query
    select r.name, r.date, r.start_time, r.party_size, r.status, r.notes,
           greatest(max_changes - r.changed_count, 0)
    from public.reservations r
    where r.manage_token = p_token;
end $$;

-- ---------------------------------------------------------------- cancel
create or replace function public.cancel_reservation_by_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.reservations;
begin
  if not public.manage_token_valid(p_token) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into r from public.reservations where manage_token = p_token for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if r.status = 'cancelled' then
    return; -- Idempotent: a double-tapped link should not look like an error.
  end if;
  if r.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  if r.date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  update public.reservations set status = 'cancelled' where id = r.id;
end $$;

-- ---------------------------------------------------------------- move
-- Re-runs the same capacity and lead-time checks as request_reservation(). The booking is set to
-- 'cancelled' first so reservation_availability() stops counting its own seats against it; without
-- that, moving a booking by 15 minutes would collide with itself. A moved booking goes back to
-- 'pending' on purpose: the restaurant confirmed a time, so it gets to confirm the new one too.
create or replace function public.move_reservation_by_token(
  p_token text, p_date date, p_time time, p_party_size int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_changes constant int := 3;
  s jsonb := public.reservation_settings();
  r public.reservations;
  left_seats int;
  lock_days date[];
  d date;
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

  -- Both days are locked, in a fixed order, so a move cannot deadlock against another move going the
  -- other way, and neither day's capacity check can race a concurrent request_reservation().
  select array_agg(x.day order by x.day) into lock_days
    from (select distinct unnest(array[r.date, p_date]) as day) x;
  foreach d in array lock_days loop
    perform pg_advisory_xact_lock(hashtext('reservation:' || d::text));
  end loop;

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

-- ---------------------------------------------------------------- grants
-- anon only, matching request_reservation(): the guest flow runs on the publishable key with no session.
revoke execute on function public.manage_token_valid(text) from public;
revoke execute on function public.reservation_by_token(text) from public, authenticated;
grant  execute on function public.reservation_by_token(text) to anon;
revoke execute on function public.cancel_reservation_by_token(text) from public, authenticated;
grant  execute on function public.cancel_reservation_by_token(text) to anon;
revoke execute on function public.move_reservation_by_token(text, date, time, int) from public, authenticated;
grant  execute on function public.move_reservation_by_token(text, date, time, int) to anon;
