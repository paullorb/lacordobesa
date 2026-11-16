-- preorder_settings(): fall back per key, not only when the whole row is missing.
--
-- The function used to return the stored value as is and the defaults only when there was no row at
-- all. request_preorder() reads min_lead_hours, max_days_ahead, max_lines and max_quantity with
-- `(s->>'key')::int`, so a row that existed but lacked a key (a save of `{"enabled": true}` on a
-- database without the seeded row, or a key stored as null) made the limit NULL, and a comparison
-- with NULL is never true: the lead time, horizon, line cap and quantity cap were silently not
-- enforced. Defaults are the documented ones from 20261012094815.
--
-- Stored keys win over the defaults; a key stored as JSON null counts as absent. Only the function
-- changes, so request_preorder() and its grants stay as they are (create or replace keeps the ACL).

create or replace function public.preorder_settings()
returns jsonb language sql stable set search_path = public as $$
  select '{"enabled": true, "min_lead_hours": 24, "max_days_ahead": 60,
           "max_lines": 12, "max_quantity": 50}'::jsonb
         || coalesce(
              (select jsonb_strip_nulls(value)
                 from public.site_settings
                where key = 'preorders' and jsonb_typeof(value) = 'object'),
              '{}'::jsonb
            );
$$;
