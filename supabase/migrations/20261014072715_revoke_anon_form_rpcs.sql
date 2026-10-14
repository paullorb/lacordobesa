-- The public form RPCs stop accepting the publishable key.
--
-- 20261012215042 put a per-visitor limit in front of every public form, but noted that the limit
-- does not bind on its own: the publishable key ships in every browser, so a script could skip the
-- site, call request_reservation() directly and never pass through take_request_quota(). This is
-- the "later migration" that closes it. The Server Actions have been calling these five with the
-- secret key since then, and SUPABASE_SECRET_KEY is set for the production deployment, so anon no
-- longer needs the grant.
--
-- Only the five *write* RPCs behind src/lib/public-forms.ts lose anon. Everything else a visitor
-- reaches keeps it on purpose:
--   * reservation_availability() feeds the date picker during render, under `use cache`, on the
--     publishable key. It writes nothing and hands out free seat counts, not rows.
--   * the manage-link RPCs (reservation_by_token, cancel_reservation_by_token,
--     move_reservation_by_token, preorder_by_token, cancel_preorder_by_token,
--     unsubscribe_broadcast) authenticate with the guest's own token, which is the credential. They
--     are not rate limited per visitor and still run on the publishable key.
-- take_request_quota() was never granted to anon (20261012215042), which is what stops a caller
-- spending another visitor's quota.
--
-- After this, a missing SUPABASE_SECRET_KEY is no longer a silent downgrade to "no per-visitor
-- limit" — it breaks every public form. createPrivilegedClient() therefore throws instead of
-- returning null, so the cause is in the logs rather than an "Invalid API key" from PostgREST.
--
-- Note for whoever edits one of these functions next: `create or replace` keeps these ACLs, but
-- `drop function` followed by `create` does not. Supabase's default privileges grant EXECUTE on a
-- new function to anon and authenticated, so a signature change has to repeat the revokes below.
-- That is why 20261014024537 and 20261014033611 (which added p_locale) are the versions revoked
-- here, by their current identity arguments.

revoke execute on function public.request_reservation(text, text, text, int, date, time, text, text)
  from public, anon, authenticated;
grant  execute on function public.request_reservation(text, text, text, int, date, time, text, text)
  to service_role;

revoke execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text)
  from public, anon, authenticated;
grant  execute on function public.request_preorder(text, text, text, date, time, jsonb, text, text)
  to service_role;

revoke execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text)
  from public, anon, authenticated;
grant  execute on function public.request_event_inquiry(text, text, text, text, text, date, int, text)
  to service_role;

revoke execute on function public.join_waitlist(text, text, text, date, int, text)
  from public, anon, authenticated;
grant  execute on function public.join_waitlist(text, text, text, date, int, text)
  to service_role;

revoke execute on function public.subscribe_broadcast(text, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.subscribe_broadcast(text, text, text, text, text)
  to service_role;

-- Fails the migration rather than leaving a half-open form if a signature above has drifted: a
-- revoke against a function that does not exist raises, but a *stale* grant on an overload that is
-- still around would pass unnoticed otherwise.
do $$
declare leaked text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('request_reservation', 'request_preorder', 'request_event_inquiry',
                      'join_waitlist', 'subscribe_broadcast')
    and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'));
  if leaked is not null then
    raise exception 'form RPCs still callable with the publishable key: %', leaked;
  end if;
end $$;
