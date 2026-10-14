-- time + interval wraps at midnight in Postgres. With a closing time within one slot of midnight the
-- loop condition stayed true forever (inside the site-wide booking lock), and the overlap test
-- `start_time < t + duration` wrapped to a tiny time, so late slots counted no existing bookings.
-- Same function, but all arithmetic is in minutes since midnight, which cannot wrap.
create or replace function public.reservation_availability(p_date date)
returns table (slot time, seats_left int)
language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb := public.reservation_settings();
  slot_min int := greatest((s->>'slot_minutes')::int, 1);
  dur_min int := (s->>'duration_minutes')::int;
  cap int := (s->>'capacity_seats')::int;
  last_min int := (s->>'last_seating_minutes_before_close')::int;
  earliest timestamptz := now() + make_interval(hours => (s->>'min_lead_hours')::int);
  oh record;
  m int;
  close_m int;
  t time;
begin
  if not (s->>'enabled')::boolean then return; end if;
  if exists (select 1 from public.closures c where c.date = p_date) then return; end if;
  select * into oh from public.opening_hours h where h.weekday = extract(dow from p_date)::int;
  if oh is null or oh.is_closed then return; end if;

  m := (extract(epoch from oh.opens) / 60)::int;
  close_m := (extract(epoch from oh.closes) / 60)::int;
  while m + last_min <= close_m loop
    t := make_time(m / 60, m % 60, 0);
    -- Skip slots inside the lead time (slot times are Europe/Berlin local).
    if (p_date + t) at time zone 'Europe/Berlin' >= earliest then
      slot := t;
      seats_left := cap - coalesce((
        select sum(r.party_size) from public.reservations r
        where r.date = p_date
          and r.status in ('pending', 'confirmed')
          and (extract(epoch from r.start_time) / 60)::int < m + dur_min
          and (extract(epoch from r.start_time) / 60)::int + dur_min > m
      ), 0);
      return next;
    end if;
    m := m + slot_min;
  end loop;
end $$;
