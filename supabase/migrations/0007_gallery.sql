-- Photo gallery: staff upload pictures of the venue, food and events.
-- image_url is what the public site renders (a Storage public URL, or a site-relative path for seed data);
-- storage_path is only set for uploads, so deleting a row can also delete the file.
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  caption text,
  category text not null default 'venue' check (category in ('venue', 'food', 'events')),
  created_at timestamptz not null default now()
);
create index gallery_items_created_at_idx on public.gallery_items (created_at desc);

alter table public.gallery_items enable row level security;
create policy "public read" on public.gallery_items for select using (true);
create policy "staff insert" on public.gallery_items for insert to authenticated with check ((select public.is_staff()));
create policy "staff update" on public.gallery_items for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete" on public.gallery_items for delete to authenticated using ((select public.is_staff()));

-- Public bucket: files are served by URL without a SELECT policy, so nobody can list the bucket via the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "staff upload gallery" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_staff()));
create policy "staff delete gallery" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_staff()));

-- Seed examples (illustrations in /public/assets/gallery plus the hero photo). Staff can delete them in the staff area.
insert into public.gallery_items (image_url, caption, category, created_at) values
  ('/assets/hero-pasteleria.jpg', 'Empanadas und Gebäck frisch aus der Küche', 'food', now() - interval '1 minute'),
  ('/assets/gallery/lokal.svg', 'Unser Lokal am Ginnheimer Wäldchen', 'venue', now() - interval '2 minutes'),
  ('/assets/gallery/empanadas.svg', 'Empanadas hechas a mano', 'food', now() - interval '3 minutes'),
  ('/assets/gallery/alfajores.svg', 'Alfajores mit Dulce de Leche', 'food', now() - interval '4 minutes'),
  ('/assets/gallery/merienda.svg', 'Merienda: Mate und Medialunas', 'events', now() - interval '5 minutes'),
  ('/assets/gallery/feier.svg', 'Feiern bei La Cordobesa', 'events', now() - interval '6 minutes');
