-- Drop the allergen and additive declarations from 20261012093136.
--
-- The site no longer declares them: staff tell guests about allergens and additives in person, and
-- the menu points them to the staff. No dish ever had a code stored, so nothing is lost.
-- See "Allergens and additives are not on the menu" in CLAUDE.md before adding them back.

alter table public.menu_items
  drop constraint if exists menu_items_allergens_valid,
  drop constraint if exists menu_items_additives_valid,
  drop column if exists allergens,
  drop column if exists additives;
