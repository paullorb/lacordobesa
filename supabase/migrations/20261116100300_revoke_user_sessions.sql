-- Ends every session of one user, for the admin's "reset password".
--
-- GoTrue's admin API can change a password (updateUserById) but has no call that signs a user out
-- by id: auth.admin.signOut() needs that user's own JWT. A password reset therefore left any
-- session already open, a stolen one included, alive, and its refresh token kept minting new access
-- tokens. Deleting the user's rows in auth.sessions ends them: auth.refresh_tokens rows go with
-- them (on delete cascade), so nothing can be refreshed, and GoTrue rejects an access token whose
-- session_id no longer exists the next time it is checked against the Auth server (getUser()).
--
-- Service role only: the Server Action calls it with the secret key after requireAdmin().
-- SECURITY DEFINER because the auth schema is not readable by the API roles; search_path is empty
-- and every name is schema-qualified.

create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.revoke_user_sessions(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'execute') then
    raise exception 'revoke_user_sessions is callable with the publishable key';
  end if;
end $$;
