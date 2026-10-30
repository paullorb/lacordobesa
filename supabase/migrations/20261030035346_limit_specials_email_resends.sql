-- Keep a short-lived record of every confirmation email permission, including resends. Only the
-- service-role RPC can use this table; email addresses are represented by a digest.
create table public.broadcast_email_send_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index broadcast_email_send_attempts_created_idx on public.broadcast_email_send_attempts (created_at desc);
create index broadcast_email_send_attempts_address_idx on public.broadcast_email_send_attempts (email_hash, created_at desc);
alter table public.broadcast_email_send_attempts enable row level security;
revoke all on public.broadcast_email_send_attempts from public, anon, authenticated;
grant select, insert, delete on public.broadcast_email_send_attempts to service_role;

create or replace function public.request_broadcast_email(
  p_name text, p_email text, p_consent_text text, p_confirmation_token text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  max_global_1h constant int := 20;
  max_global_24h constant int := 120;
  resend_cooldown constant interval := interval '10 minutes';
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_email_hash text;
begin
  if char_length(coalesce(p_name, '')) < 2 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_name, '')) > 100 or char_length(coalesce(p_email, '')) > 254 then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_consent_text, '')) not between 10 and 500 then
    raise exception 'invalid_consent' using errcode = 'P0001';
  end if;
  if p_confirmation_token is null or p_confirmation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('broadcast_optin'));
  -- No email will be sent for an address that is already confirmed.
  if exists (
    select 1 from public.broadcast_optins o
    where o.channel = 'email' and o.unsubscribed_at is null and o.confirmed_at is not null
      and lower(o.email) = v_email
  ) then
    return false;
  end if;

  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');
  -- Prune old attempts while holding the same lock used for counting and inserting. The cooldown
  -- returns false (the public action reports the same success) without sending another message.
  delete from public.broadcast_email_send_attempts where created_at <= now() - interval '24 hours';
  if exists (
    select 1 from public.broadcast_email_send_attempts a
    where a.email_hash = v_email_hash and a.created_at > now() - resend_cooldown
  ) then
    return false;
  end if;
  if (select count(*) from public.broadcast_email_send_attempts a where a.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.broadcast_email_send_attempts a where a.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  update public.broadcast_optins o
     set consented_at = now(), consent_text = trim(p_consent_text), name = coalesce(v_name, o.name),
         email_confirmation_token_hash = encode(extensions.digest(p_confirmation_token, 'sha256'), 'hex')
   where o.channel = 'email' and o.unsubscribed_at is null and o.confirmed_at is null
     and lower(o.email) = v_email;
  if not found then
    insert into public.broadcast_optins (name, email, channel, consent_text, email_confirmation_token_hash)
    values (v_name, v_email, 'email', trim(p_consent_text), encode(extensions.digest(p_confirmation_token, 'sha256'), 'hex'));
  end if;

  insert into public.broadcast_email_send_attempts (email_hash) values (v_email_hash);
  return true;
end $$;

revoke execute on function public.request_broadcast_email(text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_broadcast_email(text, text, text, text) to service_role;
