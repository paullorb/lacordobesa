-- Opt-in list for the weekly special.
--
-- The specials table has no distribution channel: staff write "Heute: locro" and only a visitor who
-- happens to open the site ever sees it. This stores the people who asked to be told.
--
-- Not an automated sender. Sending to this list is a staff action (a per-guest wa.me link), because
-- the WhatsApp Cloud API needs a Meta Business account, a verified number and pre-approved templates,
-- none of which exist yet. The table is the part worth having now; swapping the sender later does not
-- change it.
--
-- Consent is treated as evidence, not a boolean: consent_text snapshots exactly what the person
-- agreed to, consented_at when, and source where. Opting out is one unauthenticated click on a
-- tokenised link, with no login and no confirmation step, because that is what an easy withdrawal
-- of consent means.

create type public.broadcast_channel as enum ('whatsapp', 'email');

create table public.broadcast_optins (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  email text,
  channel public.broadcast_channel not null,
  consent_text text not null,
  consented_at timestamptz not null default now(),
  source text not null default 'web',
  unsubscribe_token text not null default encode(gen_random_bytes(18), 'hex'),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broadcast_name_len  check (name is null or char_length(name) <= 100),
  constraint broadcast_phone_len check (phone is null or char_length(phone) <= 30),
  constraint broadcast_email_len check (email is null or char_length(email) <= 254),
  constraint broadcast_consent_len check (char_length(consent_text) between 10 and 500),
  -- The channel decides which contact detail has to be there; the other may be absent.
  constraint broadcast_channel_contact check (
    (channel = 'whatsapp' and phone is not null) or (channel = 'email' and email is not null)
  )
);
create unique index broadcast_optins_token_idx on public.broadcast_optins (unsubscribe_token);
-- One live subscription per contact and channel. Partial, so an unsubscribed row stays as the record
-- of a consent that was given and withdrawn, and the same person can subscribe again later.
create unique index broadcast_optins_phone_idx on public.broadcast_optins (public.phone_key(phone), channel)
  where unsubscribed_at is null and phone is not null;
create unique index broadcast_optins_email_idx on public.broadcast_optins (lower(email), channel)
  where unsubscribed_at is null and email is not null;
create index broadcast_optins_created_at_idx on public.broadcast_optins (created_at desc);
create trigger broadcast_optins_updated_at before update on public.broadcast_optins
  for each row execute function public.set_updated_at();

alter table public.broadcast_optins enable row level security;
create policy "staff all" on public.broadcast_optins for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create or replace function public.subscribe_broadcast(
  p_channel text, p_consent_text text, p_name text default null,
  p_phone text default null, p_email text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  max_global_1h  constant int := 20;
  max_global_24h constant int := 120;

  v_name  text := nullif(trim(coalesce(p_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  if p_channel not in ('whatsapp', 'email') then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_email, '')) > 254 then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  -- The consent wording is supplied by the caller and stored verbatim, so it is checked rather than
  -- trusted: an empty or absurd value would make the record worthless as evidence.
  if char_length(coalesce(p_consent_text, '')) not between 10 and 500 then
    raise exception 'invalid_consent' using errcode = 'P0001';
  end if;

  if p_channel = 'whatsapp' then
    if v_phone is null or v_phone !~ '^[0-9+()./ -]+$'
       or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6 then
      raise exception 'invalid_contact' using errcode = 'P0001';
    end if;
  else
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'invalid_contact' using errcode = 'P0001';
    end if;
  end if;

  if (select count(*) from public.broadcast_optins o where o.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.broadcast_optins o where o.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  -- Already on the list is a success, not an error: telling an anonymous caller "that number is
  -- already subscribed" would turn this endpoint into a way to test whether a number is on the list.
  if p_channel = 'whatsapp' then
    if exists (select 1 from public.broadcast_optins o
               where o.channel = 'whatsapp' and o.unsubscribed_at is null
                 and public.phone_key(o.phone) = public.phone_key(v_phone)) then
      return;
    end if;
  elsif exists (select 1 from public.broadcast_optins o
                where o.channel = 'email' and o.unsubscribed_at is null and lower(o.email) = lower(v_email)) then
    return;
  end if;

  insert into public.broadcast_optins (name, phone, email, channel, consent_text)
  values (v_name, v_phone, v_email, p_channel::public.broadcast_channel, trim(p_consent_text));
end $$;

-- Withdrawing consent: idempotent, and says nothing about whether the token was ever valid.
create or replace function public.unsubscribe_broadcast(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.manage_token_valid(p_token) then return; end if;
  update public.broadcast_optins
     set unsubscribed_at = now()
   where unsubscribe_token = p_token and unsubscribed_at is null;
end $$;

revoke execute on function public.subscribe_broadcast(text, text, text, text, text) from public, authenticated;
grant  execute on function public.subscribe_broadcast(text, text, text, text, text) to anon;
revoke execute on function public.unsubscribe_broadcast(text) from public, authenticated;
grant  execute on function public.unsubscribe_broadcast(text) to anon;
