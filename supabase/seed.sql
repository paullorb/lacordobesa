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

-- Menu: see seed_menu.sql
