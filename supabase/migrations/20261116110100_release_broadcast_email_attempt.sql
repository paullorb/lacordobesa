-- A confirmation mail that could not be sent must not count as sent.
--
-- request_broadcast_email() records its attempt (the 10-minute resend cooldown) before the server
-- action calls the mail provider. When the provider failed, the guest saw an error, retried, hit the
-- cooldown, and was told it had worked although no mail had ever left. The action now calls this
-- on a send failure: it removes the newest attempt for that address, so the retry goes through. The
-- cooldown against mail bombing is untouched, because it only gives back an attempt whose mail
-- was never sent, and the per-visitor quota still bounds how often one visitor can ask.

create or replace function public.release_broadcast_email_attempt(p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := encode(extensions.digest(lower(trim(coalesce(p_email, ''))), 'sha256'), 'hex');
begin
  -- Same lock request_broadcast_email() holds while it counts and inserts.
  perform pg_advisory_xact_lock(hashtext('broadcast_optin'));
  delete from public.broadcast_email_send_attempts
   where id = (select a.id from public.broadcast_email_send_attempts a
               where a.email_hash = v_hash order by a.created_at desc, a.id desc limit 1);
end $$;

revoke execute on function public.release_broadcast_email_attempt(text) from public, anon, authenticated;
grant execute on function public.release_broadcast_email_attempt(text) to service_role;
