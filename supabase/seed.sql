-- Initial content. Mirrors what was hardcoded in the original static page.
insert into public.site_settings (key, value) values
  ('announcement', '{"text": "Hausgemacht mit Herz · Hecho en casa con cariño · Frankfurt am Main"}'),
  ('reservations', '{"enabled": true, "slot_minutes": 30, "duration_minutes": 90, "capacity_seats": 20, "max_party_size": 8, "min_lead_hours": 2, "max_days_ahead": 30, "last_seating_minutes_before_close": 60}');

-- Opening hours: Mon closed, Tue-Fri 16:00-22:00, Sat/Sun 11:30-22:00.
insert into public.opening_hours (weekday, opens, closes, is_closed) values
  (0, '11:30', '22:00', false),
  (1, null, null, true),
  (2, '16:00', '22:00', false),
  (3, '16:00', '22:00', false),
  (4, '16:00', '22:00', false),
  (5, '16:00', '22:00', false),
  (6, '11:30', '22:00', false);

insert into public.menu_categories (slug, label, sort_order) values
  ('salado', 'Salado', 1),
  ('clasicos', 'Clásicos', 2),
  ('dulce', 'Dulce', 3);

insert into public.menu_items (category_id, name, subtitle, description, price_label, is_featured, sort_order)
select c.id, v.name, v.subtitle, v.description, v.price_label, true, v.sort_order
from (values
  ('salado',   'Empanadas',            'Recién hechas',    'Handgefüllte Teigtaschen – zum Beispiel Criolla, de Pollo, Humita oder Espinaca y Ricota.', 'ab 4,50 €', 1),
  ('clasicos', 'Facturas & Medialunas','Para la merienda', 'Goldbraun gebacken und perfekt zum Kaffee – ein süßer Moment wie in Argentinien.', 'Hausgemacht', 2),
  ('dulce',    'Alfajores & Tortas',   'Algo dulce',       'Zarte Alfajores, Kuchen des Tages und weitere süße Spezialitäten aus unserer Backstube.', 'Kuchen des Tages', 3)
) as v(slug, name, subtitle, description, price_label, sort_order)
join public.menu_categories c on c.slug = v.slug;
