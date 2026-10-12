-- Staff allowlist. Being signed in is no longer enough to edit content or read reservations:
-- the user must also have a row in public.staff. Rows are added from the Supabase dashboard
-- (Table Editor or SQL) — there is intentionally no API path to insert them.
-- Applied to project iabpugtwgjqldlzjjgqj on 2026-10-12.

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.staff enable row level security;
-- Each signed-in user may only see their own row; is_staff() relies on this.
create policy "own row" on public.staff for select to authenticated using (user_id = (select auth.uid()));

-- SECURITY INVOKER on purpose: it only sees the caller's own row, so anon and non-staff get false.
create or replace function public.is_staff()
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- Grandfather the existing team: confirmed accounts on the staff e-mail domain. A self-registered
-- stranger cannot have one of these, because confirmation mail to *.local is undeliverable.
insert into public.staff (user_id)
select id from auth.users
where email like '%@staff.lacordobesa.local' and email_confirmed_at is not null
on conflict do nothing;

-- Replace the "any authenticated user" policies with the allowlist. Writes are split per command
-- so "public read" stays the only SELECT policy (no duplicate permissive policies).
do $$
declare t text;
begin
  foreach t in array array['site_settings', 'opening_hours', 'closures', 'menu_categories', 'menu_items', 'specials'] loop
    execute format('drop policy "staff write" on public.%I', t);
    execute format('create policy "staff insert" on public.%I for insert to authenticated with check ((select public.is_staff()))', t);
    execute format('create policy "staff update" on public.%I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t);
    execute format('create policy "staff delete" on public.%I for delete to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;

drop policy "staff all" on public.reservations;
create policy "staff all" on public.reservations for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Index the performance advisor asked for.
create index if not exists menu_items_category_id_idx on public.menu_items (category_id);
