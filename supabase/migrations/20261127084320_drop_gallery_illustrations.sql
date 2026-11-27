-- The five seed illustrations from 20261012085100_gallery.sql were placeholders until real photos
-- came in. The owner asked for them to go (2026-11-27). They have no storage object (their image_url
-- points into /public), so deleting the rows is all there is. Matched by path so a staff-uploaded
-- photo can never be caught.
delete from public.gallery_items
where storage_path is null
  and image_url in (
    '/assets/gallery/lokal.svg',
    '/assets/gallery/empanadas.svg',
    '/assets/gallery/alfajores.svg',
    '/assets/gallery/merienda.svg',
    '/assets/gallery/feier.svg'
  );
