-- English comes back as a third public language (#104).
--
-- Dish descriptions already have an English column (menu_items.description_en, 20261012102608) and
-- the public view exposes it, so the only database change is the guest's language: reservations.locale
-- and preorders.locale were created as `in ('de', 'es')` (20261014033611), and request_reservation() /
-- request_preorder() map anything outside that pair back to 'de'.
--
-- Three things change, all of them only the list of accepted languages:
--   1. reservations_locale_check accepts 'en'
--   2. preorders_locale_check accepts 'en'
--   3. the two RPCs keep an 'en' they are given instead of turning it into 'de'
--
-- Ordering with the deploy is deliberately forgiving. If the site ships first, the English forms send
-- p_locale = 'en' to the *old* RPCs, which store 'de': the booking succeeds, and the guest gets the
-- German confirmation e-mail and German management link instead of English ones. Nothing fails. Once
-- this migration is applied, new English bookings are stored as 'en' and answered in English.
--
-- The RPCs are rewritten from their live definition (pg_get_functiondef) rather than restated here,
-- so whatever else the live body contains (quotas, locks, later fixes) is carried over untouched, and
-- `create or replace` keeps the grants 20261014072715 set. If the live body does not contain the
-- expected `in ('de', 'es')` test the migration stops, rather than quietly changing nothing.

alter table public.reservations drop constraint reservations_locale_check;
alter table public.reservations
  add constraint reservations_locale_check check (locale in ('de', 'es', 'en'));

alter table public.preorders drop constraint preorders_locale_check;
alter table public.preorders
  add constraint preorders_locale_check check (locale in ('de', 'es', 'en'));

do $$
declare
  fn regprocedure;
  def text;
  patched text;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('request_reservation', 'request_preorder')
  loop
    def := pg_get_functiondef(fn);
    patched := replace(def, 'p_locale in (''de'', ''es'')', 'p_locale in (''de'', ''es'', ''en'')');
    if patched = def then
      raise exception '% does not contain the expected locale test; refusing to guess', fn;
    end if;
    execute patched;
  end loop;
end $$;

comment on column public.reservations.locale is 'Language the guest booked in (de, es or en); picks the language of the confirmation e-mail and the management link.';
comment on column public.preorders.locale is 'Language the guest ordered in (de, es or en); picks the language of the link staff send back.';
