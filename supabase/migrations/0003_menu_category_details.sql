-- Category subtitle (Spanish) and footnote shown under the category on the public menu.
alter table public.menu_categories
  add column label_secondary text,   -- e.g. "Para compartir"
  add column note text;              -- e.g. "Alle Gerichte werden mit Salat oder Pommes serviert."
