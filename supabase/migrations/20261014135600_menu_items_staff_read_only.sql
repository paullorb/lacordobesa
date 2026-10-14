-- Second half of 20261014135536. Run only once the site reads dishes from menu_items_public, which is
-- when anon can lose the base table: before that, the live menu would come back empty.
drop policy "public read" on public.menu_items;
create policy "staff read" on public.menu_items for select to authenticated using ((select public.is_staff()));
