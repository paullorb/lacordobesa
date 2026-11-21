-- Photos that arrived from outside the staff UI (the owners' shared iCloud album), one row per
-- source photo.
--
-- This is the "have we seen it already" ledger for scripts/sync-album.mjs, and it is deliberately
-- NOT a column on gallery_items: a row here outlives the gallery item it produced. When staff
-- delete an imported photo under /staff/gallery the item goes and gallery_item_id becomes null,
-- but the ledger row stays, so the next sync does not bring the photo straight back.
create table public.gallery_imports (
  source text not null,
  source_id text not null,
  gallery_item_id uuid references public.gallery_items (id) on delete set null,
  imported_at timestamptz not null default now(),
  primary key (source, source_id),
  constraint gallery_imports_source_len check (char_length(source) between 1 and 32),
  constraint gallery_imports_source_id_len check (char_length(source_id) between 1 and 128)
);

comment on table public.gallery_imports is
  'Ledger of externally imported gallery photos (source + the source''s own photo id). Kept after the gallery item is deleted so a sync never re-imports it.';

-- No policies on purpose: only the secret key (src/app/api/gallery-sync/route.ts) reads or writes it.
alter table public.gallery_imports enable row level security;
revoke all on public.gallery_imports from anon, authenticated;
