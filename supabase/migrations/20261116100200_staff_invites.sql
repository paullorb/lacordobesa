-- Staff sign-up invites: single-use, expiring, issued by an admin.
--
-- /staff/signup used to be guarded by one long-lived value in the STAFF_SIGNUP_TOKEN environment
-- variable. Anyone holding the URL could create any number of staff accounts (which read all guest
-- contact details), the link never expired, and rotating the variable did not remove accounts that
-- had already been made. An invite replaces it:
--
--   - an admin creates it on the team page; the secret is shown once and only its SHA-256 is stored,
--     so a database read cannot recover a usable link;
--   - it expires (the app issues seven days), works for one sign-up, and can be revoked;
--   - the role is fixed by the admin when the invite is made, not chosen by whoever opens the link.
--
-- Claiming is one UPDATE ... WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
-- RETURNING, which is atomic: of two concurrent sign-ups on the same invite, one gets the row.
-- The table is reachable only with the secret key (the Server Actions); row-level security is on
-- with no policies and every grant to anon and authenticated is removed.

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  role text not null default 'staff',
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint staff_invites_role_valid check (role in ('admin', 'staff')),
  constraint staff_invites_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint staff_invites_note_len check (note is null or char_length(note) <= 80)
);

alter table public.staff_invites enable row level security;
revoke all on table public.staff_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_invites to service_role;

create index if not exists staff_invites_pending_idx on public.staff_invites (expires_at)
  where used_at is null and revoked_at is null;
create index if not exists staff_invites_created_by_idx on public.staff_invites (created_by);
create index if not exists staff_invites_used_by_idx on public.staff_invites (used_by);

comment on table public.staff_invites is 'Single-use, expiring staff sign-up links. Only the SHA-256 of the secret is stored. Service role only.';
