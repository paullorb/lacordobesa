-- The public site filtered is_available, blanked hidden prices and ignored closures.reason in app
-- code only, so anon PostgREST still returned unavailable dishes, prices of categories with
-- show_prices = false, and closure reasons. Enforce it in the database instead.

-- Anon reads dishes through a view: only available ones, price blanked for categories that hide
-- prices (pre-orderable dishes keep theirs, because an order line records the price). The view runs
-- as its owner, so the base table can stop being readable by anon.
create view public.menu_items_public with (security_invoker = false) as
select i.id, i.category_id, i.name, i.subtitle, i.description, i.description_es, i.description_en,
       case when coalesce(c.show_prices, true) or i.is_preorderable then i.price_label end as price_label,
       i.is_available, i.is_featured, i.sort_order, i.is_preorderable, i.preorder_unit,
       i.created_at, i.updated_at, c.label as category_label, c.sort_order as category_sort
from public.menu_items i
left join public.menu_categories c on c.id = i.category_id
where i.is_available;
revoke all on public.menu_items_public from public, anon, authenticated;
grant select on public.menu_items_public to anon, authenticated;

-- Closure reasons are for staff; the public site only needs the dates.
revoke select on public.closures from anon;
grant select (id, date) on public.closures to anon;
