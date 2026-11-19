-- Admin-only keys in site_settings are admin-only in the database too.
--
-- The staff area keeps the review ratings (key 'review_scores', Bewertungen) behind requireAdmin(),
-- but the write policies on site_settings (20261012074936, 20261014135246) only ask is_staff(). A
-- 'staff' role could therefore upsert that key straight through PostgREST with its own session,
-- skipping the page and the Server Action that guard it.
--
-- Restrictive policies are ANDed with the permissive ones already there, so everything else a staff
-- member writes (announcement, reservations, preorders, hero) is untouched and only the listed
-- key needs is_admin(). To protect another key, add it to the list in all three policies.
--
-- USING restricts which existing rows can be changed or deleted; WITH CHECK restricts what a row may
-- be written (or renamed) to, so a staff update cannot rename a row into the protected key either.

drop policy if exists "admin only keys insert" on public.site_settings;
drop policy if exists "admin only keys update" on public.site_settings;
drop policy if exists "admin only keys delete" on public.site_settings;

create policy "admin only keys insert" on public.site_settings
  as restrictive for insert to authenticated
  with check (key <> all (array['review_scores']) or (select public.is_admin()));

create policy "admin only keys update" on public.site_settings
  as restrictive for update to authenticated
  using (key <> all (array['review_scores']) or (select public.is_admin()))
  with check (key <> all (array['review_scores']) or (select public.is_admin()));

create policy "admin only keys delete" on public.site_settings
  as restrictive for delete to authenticated
  using (key <> all (array['review_scores']) or (select public.is_admin()));
