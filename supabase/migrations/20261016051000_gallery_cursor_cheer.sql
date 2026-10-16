-- Which gallery photos get the playful "¡Ñam!" cursor on hover.
--
-- The cursor suits a picture of something to eat and is odd over a picture of the room, so it is a
-- per-photo choice that staff can change under /staff/gallery. Existing food photos keep the cursor
-- they have today; everything else loses it.

alter table public.gallery_items add column if not exists cursor_cheer boolean not null default false;

update public.gallery_items set cursor_cheer = true where category = 'food' and cursor_cheer = false;

comment on column public.gallery_items.cursor_cheer is
  'Show the cheering cursor over this photo on the gallery page; set by staff, defaults on for food uploads';
