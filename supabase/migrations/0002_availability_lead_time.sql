-- Availability must not offer slots that request_reservation() would reject as too soon.
create or replace function public.reservation_availability(p_date date)
returns table (slot time, seats_left int)
language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb := public.reservation_settings();
  slot_min int := (s->>'slot_minutes')::int;
  dur_min int := (s->>'duration_minutes')::int;
  cap int := (s->>'capacity_seats')::int;
  last_min int := (s->>'last_seating_minutes_before_close')::int;
  earliest timestamptz := now() + make_interval(hours => (s->>'min_lead_hours')::int);
  oh record;
  t time;
begin
  if not (s->>'enabled')::boolean then return; end if;
  if exists (select 1 from public.closures c where c.date = p_date) then return; end if;
  select * into oh from public.opening_hours h where h.weekday = extract(dow from p_date)::int;
  if oh is null or oh.is_closed then return; end if;

  t := oh.opens;
  while t + make_interval(mins => last_min) <= oh.closes loop
    -- Skip slots inside the lead time (slot times are Europe/Berlin local).
    if (p_date + t) at time zone 'Europe/Berlin' >= earliest then
      slot := t;
      seats_left := cap - coalesce((
        select sum(r.party_size) from public.reservations r
        where r.date = p_date
          and r.status in ('pending', 'confirmed')
          and r.start_time < t + make_interval(mins => dur_min)
          and r.start_time + make_interval(mins => dur_min) > t
      ), 0);
      return next;
    end if;
    t := t + make_interval(mins => slot_min);
  end loop;
end $$;
