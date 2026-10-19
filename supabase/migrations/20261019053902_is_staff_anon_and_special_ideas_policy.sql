-- is_staff() was meant to be callable by signed-in users only (20261012074936), but that migration
-- revoked it from `public` and Supabase's default privileges grant `anon` explicitly, so anon kept
-- it on both projects. Harmless (it answers false), and it is accidentally what let the
-- special_ideas read policy below, which has no `to` clause and calls is_staff(), work for the
-- public site. Done the way is_admin() does it, and the policy split so neither depends on the other.
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

drop policy if exists "public read active" on public.special_ideas;
drop policy if exists "staff read" on public.special_ideas;
create policy "public read active" on public.special_ideas for select
  using (is_active);
create policy "staff read" on public.special_ideas for select to authenticated
  using ((select public.is_staff()));

do $$
begin
  if has_function_privilege('anon', 'public.is_staff()', 'execute') then
    raise exception 'anon can still execute is_staff()';
  end if;
end $$;
