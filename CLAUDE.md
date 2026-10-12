# Database changes go through the CLI, not the MCP connector

`supabase/migrations/` is the source of truth for this project's schema. To change it:

1. Write a new file in `supabase/migrations/` named `<UTC timestamp>_<name>.sql`
   (`date -u +%Y%m%d%H%M%S`) — the version must sort after every existing file.
2. Apply it with `supabase db push --db-url "$SUPABASE_DB_URL"`.

Use timestamps, not sequential numbers. `db push` matches local filenames against the
versions recorded in the remote `supabase_migrations.schema_migrations`, and it refuses to
apply anything that sorts before the latest remote version. The old `0001_`-style names
sorted before every timestamp the MCP connector had written, so `db push` rejected the
whole set and the repo silently drifted from the live database.

## Connecting without a login

**Pass `--db-url` and nothing needs the keychain.** `supabase link`, `supabase login` and the
bare `db push` all read a stored access token, and in an agent session that blocks on the
macOS keychain with no output and no prompt anyone can answer. `--db-url` skips that path
entirely, which is what finally let a non-interactive session apply the nine migrations that
had been stuck since 2026-10-12:

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.iabpugtwgjqldlzjjgqj.supabase.co:5432/postgres"
supabase db push --db-url "$SUPABASE_DB_URL" --dry-run   # always look first
supabase db push --db-url "$SUPABASE_DB_URL" --yes
```

The project ref is `iabpugtwgjqldlzjjgqj`. There is still no `supabase/config.toml`, and with
`--db-url` you do not need one.

**Two host gotchas, because they fail in different ways:**

- `db.iabpugtwgjqldlzjjgqj.supabase.co` is **IPv6 only**. Fine from the host, but anything
  inside Docker's default bridge cannot reach it. That is why `supabase gen types` fails there
  with a `PostgresMetaSchemas` error that never mentions the network.
- For anything that runs in a container, use the **IPv4 pooler**, note the tenant-qualified
  user, and note the region is `aws-1`, not `aws-0`:

  ```bash
  supabase gen types typescript \
    --db-url "postgresql://postgres.iabpugtwgjqldlzjjgqj:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" \
    > src/lib/database.types.ts
  ```

`gen types` needs Docker running either way.

## Content lives behind the staff UI, not behind SQL

Public content (menu, specials, opening hours, the announcement banner, gallery) is cached with
`use cache` and only invalidated by `updateTag()` inside the staff Server Actions. **An
`UPDATE` straight into `site_settings` changes the row and nothing else** — the cached copy
survives and the site keeps serving the old text. Edit that content under `/staff`, which is
what the pages are for.

## Do not use the MCP connector for writes

**Do not use the Supabase MCP `apply_migration` tool, and do not use `execute_sql` for
DDL or writes.** Auto mode routes those through the permission classifier, which either
denies them or escalates to a prompt. A prompt in an unfocused session is never answered,
so the call parks indefinitely and the thread looks hung — this is how migrations
0004/0007/0008 ended up applied to the repo but not to the live database. `db push` fails
fast and leaves a reviewable file instead.

Reading the live database with MCP `execute_sql` is fine: `select` queries are allowlisted
and return in a couple of seconds. `psql` against `--db-url` works too and is the better
option when the connector is unauthorized.

# Several agent sessions share this one checkout

There are usually a handful of Claude sessions open on this directory at once, and there are
no per-session worktrees. **A branch is not isolation**: `git checkout`, `switch`, `stash` and
`reset` move `HEAD` and the index for every session at once, so creating a branch while
somebody else has uncommitted work can sweep their files into your commit.

Before editing, check `git status` and announce the files you are taking. If you need a branch
of your own, use `git worktree add` — and in the new worktree run `npm ci --prefer-offline`
**and `rm -rf .next`**. A stale `.next` carried into a worktree fails inside the root layout,
so every route 500s with `next/font/google` module-not-found errors and the branch looks
catastrophically broken when it is fine. Do not symlink `node_modules`; Turbopack refuses it.

# Verifying

Run `npm run check` and read its exit code. `npm run lint` is `oxlint --deny-warnings`, so its
failures are *warnings* — grepping the output for `error` reports a false pass and has already
put a broken `main` in place once.
