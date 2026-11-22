-- Push notifications for the staff iPhone app (capacitor.config.ts, docs/mobile-app.md).
--
-- One row per device that switched notifications on: the APNs device token and the staff member
-- who did it. Every new reservation, pre-order and catering inquiry is pushed to every row
-- (src/lib/native-push.ts), so the team learns about a request without having to look.
--
-- Nobody reads or writes the table directly. Staff go through the two functions below, which only
-- ever touch the caller's own device; the sender reads it with the secret key. A token is a device,
-- not a person, so registering a token that is already here moves it to whoever is signed in now:
-- a shared shop phone must not keep notifying the person who used it before.
--
-- Removing someone from the team deletes their devices with their staff row.

create table public.staff_push_tokens (
  token text primary key check (length(token) between 32 and 512),
  user_id uuid not null references public.staff (user_id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_push_tokens_user_id_idx on public.staff_push_tokens (user_id);

alter table public.staff_push_tokens enable row level security;
revoke all on table public.staff_push_tokens from public, anon, authenticated;
grant select, delete on table public.staff_push_tokens to service_role;

comment on table public.staff_push_tokens is
  'APNs device tokens of staff who switched on notifications in the iPhone app. Written only through register_push_token / unregister_push_token.';

create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  insert into public.staff_push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Only the caller's own row: switching off on one phone never silences someone else's.
create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.staff_push_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;
