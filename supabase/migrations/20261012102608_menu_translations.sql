-- Spanish and English dish descriptions.
--
-- Only `description` is translatable, and on purpose. Dish *names* are already Spanish on this menu
-- ("Empanadas", "Torta de chocolate", "Flan casero") and work unchanged in all three languages;
-- translating them would make the carta less recognisable, not more. What a non-German speaker
-- cannot read is the German description underneath.
--
-- Both columns are nullable and fall back to the German text (see getMenu), so the menu is never
-- blank in Spanish or English. The public menu page says so when a description is untranslated,
-- rather than quietly showing German text under an English heading.
--
-- Specials and category labels are left alone: a special lives for a few days, and asking the team
-- to write every one of them three times is how a feature stops being used.

alter table public.menu_items
  add column description_es text,
  add column description_en text;

alter table public.menu_items
  add constraint menu_items_description_es_len check (description_es is null or char_length(description_es) <= 500),
  add constraint menu_items_description_en_len check (description_en is null or char_length(description_en) <= 500);

comment on column public.menu_items.description_es is 'Spanish description; falls back to description when null';
comment on column public.menu_items.description_en is 'English description; falls back to description when null';
