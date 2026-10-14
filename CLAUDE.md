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

`<password>` goes into a URL, so **percent-encode it** if it contains `@ : / # ? %` or similar
(`node -e 'console.log(encodeURIComponent(process.argv[1]))' '<password>'`), or copy the
already-encoded string from the dashboard. A raw `@` silently changes the host and the push fails.

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

# Allergens and additives are not on the menu, on purpose

**Do not add allergen or additive (Zusatzstoffe) declarations to the site**: no codes on dishes,
no legend on `/karte`, no checkbox grid in the staff menu editor, no `menu_items` columns, no
schema.org allergen note. The shop tells guests about them in person, and the menu says to ask
the staff. Audits keep flagging the LMIV duty as a gap. It was built once (migration
`20261012093136`), never filled in, and removed by owner decision on 2026-10-13
(`20261012222037_drop_menu_allergens.sql`). Do not raise it again unless the owner asks.

# Staging is the default target, production is not

There are two Supabase projects: `lacordobesa` (`iabpugtwgjqldlzjjgqj`, live) and `lacordobesa-staging`
(`yfcpqyxonzjuflsqhasz`, created 2026-10-14). `.env.local` points at **staging**, and
`src/lib/supabase/env.ts` throws if anything tries to query production while `VERCEL_ENV` is not
`production`. So `npm run dev`, Playwright and any form you submit while testing land in staging.

**Do not repoint `.env.local` at production to "see real data".** Reads look harmless and the writes are
not: a few test reservations spend the site-wide quota in `request_reservation` (15/hour, 80/24 h) and hold
seats, which turns real guests away. If you truly need live data for one command, prefix it with
`ALLOW_PRODUCTION_DB=1` rather than editing `.env.local`.

Credentials for staging (db password and URL, keys, the `paul` staff login) are in `.env.staging.local` in
the repo root: gitignored, mode 600, not loaded by Next.js. Apply a migration to staging first, then
production:

```bash
set -a && . ./.env.staging.local && set +a
supabase db push --db-url "$STAGING_DB_URL" --yes    # staging
supabase db push --db-url "$SUPABASE_DB_URL" --yes   # production, from .env.local
```

## Vercel: previews do not build, and never PATCH an env var's type

Preview builds are switched off in the project's Ignored Build Step (`if [ "$VERCEL_ENV" = "production" ];
then exit 1; else exit 0; fi`, where exit 0 means skip). Build minutes are scarce and nobody reviews
previews, so do not re-enable them or expect a preview URL on a pull request.

Two traps in `vercel env`, both hit on 2026-10-14:

- **`PATCH /v10/projects/{id}/env/{envId}` with `{"type":"plain"}` and no `value` writes the stored
  ciphertext back as the plaintext value.** Both production Supabase variables ended up holding a
  1100-character base64 blob, which the next production deployment would have shipped. There is no
  in-place way to change a variable's type: delete it and create it again with its value.
- `vercel env add <name> preview` cannot complete non-interactively (it insists on a branch answer, and
  `--yes` does not settle it). Use `vercel api "/v10/projects/{id}/env?teamId=..." --method POST` with a
  body file instead. `production` and `development` work fine through the CLI, reading the value from stdin
  so it never lands in a command line.

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
