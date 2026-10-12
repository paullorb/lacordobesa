-- Catering and event inquiries: cumpleaños, Firmenfeier, Taufe, a tray of empanadas for an office.
--
-- These are the highest-value leads the site can take, and they are not bookings: there is no
-- capacity to check and no slot to hold. An inquiry is a conversation starter, so the table is
-- deliberately a lead pipeline (neu, in Arbeit, Angebot raus, gewonnen, verloren) rather than a
-- calendar entry.
--
-- Quotas mirror request_reservation() for the same reason: anon can call the RPC straight through
-- the REST API, so the limits live in the function.

create type public.inquiry_status as enum ('new', 'in_progress', 'quoted', 'won', 'lost');

create table public.event_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  -- Null means "wir sind flexibel": a date is often the thing the guest wants to discuss.
  event_date date,
  guests int,
  occasion text not null,
  budget_band text not null,
  message text,
  status public.inquiry_status not null default 'new',
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_inquiries_name_len  check (char_length(name)  <= 100),
  constraint event_inquiries_phone_len check (char_length(phone) <= 30),
  constraint event_inquiries_email_len check (email is null or char_length(email) <= 254),
  constraint event_inquiries_message_len check (message is null or char_length(message) <= 1500),
  constraint event_inquiries_staff_notes_len check (staff_notes is null or char_length(staff_notes) <= 2000),
  constraint event_inquiries_guests check (guests is null or guests between 1 and 500),
  -- Constrained rather than free text, so the staff list can group and filter on them. The German
  -- labels live in src/lib/events.ts.
  constraint event_inquiries_occasion check (occasion in ('geburtstag', 'firmenfeier', 'taufe', 'hochzeit', 'catering', 'andere')),
  constraint event_inquiries_budget check (budget_band in ('unsicher', 'bis-500', '500-1000', '1000-2500', 'ueber-2500'))
);
create index event_inquiries_created_at_idx on public.event_inquiries (created_at desc);
create index event_inquiries_status_idx on public.event_inquiries (status, event_date);
create index event_inquiries_phone_key_idx on public.event_inquiries (public.phone_key(phone));
create trigger event_inquiries_updated_at before update on public.event_inquiries
  for each row execute function public.set_updated_at();

alter table public.event_inquiries enable row level security;
create policy "staff all" on public.event_inquiries for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create or replace function public.request_event_inquiry(
  p_name text, p_phone text, p_email text, p_occasion text, p_budget_band text,
  p_event_date date default null, p_guests int default null, p_message text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_per_contact_24h constant int := 2;
  max_global_1h     constant int := 10;
  max_global_24h    constant int := 40;

  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_phone_key text;
begin
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_email, '')) > 254 or char_length(coalesce(p_message, '')) > 1500 then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  v_phone_key := public.phone_key(v_phone);
  if char_length(v_name) < 2
     or v_phone !~ '^[0-9+()./ -]+$' or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;
  -- The check constraints would catch these too, but a named error gives the form something to say.
  if p_occasion is null or p_occasion not in ('geburtstag', 'firmenfeier', 'taufe', 'hochzeit', 'catering', 'andere') then
    raise exception 'invalid_occasion' using errcode = 'P0001';
  end if;
  if p_budget_band is null or p_budget_band not in ('unsicher', 'bis-500', '500-1000', '1000-2500', 'ueber-2500') then
    raise exception 'invalid_budget' using errcode = 'P0001';
  end if;
  if p_guests is not null and (p_guests < 1 or p_guests > 500) then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;
  -- A date in the past is a typo, not a plan. Null stays allowed: "wir sind flexibel".
  if p_event_date is not null and p_event_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('inquiry_phone:' || v_phone_key));

  if (select count(*) from public.event_inquiries e
      where e.created_at > now() - interval '24 hours'
        and (public.phone_key(e.phone) = v_phone_key
             or (v_email is not null and lower(e.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.event_inquiries e where e.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.event_inquiries e where e.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.event_inquiries (name, phone, email, event_date, guests, occasion, budget_band, message)
  values (v_name, v_phone, v_email, p_event_date, p_guests, p_occasion, p_budget_band, v_message);
end $$;

revoke execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text) from public, authenticated;
grant  execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text) to anon;
