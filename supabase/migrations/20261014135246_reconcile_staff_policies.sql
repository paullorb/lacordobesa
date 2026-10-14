-- Production still carried the pre-split "staff write" FOR ALL policy on the six content tables,
-- although 20261012074936 is recorded there; staging has the split policies. Access is identical
-- (both check is_staff()), but FOR ALL overlaps "public read" on SELECT and trips the
-- multiple-permissive-policies advisor. Idempotent: a no-op where the split policies already exist.
do $$
declare t text;
begin
  foreach t in array array['site_settings', 'opening_hours', 'closures', 'menu_categories', 'menu_items', 'specials'] loop
    execute format('drop policy if exists "staff write" on public.%I', t);
    execute format('drop policy if exists "staff insert" on public.%I', t);
    execute format('drop policy if exists "staff update" on public.%I', t);
    execute format('drop policy if exists "staff delete" on public.%I', t);
    execute format('create policy "staff insert" on public.%I for insert to authenticated with check ((select public.is_staff()))', t);
    execute format('create policy "staff update" on public.%I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
    execute format('create policy "staff delete" on public.%I for delete to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;
