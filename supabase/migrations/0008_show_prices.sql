-- Staff can hide the prices of a whole menu category on the public site (e.g. while prices are being revised).
-- The admin always sees the stored prices; only the public read path blanks them.
alter table public.menu_categories
  add column show_prices boolean not null default true;
