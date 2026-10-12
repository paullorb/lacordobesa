-- Waitlist for days that are already full.
--
-- Today a full day is a dead end: the wizard says "alles ausgebucht" and the guest leaves. That is
-- demand being thrown away, and it is demand that costs nothing to capture, because a cancellation
-- or a move (migration 20261012093558) frees seats on exactly those days.
--
-- Deliberately not an automatic allocation queue. Who gets the freed table is a judgement the
-- restaurant makes, so staff see the list for a day and call whoever fits.

create type public.waitlist_status as enum ('waiting', 'notified', 'converted', 'expired', 'cancelled');

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  date date not null,
  party_size int not null check (party_size between 1 and 50),
  -- Free text, because "ab 19 Uhr" and "lieber früh" are the useful answers, not a slot.
  time_preference text,
  status public.waitlist_status not null default 'waiting',
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_name_len  check (char_length(name)  <= 100),
  constraint waitlist_phone_len check (char_length(phone) <= 30),
  constraint waitlist_email_len check (email is null or char_length(email) <= 254),
  constraint waitlist_pref_len  check (time_preference is null or char_length(time_preference) <= 120),
  constraint waitlist_staff_notes_len check (staff_notes is null or char_length(staff_notes) <= 2000)
);
create index waitlist_date_idx on public.waitlist_entries (date, created_at);
create index waitlist_created_at_idx on public.waitlist_entries (created_at desc);
create index waitlist_phone_key_idx on public.waitlist_entries (public.phone_key(phone));
create trigger waitlist_entries_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

alter table public.waitlist_entries enable row level security;
create policy "staff all" on public.waitlist_entries for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create or replace function public.join_waitlist(
  p_name text, p_phone text, p_email text, p_date date, p_party_size int, p_time_preference text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_per_contact_24h constant int := 3;
  max_waiting_per_phone constant int := 3;
  max_global_1h     constant int := 20;
  max_global_24h    constant int := 100;

  s jsonb := public.reservation_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_pref  text := nullif(trim(coalesce(p_time_preference, '')), '');
  v_phone_key text;
begin
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_email, '')) > 254 or char_length(coalesce(p_time_preference, '')) > 120 then
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
  if p_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  if p_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('waitlist_phone:' || v_phone_key));

  -- One entry per phone number per day. A second one is the same guest tapping twice, not a second
  -- group, and it would push a different guest down the list.
  if exists (select 1 from public.waitlist_entries w
             where w.date = p_date and w.status = 'waiting'
               and public.phone_key(w.phone) = v_phone_key) then
    raise exception 'already_on_list' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w
      where w.created_at > now() - interval '24 hours'
        and (public.phone_key(w.phone) = v_phone_key
             or (v_email is not null and lower(w.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w
      where w.date >= (now() at time zone 'Europe/Berlin')::date and w.status = 'waiting'
        and public.phone_key(w.phone) = v_phone_key) >= max_waiting_per_phone then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist_entries w where w.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.waitlist_entries w where w.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.waitlist_entries (name, phone, email, date, party_size, time_preference)
  values (v_name, v_phone, v_email, p_date, p_party_size, v_pref);
end $$;

revoke execute on function public.join_waitlist(text, text, text, date, int, text) from public, authenticated;
grant  execute on function public.join_waitlist(text, text, text, date, int, text) to anon;
