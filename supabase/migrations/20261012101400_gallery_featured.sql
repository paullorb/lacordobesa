-- Let the gallery feed the landing page.
--
-- The landing page shipped with one bundled JPEG and the gallery seeded with SVG illustrations, so
-- the most appetising thing a restaurant has, its own food photography, could not reach the page
-- a visitor actually lands on. Staff upload photos already; this is what lets them choose which
-- ones carry the page.
--
-- `is_featured` picks the photos for the strip on the landing page. The hero image is a single
-- choice, so it lives in site_settings under key 'hero' as {"gallery_item_id": "<uuid>"} rather than
-- as a second flag that could be set on two rows at once.

alter table public.gallery_items add column is_featured boolean not null default false;

-- Partial: the landing page only ever asks for the featured ones.
create index gallery_items_featured_idx on public.gallery_items (is_featured, created_at desc) where is_featured;

comment on column public.gallery_items.is_featured is
  'Shown in the photo strip on the landing page; the hero is site_settings.hero.gallery_item_id';

insert into public.site_settings (key, value) values ('hero', '{}'::jsonb)
on conflict (key) do nothing;
