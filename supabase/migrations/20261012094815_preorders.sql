-- Pre-orders for pickup: empanadas by the dozen, a torta for Saturday, a tray of alfajores.
--
-- Shaped like the reservation flow on purpose, because the threat model is identical: anon can call
-- request_preorder() straight through the REST API, so every limit lives inside the function rather
-- than in the Server Action in front of it.
--
-- Lines snapshot the dish name and price label at order time. A menu edit three weeks later must not
-- rewrite what the guest actually ordered, and a deleted dish must not erase an order's contents.

-- Which dishes can be pre-ordered at all, and in what unit. Staff decide per dish: a torta makes
-- sense to order ahead, a cortado does not.
alter table public.menu_items
  add column is_preorderable boolean not null default false,
  add column preorder_unit text not null default 'Stück';

alter table public.menu_items
  add constraint menu_items_preorder_unit_len check (char_length(preorder_unit) between 1 and 24);

create index menu_items_preorderable_idx on public.menu_items (is_preorderable) where is_preorderable;

create type public.preorder_status as enum ('pending', 'confirmed', 'ready', 'collected', 'cancelled');

create table public.preorders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  pickup_date date not null,
  pickup_time time not null,
  status public.preorder_status not null default 'pending',
  notes text,                   -- from the guest ("Schrift auf der Torte: Feliz cumple Mia")
  staff_notes text,             -- internal
  source text not null default 'web',
  manage_token text not null default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preorders_name_len  check (char_length(name)  <= 100),
  constraint preorders_phone_len check (char_length(phone) <= 30),
  constraint preorders_email_len check (email is null or char_length(email) <= 254),
  constraint preorders_notes_len check (notes is null or char_length(notes) <= 500),
  constraint preorders_staff_notes_len check (staff_notes is null or char_length(staff_notes) <= 2000)
);
create index preorders_pickup_idx on public.preorders (pickup_date, pickup_time);
create index preorders_created_at_idx on public.preorders (created_at desc);
create index preorders_phone_key_idx on public.preorders (public.phone_key(phone));
create unique index preorders_manage_token_idx on public.preorders (manage_token);
create trigger preorders_updated_at before update on public.preorders
  for each row execute function public.set_updated_at();

create table public.preorder_lines (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.preorders(id) on delete cascade,
  -- Nulled rather than cascaded if the dish is ever deleted: the snapshot below keeps the order readable.
  menu_item_id uuid references public.menu_items(id) on delete set null,
  label text not null,          -- dish name as it read when ordered
  unit_label text not null,     -- "Stück", "Dutzend", "Torte"
  price_label text,             -- price as it read when ordered, free text like on the menu
  quantity int not null check (quantity between 1 and 200),
  constraint preorder_lines_label_len check (char_length(label) <= 120),
  constraint preorder_lines_unit_len check (char_length(unit_label) <= 24)
);
create index preorder_lines_preorder_id_idx on public.preorder_lines (preorder_id);

-- ---------------------------------------------------------------- RLS
alter table public.preorders enable row level security;
alter table public.preorder_lines enable row level security;

-- Guests never read these directly; they go through request_preorder() and preorder_by_token().
create policy "staff all" on public.preorders for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff all" on public.preorder_lines for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------------------------------------------------------------- settings
-- Edited under Einstellungen, same shape as the 'reservations' key.
create or replace function public.preorder_settings()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(
    (select value from public.site_settings where key = 'preorders'),
    '{"enabled": true, "min_lead_hours": 24, "max_days_ahead": 60,
      "max_lines": 12, "max_quantity": 50}'::jsonb
  );
$$;

insert into public.site_settings (key, value)
values ('preorders', '{"enabled": true, "min_lead_hours": 24, "max_days_ahead": 60, "max_lines": 12, "max_quantity": 50}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- public entry point
-- p_lines is [{"item_id": "<uuid>", "quantity": 12}, ...]. Each line is checked against menu_items,
-- so a crafted POST cannot order something that is not offered for pre-order or is sold out.
create or replace function public.request_preorder(
  p_name text, p_phone text, p_email text,
  p_pickup_date date, p_pickup_time time, p_lines jsonb, p_notes text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  -- Abuse limits, mirroring request_reservation(). A bakery never approaches these honestly.
  max_name_len      constant int := 100;
  max_phone_len     constant int := 30;
  max_email_len     constant int := 254;
  max_notes_len     constant int := 500;
  max_per_contact_24h constant int := 3;
  max_open_per_phone  constant int := 3;
  max_global_1h     constant int := 15;
  max_global_24h     constant int := 60;

  s jsonb := public.preorder_settings();
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_phone_key text;
  line jsonb;
  line_count int := 0;
  item record;
  oh record;
  new_id uuid;
  new_token text;
begin
  if not (s->>'enabled')::boolean then
    raise exception 'preorders_disabled' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_name, '')) > max_name_len or char_length(coalesce(p_phone, '')) > max_phone_len
     or char_length(coalesce(p_email, '')) > max_email_len or char_length(coalesce(p_notes, '')) > max_notes_len then
    raise exception 'field_too_long' using errcode = 'P0001';
  end if;
  v_phone_key := public.phone_key(v_phone);
  if char_length(v_name) < 2
     or v_phone !~ '^[0-9+()./ -]+$' or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;

  -- Pickup window: far enough ahead to actually bake it, not beyond the planning horizon, and
  -- during opening hours on a day the shop is open.
  if p_pickup_date > (now() at time zone 'Europe/Berlin')::date + ((s->>'max_days_ahead')::int) then
    raise exception 'too_far_ahead' using errcode = 'P0001';
  end if;
  if (p_pickup_date + p_pickup_time) at time zone 'Europe/Berlin'
       < now() + make_interval(hours => (s->>'min_lead_hours')::int) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.closures c where c.date = p_pickup_date) then
    raise exception 'closed_that_day' using errcode = 'P0001';
  end if;
  select * into oh from public.opening_hours h where h.weekday = extract(dow from p_pickup_date)::int;
  if not found or oh.is_closed then
    raise exception 'closed_that_day' using errcode = 'P0001';
  end if;
  if p_pickup_time < oh.opens or p_pickup_time > oh.closes then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_lines) > (s->>'max_lines')::int then
    raise exception 'too_many_lines' using errcode = 'P0001';
  end if;

  -- Quotas, serialized per phone number so a parallel burst cannot all pass the counts.
  perform pg_advisory_xact_lock(hashtext('preorder_phone:' || v_phone_key));

  if (select count(*) from public.preorders p
      where p.created_at > now() - interval '24 hours'
        and (public.phone_key(p.phone) = v_phone_key
             or (v_email is not null and lower(p.email) = lower(v_email)))) >= max_per_contact_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.preorders p
      where p.pickup_date >= (now() at time zone 'Europe/Berlin')::date
        and p.status in ('pending', 'confirmed', 'ready')
        and public.phone_key(p.phone) = v_phone_key) >= max_open_per_phone then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.preorders p where p.created_at > now() - interval '1 hour') >= max_global_1h
     or (select count(*) from public.preorders p where p.created_at > now() - interval '24 hours') >= max_global_24h then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  insert into public.preorders (name, phone, email, pickup_date, pickup_time, notes)
  values (v_name, v_phone, v_email, p_pickup_date, p_pickup_time, v_notes)
  returning id, manage_token into new_id, new_token;

  for line in select * from jsonb_array_elements(p_lines) loop
    line_count := line_count + 1;
    if (line->>'quantity')::int is null or (line->>'quantity')::int < 1
       or (line->>'quantity')::int > (s->>'max_quantity')::int then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;
    select mi.id, mi.name, mi.preorder_unit, mi.price_label into item
    from public.menu_items mi
    where mi.id = (line->>'item_id')::uuid and mi.is_preorderable and mi.is_available;
    if not found then
      raise exception 'item_unavailable' using errcode = 'P0001';
    end if;
    -- Snapshot the name, unit and price so a later menu edit cannot rewrite this order.
    insert into public.preorder_lines (preorder_id, menu_item_id, label, unit_label, price_label, quantity)
    values (new_id, item.id, item.name, item.preorder_unit, item.price_label, (line->>'quantity')::int);
  end loop;

  return new_token;
end $$;

-- ---------------------------------------------------------------- guest read / cancel by token
create or replace function public.preorder_by_token(p_token text)
returns table (
  name text,
  pickup_date date,
  pickup_time time,
  status public.preorder_status,
  notes text,
  lines jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.manage_token_valid(p_token) then return; end if;
  return query
    select p.name, p.pickup_date, p.pickup_time, p.status, p.notes,
           coalesce(
             (select jsonb_agg(jsonb_build_object('label', l.label, 'unit', l.unit_label,
                                                  'price', l.price_label, 'quantity', l.quantity)
                               order by l.label)
              from public.preorder_lines l where l.preorder_id = p.id),
             '[]'::jsonb)
    from public.preorders p
    where p.manage_token = p_token;
end $$;

create or replace function public.cancel_preorder_by_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.preorders;
begin
  if not public.manage_token_valid(p_token) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into p from public.preorders where manage_token = p_token for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p.status = 'cancelled' then
    return; -- Idempotent, like the reservation equivalent.
  end if;
  -- 'ready' is excluded on purpose: it is already baked, so cancelling is a conversation, not a click.
  if p.status not in ('pending', 'confirmed') then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  if p.pickup_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'in_the_past' using errcode = 'P0001';
  end if;
  update public.preorders set status = 'cancelled' where id = p.id;
end $$;

-- ---------------------------------------------------------------- grants
-- anon only, matching request_reservation(): the public flow has no session.
revoke execute on function public.request_preorder(text, text, text, date, time, jsonb, text) from public, authenticated;
grant  execute on function public.request_preorder(text, text, text, date, time, jsonb, text) to anon;
revoke execute on function public.preorder_by_token(text) from public, authenticated;
grant  execute on function public.preorder_by_token(text) to anon;
revoke execute on function public.cancel_preorder_by_token(text) from public, authenticated;
grant  execute on function public.cancel_preorder_by_token(text) to anon;
revoke execute on function public.preorder_settings() from public;
