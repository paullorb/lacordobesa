/**
 * Invariants about the schema itself, rather than about any one request.
 *
 * These are the things that are true of the whole database and that no single feature test would
 * notice going wrong: a new table shipped with row level security off, a SECURITY DEFINER function
 * without a pinned `search_path`, or a grant quietly widening. All three are reachable only through
 * the catalog, which the REST API does not expose, so this file goes through `psql` and
 * `STAGING_DB_URL`.
 *
 * The grant matrix is kept here as a snapshot on purpose. It is long and boring, and that is the
 * point: a diff on it is the only cheap way to see that `anon` picked up execute on something, and
 * a widening grant is exactly the change that looks harmless in a migration and reopens the quota
 * bypass that 20261014072715 closed.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const PRODUCTION_PROJECT_REF = "iabpugtwgjqldlzjjgqj";
const dbUrl = process.env.STAGING_DB_URL;

if (dbUrl?.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("STAGING_DB_URL points at production. These tests must not run there.");
}

const hasPsql = (() => {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Whether the database actually answers, not just whether a URL was supplied.
 *
 * `db.<ref>.supabase.co` resolves to an **IPv6** address only, and plenty of places have no IPv6:
 * CLAUDE.md records it for Docker, and a GitHub Actions runner is the same. Without this probe the
 * nine tests below each fail with "Network is unreachable", which reads as nine policy regressions
 * rather than as one unreachable host. Use the IPv4 pooler there:
 * postgresql://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
 */
const reachable = (() => {
  if (!dbUrl || !hasPsql) return false;
  try {
    // stderr is piped, not ignored, for two reasons. `error.message` is the only other thing to
    // report and Node builds it from the whole command line, which here is the password-bearing
    // STAGING_DB_URL: the skip reason below printed it once for each of the nine tests. Piping
    // also lets the IPv6 detection read what psql actually said.
    execFileSync("psql", [dbUrl, "-At", "-c", "select 1"], {
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 20_000,
    });
    return true;
  } catch (error) {
    const said = (error.stderr ?? "").toString().trim();
    return said ? scrub(said) : "psql did not answer and said nothing";
  }
})();

/** A connection string carries the password in it, so no URL survives into a printed reason. */
function scrub(text) {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "<db-url>");
}

const skip = !dbUrl
  ? "no STAGING_DB_URL, set it in .env.staging.local"
  : !hasPsql
    ? "psql is not installed"
    : reachable !== true
      ? `the database did not answer. ${/unreachable|Network/i.test(String(reachable)) ? "The direct host is IPv6 only; use the IPv4 pooler (see the comment above)." : String(reachable).slice(0, 200)}`
      : false;

/**
 * One query, as an array of rows, each row an array of fields.
 *
 * `-At` is unaligned, tuples-only output. The field separator is a literal ASCII SOH (0x01), which
 * is invisible in a terminal and cannot occur in any value here. Do not "tidy" it to psql's default
 * `|`: a policy expression or a function body routinely contains a pipe and would split into
 * phantom columns. An empty separator is worse still, because then every row splits into single
 * characters and a one-column query silently compares equal to [].
 */
function query(sql) {
  const out = execFileSync("psql", [dbUrl, "-At", "-F", "", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split(""));
}

describe("row level security", () => {
  test("is enabled on every table in public", { skip }, async () => {
    // A table with RLS off is fully readable and writable by anyone holding the publishable key,
    // which ships in the browser.
    const unprotected = query("select tablename from pg_tables where schemaname='public' and not rowsecurity order by 1").flat();
    assert.deepEqual(unprotected, [], "these tables have row level security switched off");
  });

  test("every table either has a policy or is deliberately closed to everyone", { skip }, async () => {
    const withoutPolicies = query(`
      select t.tablename from pg_tables t
      where t.schemaname = 'public'
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
      order by 1`).flat();
    // request_quota is RLS-on with no policies by design (migration 20261012215042): only the
    // service role, which bypasses RLS, may touch it.
    assert.deepEqual(withoutPolicies, ["request_quota"], "the set of policy-less tables changed");
  });

  test("no policy is open to anon for writing", { skip }, async () => {
    // A public write has to go through a SECURITY DEFINER function so it can be validated and rate
    // limited. A policy letting anon INSERT or UPDATE directly would walk past all of that.
    const writable = query(`
      select tablename || ' / ' || policyname || ' / ' || cmd
      from pg_policies
      where schemaname = 'public'
        and cmd <> 'SELECT'
        and ('anon' = any (roles) or 'public' = any (roles))
      order by 1`).flat();
    assert.deepEqual(writable, [], "a write policy is open to the anonymous key");
  });
});

describe("SECURITY DEFINER functions", () => {
  test("every one pins its search_path", { skip }, async () => {
    // Without `set search_path`, a SECURITY DEFINER function resolves unqualified names against the
    // caller's path, so a caller who can create a schema can shadow a table the function trusts and
    // have it run as the owner. This is also what Supabase's own advisor flags.
    const unpinned = query(`
      select p.proname from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      order by 1`).flat();
    assert.deepEqual(unpinned, [], "these SECURITY DEFINER functions do not pin search_path");
  });

  test("the functions that write guest data run as definer, so RLS cannot be the only guard", { skip }, async () => {
    const definers = query(`
      select p.proname from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef order by 1`).flat();
    for (const name of ["request_reservation", "request_preorder", "join_waitlist", "request_event_inquiry", "subscribe_broadcast", "request_broadcast_email"]) {
      assert.ok(definers.includes(name), `${name} is not SECURITY DEFINER, so it cannot insert past RLS`);
    }
  });
});

describe("the grant matrix", () => {
  /** proname -> "anon,authenticated,service_role" execute flags, as psql renders booleans.
   *  Update deliberately: a change here should be a line in a migration, not a surprise. */
  const EXPECTED = {
    analytics_breakdown: "false,true,true",
    arrange_menu_categories: "false,true,true",
    arrange_menu_items: "false,true,true",
    cancel_preorder_by_token: "true,false,true",
    cancel_reservation_by_token: "true,false,true",
    confirm_broadcast_email: "true,false,true",
    create_preorder_manually: "false,true,true",
    is_admin: "false,true,true",
    is_staff: "false,true,true",
    join_waitlist: "false,false,true",
    manage_token_valid: "true,true,true",
    move_reservation_by_token: "true,false,true",
    phone_key: "true,true,true",
    preorder_by_token: "true,false,true",
    preorder_settings: "true,true,true",
    request_event_inquiry: "false,false,true",
    request_broadcast_email: "false,false,true",
    request_preorder: "false,false,true",
    request_reservation: "false,false,true",
    reservation_availability: "true,false,true",
    reservation_by_token: "true,false,true",
    reservation_settings: "true,true,true",
    set_updated_at: "true,true,true",
    subscribe_broadcast: "false,false,true",
    take_request_quota: "false,false,true",
    track_event: "false,false,true",
    unsubscribe_broadcast: "true,false,true",
  };

  const actual = () =>
    Object.fromEntries(
      query(`
        select p.proname,
          has_function_privilege('anon', p.oid, 'execute')::text || ',' ||
          has_function_privilege('authenticated', p.oid, 'execute')::text || ',' ||
          has_function_privilege('service_role', p.oid, 'execute')::text
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' order by 1`),
    );

  test("has not widened or narrowed", { skip }, async () => {
    assert.deepEqual(actual(), EXPECTED);
  });

  test("gives anon execute on nothing that writes guest data", { skip }, async () => {
    const WRITERS = ["request_reservation", "request_preorder", "join_waitlist", "request_event_inquiry", "subscribe_broadcast", "track_event", "take_request_quota", "create_preorder_manually"];
    const current = actual();
    for (const name of WRITERS) {
      assert.ok(current[name], `${name} has gone from the database`);
      assert.equal(current[name].split(",")[0], "false", `anon can call ${name}; the per-address quota can be skipped`);
    }
  });

  test("names every function the application calls", { skip }, async () => {
    // A function renamed in a migration but not in the app fails at runtime with "could not find
    // the function", which only shows up when a guest submits the form.
    const current = actual();
    for (const name of Object.keys(EXPECTED)) {
      assert.ok(name in current, `${name} is in the expected matrix but not in the database`);
    }
  });
});

describe("the migration history matches the files on disk", () => {
  test("every file in supabase/migrations has been applied to staging", { skip }, async () => {
    // The repo is the source of truth (CLAUDE.md) and this is the drift that already happened once:
    // migrations 0004, 0007 and 0008 were in the repo but never reached the live database.
    const applied = new Set(query("select version from supabase_migrations.schema_migrations order by 1").flat());
    const { readdirSync } = await import("node:fs");
    const onDisk = readdirSync(new URL("../../supabase/migrations/", import.meta.url))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);
    const missing = onDisk.filter((version) => !applied.has(version));
    assert.deepEqual(missing, [], "these migrations are in the repo but not applied to staging");
  });
});
