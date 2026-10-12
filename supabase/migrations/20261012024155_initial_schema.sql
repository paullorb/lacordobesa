-- La Cordobesa: site content, opening hours, reservations.
-- Staff = any authenticated user (auth is invite-only via the Supabase dashboard).
-- Applied to project iabpugtwgjqldlzjjgqj on 2026-10-12.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Key/value settings edited from the staff area (announcement text, reservation rules, ...)
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- weekday: 0 = Sunday ... 6 = Saturday (matches JS Date#getDay)
create table public.opening_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  opens time,
  closes time,
  is_closed boolean not null default false,
  updated_at timestamptz not null default now(),
  check (is_closed or (opens is not null and closes is not null and opens < closes))
);
create trigger opening_hours_updated_at before update on public.opening_hours
  for each row execute function public.set_updated_at();

-- One-off closures (holidays, vacation)
create table public.closures (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,          -- e.g. "Salado"
  sort_order int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete restrict,
  name text not null,           -- "Empanadas"
  subtitle text,                -- "Recién hechas"
  description text,
  price_label text,             -- free text: "ab 4,50 €", "Hausgemacht"
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create table public.specials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_on date not null default current_date,
  ends_on date,                 -- null = until deactivated
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create trigger specials_updated_at before update on public.specials
  for each row execute function public.set_updated_at();

create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'no_show', 'completed');

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  party_size int not null check (party_size between 1 and 50),
  date date not null,
  start_time time not null,
  status public.reservation_status not null default 'pending',
  notes text,                   -- from the guest
  staff_notes text,             -- internal
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_date_idx on public.reservations (date, start_time);
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.site_settings   enable row level security;
alter table public.opening_hours   enable row level security;
alter table public.closures        enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items      enable row level security;
alter table public.specials        enable row level security;
alter table public.reservations    enable row level security;

-- Public content: anyone can read, staff can write.
create policy "public read"  on public.site_settings   for select using (true);
create policy "staff write"  on public.site_settings   for all to authenticated using (true) with check (true);
create policy "public read"  on public.opening_hours   for select using (true);
create policy "staff write"  on public.opening_hours   for all to authenticated using (true) with check (true);
create policy "public read"  on public.closures        for select using (true);
create policy "staff write"  on public.closures        for all to authenticated using (true) with check (true);
create policy "public read"  on public.menu_categories for select using (true);
create policy "staff write"  on public.menu_categories for all to authenticated using (true) with check (true);
create policy "public read"  on public.menu_items      for select using (true);
create policy "staff write"  on public.menu_items      for all to authenticated using (true) with check (true);
create policy "public read"  on public.specials        for select using (true);
create policy "staff write"  on public.specials        for all to authenticated using (true) with check (true);

-- Reservations: guests never read them directly; they go through request_reservation().
create policy "staff all" on public.reservations for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- Reservation logic
-- Settings live in site_settings under key 'reservations':
-- { enabled, slot_minutes, duration_minutes, capacity_seats, max_party_size, min_lead_hours, max_days_ahead, last_seating_minutes_before_close }
create or replace function public.reservation_settings()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(
    (select value from public.site_settings where key = 'reservations'),
    '{"enabled": true, "slot_minutes": 30, "duration_minutes": 90, "capacity_seats": 20,
      "max_party_size": 8, "min_lead_hours": 2, "max_days_ahead": 30, "last_seating_minutes_before_close": 60}'::jsonb
  );
$$;

-- Seats still free for every bookable slot on a date. Used by the public form.
create or replace function public.reservation_availability(p_date date)
returns table (slot time, seats_left int)
language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb := public.reservation_settings();
  slot_min int := (s->>'slot_minutes')::int;
  dur_min int := (s->>'duration_minutes')::int;
  cap int := (s->>'capacity_seats')::int;
  last_min int := (s->>'last_seating_minutes_before_close')::int;
  oh record;
  t time;
begin
  if not (s->>'enabled')::boolean then return; end if;
  if exists (select 1 from public.closures c where c.date = p_date) then return; end if;
  select * into oh from public.opening_hours h where h.weekday = extract(dow from p_date)::int;
  if oh is null or oh.is_closed then return; end if;

  t := oh.opens;
  while t + make_interval(mins => last_min) <= oh.closes loop
    slot := t;
    seats_left := cap - coalesce((
      select sum(r.party_size) from public.reservations r
      where r.date = p_date
        and r.status in ('pending', 'confirmed')
        and r.start_time < t + make_interval(mins => dur_min)
        and r.start_time + make_interval(mins => dur_min) > t
    ), 0);
    return next;
    t := t + make_interval(mins => slot_min);
  end loop;
end $$;

-- Public entry point: validates against hours/capacity and inserts a pending reservation.
create or replace function public.request_reservation(
  p_name text, p_phone text, p_email text, p_party_size int,
  p_date date, p_time time, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s jsonb := public.reservation_settings();
  left_seats int;
  new_id uuid;
begin
  if not (s->>'enabled')::boolean then
    raise exception 'reservations_disabled' using errcode = 'P0001';
  end if;
  if length(trim(p_name)) < 2 or length(trim(p_phone)) < 5 then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;
  if p_party_size < 1 or p_party_size > (s->>'max_party_size')::int then
    raise exception 'party_too_large' using errcode = 'P0001';
  end if;
  if p_date > current_date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;
  if (p_date + p_time) at time zone 'Europe/Berlin' < now() + make_interval(hours => (s->>'min_lead_hours')::int) then
    raise exception 'too_soon' using errcode = 'P0001';
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
  values (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), p_party_size, p_date, p_time, nullif(trim(p_notes), ''))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.request_reservation(text, text, text, int, date, time, text) from public;
grant execute on function public.request_reservation(text, text, text, int, date, time, text) to anon, authenticated;
grant execute on function public.reservation_availability(date) to anon, authenticated;
