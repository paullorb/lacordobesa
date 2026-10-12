-- Full menu as printed on the restaurant's card (Aug 2026). Replaces whatever is in the menu tables.
-- Run after seed.sql. Prices are free text so "3,50 / 4,50 €" (klein / groß) works.
delete from public.menu_items;
delete from public.menu_categories;

insert into public.menu_categories (slug, label, label_secondary, note, sort_order) values
  ('vorspeise',    'Vorspeise',              'Para compartir',            null, 1),
  ('empanadas',    'Empanadas',              'Argentinische Spezialität', null, 2),
  ('pasta',        'Hausgemachte Pasta',     null,                        null, 3),
  ('clasico',      'Clásico Argentino',      null,                        null, 4),
  ('pizzas',       'Pizzas',                 null,                        null, 5),
  ('hauptgerichte','Hauptgerichte',          'Platos principales',        'Alle Gerichte werden mit Salat oder Pommes serviert.', 6),
  ('desserts',     'Desserts',               'Postres',                   null, 7),
  ('alkoholfrei',  'Alkoholfreie Getränke',  null,                        'Alle Getränke sind in klein und groß erhältlich.', 8),
  ('alkoholisch',  'Alkoholische Getränke',  null,                        null, 9),
  ('heiss',        'Heißgetränke',           null,                        null, 10),
  ('cocktails',    'Cocktails',              null,                        null, 11);

insert into public.menu_items (category_id, name, description, price_label, is_featured, sort_order)
select c.id, v.name, v.description, v.price, v.featured, v.sort
from (values
  -- Vorspeise
  ('vorspeise', 'Brot mit Alioli',        'Hausgemachtes Brot mit Knoblauchmayonnaise', '4,50 €', false, 1),
  ('vorspeise', 'Brot mit Chimichurri',   'Hausgemachtes Brot mit argentinischer Kräutersauce', '4,50 €', false, 2),
  ('vorspeise', 'Bruschetta',             'Geröstetes Brot mit Tomaten, Knoblauch und Olivenöl', '6,00 €', false, 3),
  ('vorspeise', 'Provoleta',              'Gegrillter Provolone-Käse mit Oregano', '5,00 €', false, 4),
  ('vorspeise', 'Tortilla de Patatas',    'Spanisches Kartoffelomelett mit Ei', '5,00 €', false, 5),
  ('vorspeise', 'Serrano und Käse Platte','Auswahl an Serrano-Schinken und Käse', '9,00 €', false, 6),
  ('vorspeise', 'Tabla „La Cordobesa“',   'Tortilla de Patatas, Provoleta, Chorizo criollo, hausgemachtes Brot, Chimichurri und zwei Empanadas', '25,00 €', false, 7),
  ('vorspeise', 'Pommes',                 'Pommes frites', '3,50 €', false, 8),
  -- Empanadas
  ('empanadas', 'Empanada Criolla',               'Gefüllte Teigtasche mit Rindfleisch, Zwiebeln und Paprika', '4,50 €', false, 1),
  ('empanadas', 'Empanada de Pollo',              'Gefüllte Teigtasche mit Geflügelfleisch', '4,50 €', false, 2),
  ('empanadas', 'Empanada de Espinaca y Ricota',  'Gefüllte Teigtasche mit Spinat und Ricotta', '4,50 €', false, 3),
  ('empanadas', 'Empanada de Humita',             'Gefüllte Teigtasche mit Mais und Käse', '4,50 €', false, 4),
  ('empanadas', 'Empanada Caprese',               'Gefüllte Teigtasche mit Tomate, Mozzarella und Basilikum', '4,50 €', false, 5),
  ('empanadas', 'Empanada de Fugazzetta',         'Gefüllte Teigtasche mit Zwiebeln und Käse', '4,50 €', false, 6),
  ('empanadas', 'Las Tres Empanadas',             'Drei Empanadas mit Beilagensalat', '12,00 €', true, 7),
  -- Pasta
  ('pasta', 'Sorrentinos de Espinaca y Ricota', 'Hausgemachter Nudelteig gefüllt mit Ricotta, Zwiebeln und Sahne, serviert mit Bolognese- oder Pestosauce', '9,00 €', false, 1),
  ('pasta', 'Lasagna',                          'Tomatensauce, Mozzarella und Schinken', '9,00 €', false, 2),
  -- Clásico
  ('clasico', 'Choripán', 'Argentinische Bratwurst im Brot mit Chimichurri', '7,00 €', false, 1),
  -- Pizzas
  ('pizzas', 'Margherita',              'Tomatensauce, Mozzarella und Basilikum', '8,00 €', false, 1),
  ('pizzas', 'Prosciutto',              'Tomatensauce, Mozzarella und Schinken', '9,50 €', false, 2),
  ('pizzas', 'Prosciutto Funghi',       'Tomatensauce, Mozzarella, Schinken und Champignons', '10,50 €', false, 3),
  ('pizzas', 'Salami',                  'Tomatensauce, Mozzarella und Salami', '9,50 €', false, 4),
  ('pizzas', '4 Quesos',                'Mozzarella, Gorgonzola, Emmentaler und Parmesan', '10,50 €', false, 5),
  ('pizzas', 'Parma, Rúcula & Schinken','Tomatensauce, Mozzarella, Parmaschinken und Rucola', '12,50 €', false, 6),
  ('pizzas', 'Extra Burrata',           null, '+ 1,50 €', false, 7),
  -- Hauptgerichte
  ('hauptgerichte', 'Bife de Chorizo (200 g)', 'Argentinisches Rindersteak vom Grill', '21,00 €', true, 1),
  ('hauptgerichte', 'Ojo de Bife',             'Saftiges Rib-Eye-Steak vom Grill', '25,00 €', false, 2),
  ('hauptgerichte', 'Milanesa',                'Paniertes Rindsschnitzel', '13,00 €', false, 3),
  ('hauptgerichte', 'Milanesa Napolitana',     'Paniertes Rindsschnitzel mit Tomatensauce, Schinken und Käse', '15,00 €', false, 4),
  -- Desserts
  ('desserts', 'Flan con Dulce de Leche', 'Karamellpudding mit argentinischer Karamellcreme', '5,00 €', true, 1),
  ('desserts', 'Tiramisú',                'Klassisches italienisches Dessert', '7,00 €', false, 2),
  ('desserts', 'Tarta del Día',           'Hausgemachter Kuchen des Tages', '6,00 €', false, 3),
  -- Alkoholfrei
  ('alkoholfrei', 'Coca-Cola / Coca-Cola Zero / Fanta / Sprite', null, '3,50 / 4,50 €', false, 1),
  ('alkoholfrei', 'Agua con Gas', 'Mineralwasser mit Kohlensäure', '3,00 / 4,00 €', false, 2),
  ('alkoholfrei', 'Agua sin Gas', 'Mineralwasser ohne Kohlensäure', '3,00 / 4,00 €', false, 3),
  ('alkoholfrei', 'Jugo / Zumo', 'Saft', '2,50 €', false, 4),
  -- Alkoholisch
  ('alkoholisch', 'Pils',                              null, '3,00 / 4,50 €', false, 1),
  ('alkoholisch', 'Pils alkoholfrei',                  null, '3,00 / 4,50 €', false, 2),
  ('alkoholisch', 'Franziskaner Weissbier',            null, '4,50 €', false, 3),
  ('alkoholisch', 'Franziskaner Weissbier alkoholfrei',null, '4,50 €', false, 4),
  ('alkoholisch', 'San Miguel',                        null, '4,00 €', false, 5),
  ('alkoholisch', 'San Miguel alkoholfrei',            null, '4,00 €', false, 6),
  -- Heißgetränke
  ('heiss', 'Americano',                     null, '3,50 €', false, 1),
  ('heiss', 'Kaffee',                        null, '2,50 €', false, 2),
  ('heiss', 'Espresso',                      null, '2,75 €', false, 3),
  ('heiss', 'Espresso Macchiato',            null, '2,75 €', false, 4),
  ('heiss', 'Doppelter Espresso',            null, '3,50 €', false, 5),
  ('heiss', 'Cappuccino',                    null, '3,00 €', false, 6),
  ('heiss', 'Latte Macchiato',               null, '4,00 €', false, 7),
  ('heiss', 'Dekoffinierter Kaffee',         null, '2,50 €', false, 8),
  ('heiss', 'Dekoffinierter Cappuccino',     null, '3,00 €', false, 9),
  ('heiss', 'Dekoffinierter Latte Macchiato',null, '4,00 €', false, 10),
  ('heiss', 'Tee',                           null, '2,50 €', false, 11),
  ('heiss', 'Eiskaffee',                     null, '4,50 €', false, 12),
  ('heiss', 'Heiße Schokolade',              null, '3,00 €', false, 13),
  -- Cocktails
  ('cocktails', 'Aperol Spritz',            null, '7,00 €', false, 1),
  ('cocktails', 'Fernet con Cola',          null, '7,00 €', false, 2),
  ('cocktails', 'Limoncello Spritz',        null, '7,00 €', false, 3),
  ('cocktails', 'Campari Orange',           null, '7,00 €', false, 4),
  ('cocktails', 'Negroni',                  null, '7,00 €', false, 5),
  ('cocktails', 'Gin Tonic',                null, '7,00 €', false, 6),
  ('cocktails', 'Lillét',                   null, '7,00 €', false, 7),
  ('cocktails', 'La Cordobesa',             null, '7,00 €', false, 8),
  ('cocktails', 'La Cordobesa alkoholfrei', null, '7,00 €', false, 9),
  ('cocktails', 'Prosecco',                 null, '6,00 €', false, 10)
) as v(slug, name, description, price, featured, sort)
join public.menu_categories c on c.slug = v.slug;
