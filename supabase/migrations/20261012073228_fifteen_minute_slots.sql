-- Guests pick arrival times on a 15-minute grid (was 30), so a table can be asked for at e.g. 19:45.
create or replace function public.reservation_settings()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(
    (select value from public.site_settings where key = 'reservations'),
    '{"enabled": true, "slot_minutes": 15, "duration_minutes": 90, "capacity_seats": 20,
      "max_party_size": 8, "min_lead_hours": 2, "max_days_ahead": 30, "last_seating_minutes_before_close": 60}'::jsonb
  );
$$;

update public.site_settings
set value = jsonb_set(value, '{slot_minutes}', '15'::jsonb)
where key = 'reservations';
