# Database changes go through the CLI, not the MCP connector

`supabase/migrations/` is the source of truth for this project's schema. To change it:

1. Write a new file in `supabase/migrations/` named `<UTC timestamp>_<name>.sql`
   (`date -u +%Y%m%d%H%M%S`) — the version must sort after every existing file.
2. Apply it with `supabase db push`.

Use timestamps, not sequential numbers. `db push` matches local filenames against the
versions recorded in the remote `supabase_migrations.schema_migrations`, and it refuses to
apply anything that sorts before the latest remote version. The old `0001_`-style names
sorted before every timestamp the MCP connector had written, so `db push` rejected the
whole set and the repo silently drifted from the live database.

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
