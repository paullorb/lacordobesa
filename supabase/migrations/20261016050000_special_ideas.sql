-- The showcase above the specials sign-up: "ideas for what we may offer", shown before the visitor is
-- asked whether they want to hear about specials. Not promises and not dated, which is why this is its
-- own table and not a flag on `specials` (those have a start and end and appear as "Heute").
--
-- German is the base column; the Spanish and English columns are optional and fall back to German,
-- the same convention as menu_items (20261012102608). Edited under /staff/specials.
create table if not exists public.special_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  title_es text,
  title_en text,
  description_es text,
  description_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists special_ideas_updated_at on public.special_ideas;
create trigger special_ideas_updated_at before update on public.special_ideas
  for each row execute function public.set_updated_at();

alter table public.special_ideas enable row level security;

-- Visitors see active ideas only; staff see all of them. One select policy rather than two permissive
-- ones, which the multiple-permissive-policies advisor flags. The write policies are the split ones
-- from 20261012074936 / 20261014135246, and "staff write" (FOR ALL) is dropped in case it exists.
drop policy if exists "public read" on public.special_ideas;
drop policy if exists "public read active" on public.special_ideas;
drop policy if exists "staff write" on public.special_ideas;
drop policy if exists "staff insert" on public.special_ideas;
drop policy if exists "staff update" on public.special_ideas;
drop policy if exists "staff delete" on public.special_ideas;
create policy "public read active" on public.special_ideas for select
  using (is_active or (select public.is_staff()));
create policy "staff insert" on public.special_ideas for insert to authenticated
  with check ((select public.is_staff()));
create policy "staff update" on public.special_ideas for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff delete" on public.special_ideas for delete to authenticated
  using ((select public.is_staff()));

grant select on table public.special_ideas to anon, authenticated;
grant insert, update, delete on table public.special_ideas to authenticated;

-- Sample entries so the showcase is not empty on day one. Matched by title, so running this twice, or
-- after staff renamed or deleted one, never adds a duplicate of a row that is still there.
insert into public.special_ideas (title, description, title_es, title_en, description_es, description_en, sort_order)
select v.title, v.description, v.title_es, v.title_en, v.description_es, v.description_en, v.sort_order
from (values
  ('Pastelitos de membrillo',
   'Knusprig frittiert, mit Quittenpaste gefüllt und mit Zucker bestreut. Eine Spezialität aus dem Frühling, wenn das Wetter mitspielt.',
   'Pastelitos de membrillo',
   'Pastelitos de membrillo',
   'Fritos y crocantes, rellenos de dulce de membrillo y espolvoreados con azúcar. Una especialidad de primavera, si el tiempo acompaña.',
   'Crisp fried pastries filled with quince paste and dusted with sugar. A spring treat, weather permitting.',
   10),
  ('Empanada des Monats',
   'Jeden Monat eine neue Füllung, zum Beispiel Humita, Roquefort mit Birne oder Carne cortada a cuchillo.',
   'Empanada del mes',
   'Empanada of the month',
   'Cada mes un relleno nuevo, por ejemplo humita, roquefort con pera o carne cortada a cuchillo.',
   'A new filling every month, for example humita, blue cheese with pear or hand-cut beef.',
   20),
  ('Alfajores de maicena',
   'Zarte Maisstärke-Kekse mit Dulce de leche und Kokos, frisch gefüllt und nur in kleinen Mengen.',
   'Alfajores de maicena',
   'Alfajores de maicena',
   'Tiernas galletitas de maicena con dulce de leche y coco, rellenas al momento y en cantidades chicas.',
   'Tender cornstarch cookies with dulce de leche and coconut, filled fresh and only in small batches.',
   30),
  ('Pizza am Freitag',
   'Gelegentlich backen wir freitags argentinische Pizza, dick, mit viel Käse und Fainá dazu.',
   'Pizza de los viernes',
   'Friday pizza',
   'De vez en cuando horneamos pizza argentina los viernes, gruesa, con mucho queso y fainá al lado.',
   'Now and then we bake Argentine pizza on Fridays, thick and cheesy, with fainá on the side.',
   40)
) as v(title, description, title_es, title_en, description_es, description_en, sort_order)
where not exists (select 1 from public.special_ideas s where s.title = v.title);
