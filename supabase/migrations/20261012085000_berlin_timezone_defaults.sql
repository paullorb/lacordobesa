-- The shop runs on Berlin time; the database's current_date is UTC and lags by 1-2 hours around midnight.
alter table public.specials
  alter column starts_on set default ((now() at time zone 'Europe/Berlin')::date);
