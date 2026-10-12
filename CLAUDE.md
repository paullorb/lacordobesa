# Database changes go through the CLI, not the MCP connector

`supabase/migrations/` is the source of truth for this project's schema. To change it:

1. Write a new numbered file in `supabase/migrations/` (next free number).
2. Apply it with `supabase db push`.

The project ref is `iabpugtwgjqldlzjjgqj`; `supabase link --project-ref iabpugtwgjqldlzjjgqj`
once per checkout (there is no `supabase/config.toml` yet). If `supabase` hangs with no
output, it is waiting on the keychain for a stored token — run `supabase login` first.

**Do not use the Supabase MCP `apply_migration` tool, and do not use `execute_sql` for
DDL or writes.** Auto mode routes those through the permission classifier, which either
denies them or escalates to a prompt. A prompt in an unfocused session is never answered,
so the call parks indefinitely and the thread looks hung — this is how migrations
0004/0007/0008 ended up applied to the repo but not to the live database. `db push` fails
fast and leaves a reviewable file instead.

Reading the live database with MCP `execute_sql` is fine: `select` queries are allowlisted
and return in a couple of seconds.
