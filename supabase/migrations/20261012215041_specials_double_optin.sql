-- Double opt-in for the specials list.
--
-- Until now a row went in as consented the moment anyone submitted the form. Anyone could put a
-- stranger's number on the list, or put back a number whose owner had unsubscribed, and the stored
-- consent_text proved nothing about who agreed. Marketing messages need consent from the person who
-- receives them (UWG section 7), and the usual proof of that is a second step only the owner of the
-- contact detail can take.
--
-- For WhatsApp that step is a message *from* the number: after signing up, the guest sends the
-- restaurant one prefilled WhatsApp. Staff mark the row confirmed when it arrives, and only confirmed
-- rows are offered for sending. Nobody else can send from that number, so a stranger's sign-up stays
-- unconfirmed and never receives anything.
--
-- E-mail is switched off. Its second step would be a confirmation mail, and this project has no mail
-- sender configured in production. The enum value and the table constraint stay, so turning it back
-- on later is a function change, not a schema change.

alter table public.broadcast_optins
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references auth.users (id) on delete set null;

comment on column public.broadcast_optins.confirmed_at is
  'When the second opt-in step was seen (for WhatsApp: the guest''s own message arrived). Null rows must not be messaged.';
comment on column public.broadcast_optins.confirmed_by is
  'The staff account that recorded the confirmation.';

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
begin
  if p_channel is null or p_channel not in ('whatsapp', 'email') then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  -- No confirmation mail can be sent, so there is no way to prove an e-mail sign-up is genuine.
  if p_channel <> 'whatsapp' then
    raise exception 'channel_unavailable' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_phone, '')) > 30 then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  -- The consent wording is supplied by the caller and stored verbatim, so it is checked rather than
  -- trusted: an empty or absurd value would make the record worthless as evidence.
  if char_length(coalesce(p_consent_text, '')) not between 10 and 500 then
    raise exception 'invalid_consent' using errcode = 'P0001';
  end if;
  if v_phone is null or v_phone !~ '^[0-9+()./ -]+$'
     or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6 then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;

  -- Serialized, like request_reservation(): without the lock a parallel burst all reads the same
  -- count and all insert, and the site-wide caps do nothing.
  perform pg_advisory_xact_lock(hashtext('broadcast_optin'));

  if (select count(*) from public.broadcast_optins o where o.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.broadcast_optins o where o.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  -- Already on the list, confirmed or still waiting for the guest's message, is a success, not an
  -- error: telling an anonymous caller "that number is already subscribed" would turn this endpoint
  -- into a way to test whether a number is on the list. A guest whose first message never arrived
  -- simply sends it again; the pending row is still there for staff to confirm.
  if exists (select 1 from public.broadcast_optins o
             where o.channel = 'whatsapp' and o.unsubscribed_at is null
               and public.phone_key(o.phone) = public.phone_key(v_phone)) then
    return;
  end if;

  insert into public.broadcast_optins (name, phone, channel, consent_text)
  values (v_name, v_phone, 'whatsapp', trim(p_consent_text));
end $$;
