-- Allergen and additive declarations per dish.
--
-- Germany requires both on the menu: the 14 allergens of EU regulation 1169/2011 (LMIV, Anhang II)
-- and the additive classes of the Zusatzstoff-Zulassungsverordnung. Restaurants declare them with
-- the usual letter/number codes next to each dish plus a legend, which is what these columns store.
--
-- Codes are constrained to the known set, so no write path (including the REST API) can store a
-- code the legend cannot explain. The German labels live in src/lib/allergens.ts.

alter table public.menu_items
  add column allergens text[] not null default '{}',
  add column additives text[] not null default '{}';

alter table public.menu_items
  -- a..n = the 14 LMIV allergens, in the order of Anhang II.
  add constraint menu_items_allergens_valid
    check (allergens <@ array['a','b','c','d','e','f','g','h','i','j','k','l','m','n']::text[]),
  -- 1..13 = the additive classes a Gaststätte has to declare.
  add constraint menu_items_additives_valid
    check (additives <@ array['1','2','3','4','5','6','7','8','9','10','11','12','13']::text[]);

comment on column public.menu_items.allergens is
  'LMIV Anhang II allergen codes a..n; see ALLERGENS in src/lib/allergens.ts';
comment on column public.menu_items.additives is
  'Zusatzstoff classes 1..13; see ADDITIVES in src/lib/allergens.ts';
