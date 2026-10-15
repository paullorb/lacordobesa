-- Consent-free analytics: daily counters, never a row per visitor.
--
-- One row per (day, event, detail, path, referrer, device, browser, lang) with a hit count. There is
-- no visitor id, no session id, no IP and no timestamp finer than the day, so nothing in here can be
-- joined back to a person or followed from one day to the next. The browser sends no identifier and
-- stores nothing; the server derives the coarse dimensions (browser family, language) from request
-- headers, buckets them, and throws the headers away.
--
-- Writes come from the Route Handler at /api/a on the secret key. Granting the ingest function to
-- anon would let anyone holding the publishable key (it ships in every browser) skip the handler's
-- validation, bot filter and rate limit and write whatever they like into the counters, which is the
-- same hole 20261014072715 closed for the form RPCs.
--
-- Staff read through RLS (is_staff), either directly or through analytics_breakdown.

create table public.analytics_daily (
  day date not null,
  event text not null,
  detail text not null default '',
  path text not null default '',
  referrer text not null default '',
  device text not null default '',
  browser text not null default '',
  lang text not null default '',
  hits integer not null default 0,
  primary key (day, event, detail, path, referrer, device, browser, lang),
  constraint analytics_daily_len check (
    char_length(event) <= 40 and char_length(detail) <= 40 and char_length(path) <= 80
    and char_length(referrer) <= 60 and char_length(device) <= 20
    and char_length(browser) <= 20 and char_length(lang) <= 10
  )
);
create index analytics_daily_event_day_idx on public.analytics_daily (event, day);

alter table public.analytics_daily enable row level security;
revoke all on table public.analytics_daily from anon, authenticated;
grant select on table public.analytics_daily to authenticated;
grant select, insert, update on table public.analytics_daily to service_role;

create policy "staff read" on public.analytics_daily
  for select to authenticated using ((select public.is_staff()));

-- The day is Frankfurt's, so "today" on the staff page matches the shop's day.
create or replace function public.track_event(
  p_event text, p_detail text, p_path text, p_referrer text,
  p_device text, p_browser text, p_lang text
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.analytics_daily (day, event, detail, path, referrer, device, browser, lang, hits)
  values (
    (now() at time zone 'Europe/Berlin')::date,
    p_event, coalesce(p_detail, ''), coalesce(p_path, ''), coalesce(p_referrer, ''),
    coalesce(p_device, ''), coalesce(p_browser, ''), coalesce(p_lang, ''), 1
  )
  on conflict (day, event, detail, path, referrer, device, browser, lang)
  do update set hits = public.analytics_daily.hits + 1;
$$;

revoke execute on function public.track_event(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_event(text, text, text, text, text, text, text) to service_role;

-- One dimension of one event over a date range, summed. Keeps the staff page to a handful of small
-- results instead of pulling every row through PostgREST's row limit.
create or replace function public.analytics_breakdown(
  p_from date, p_to date, p_event text, p_by text, p_detail text default null
)
returns table(bucket text, total bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not staff' using errcode = '42501';
  end if;
  if p_by not in ('day', 'detail', 'path', 'referrer', 'device', 'browser', 'lang') then
    raise exception 'unknown dimension %', p_by using errcode = '22023';
  end if;

  return query execute format(
    'select %1$I::text, sum(hits)::bigint
       from public.analytics_daily
      where day between $1 and $2 and event = $3 and ($4 is null or detail = $4)
      group by 1
      order by 2 desc',
    p_by
  ) using p_from, p_to, p_event, p_detail;
end;
$$;

revoke execute on function public.analytics_breakdown(date, date, text, text, text) from public, anon;
grant execute on function public.analytics_breakdown(date, date, text, text, text) to authenticated;

do $$
declare leaked text;
begin
  select string_agg(p.proname, ', ') into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('track_event', 'analytics_breakdown')
    and has_function_privilege('anon', p.oid, 'execute');
  if leaked is not null then
    raise exception 'analytics functions callable with the publishable key: %', leaked;
  end if;
  if has_table_privilege('anon', 'public.analytics_daily', 'select') then
    raise exception 'analytics_daily readable with the publishable key';
  end if;
end $$;
