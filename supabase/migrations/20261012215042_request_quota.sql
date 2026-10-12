-- Per-visitor limits for the public forms.
--
-- The abuse limits inside request_reservation() and its siblings count per phone number and
-- site-wide. A script that rotates phone numbers never trips the first, and the second then turns
-- every real guest away with too_many_requests, while the fake pending bookings hold the seats.
-- Neither can be fixed inside those functions, because they never see who is calling.
--
-- The server can: on Vercel, x-forwarded-for carries the visitor's address. The Server Actions hash
-- it (SHA-256 with a server-side pepper, so the raw address is never stored) and take one unit from
-- a bucket here before calling the RPC. Rows live for 24 hours.
--
-- Only the server's secret key may call this. Granting it to anon would let a caller spend or skip
-- any visitor's quota at will. On its own this does not close the bypass: the form RPCs stay
-- callable with the publishable key until a later migration revokes that, once the secret key is
-- deployed.

create table public.request_quota (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now(),
  constraint request_quota_bucket_len check (char_length(bucket) between 1 and 200)
);
create index request_quota_bucket_idx on public.request_quota (bucket, created_at desc);
create index request_quota_created_at_idx on public.request_quota (created_at);

-- RLS on with no policies: nobody but the service role (which bypasses RLS) reads or writes it.
alter table public.request_quota enable row level security;
revoke all on table public.request_quota from anon, authenticated;
grant select, insert, delete on table public.request_quota to service_role;

create or replace function public.take_request_quota(p_bucket text, p_max_1h int, p_max_24h int)
returns boolean
language plpgsql security invoker set search_path = public as $$
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 200 then
    raise exception 'invalid_bucket' using errcode = 'P0001';
  end if;

  -- Two requests from one visitor at the same moment must not both read the count below the limit.
  perform pg_advisory_xact_lock(hashtext('request_quota:' || p_bucket));

  delete from public.request_quota where created_at < now() - interval '24 hours';

  if (select count(*) from public.request_quota q
       where q.bucket = p_bucket and q.created_at > now() - interval '1 hour') >= p_max_1h
     or (select count(*) from public.request_quota q where q.bucket = p_bucket) >= p_max_24h then
    return false;
  end if;

  insert into public.request_quota (bucket) values (p_bucket);
  return true;
end $$;

-- Supabase grants EXECUTE on new functions to anon and authenticated directly, so revoking from
-- public alone would leave them in place.
revoke execute on function public.take_request_quota(text, int, int) from public, anon, authenticated;
grant  execute on function public.take_request_quota(text, int, int) to service_role;
