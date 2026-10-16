/**
 * Shared plumbing for the database tests.
 *
 * These are the tests the unit suite cannot be: 26 RPCs and seventeen tables with RLS on all of
 * them, none of which had a test before. They run against the **staging** project
 * (`lacordobesa-staging`), which exists so that tests can write, and they go through
 * `@supabase/supabase-js` rather than psql so that what is exercised is the same path the app
 * takes, grants and row level security included.
 *
 *   npm run test:integration
 *
 * Two clients, because almost every interesting question is about who is asking:
 *
 *  - `anon()` holds the publishable key, which is what ships in the browser. RLS and the function
 *    grants are the whole protection, so this is the client that proves they work.
 *  - `admin()` holds the secret key and bypasses RLS. Used only to arrange a fixture and to clean
 *    up, never to assert that something is reachable.
 *
 * ## Why cleanup is not optional
 *
 * `request_reservation` has a site-wide brake: 15 requests an hour and 80 a day, counted straight
 * off `reservations.created_at`. A test that leaves its rows behind spends that budget for every
 * later test *and* for the browser suite, and the failure it causes looks like a bug in the booking
 * form rather than like litter. Deleting the rows gives the budget back, so everything here books
 * through `track()` and `cleanup()` removes what it made.
 *
 * ## Refusing production
 *
 * `src/lib/supabase/env.ts` guards the app. It cannot guard this file, because these tests are not
 * the app, so the same refusal is repeated here: the production ref is hardcoded, and a URL
 * containing it stops the run before a client is ever built. There is no escape hatch on purpose.
 * Nothing in here is safe to run against live data, and a flag somebody can set is a flag somebody
 * will set.
 */
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "iabpugtwgjqldlzjjgqj";

const URL_VAR = process.env.STAGING_SUPABASE_URL ? "STAGING_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL";
const url = process.env.STAGING_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.STAGING_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// STAGING_SERVICE_ROLE_KEY first on purpose. `.env.staging.local` also carries a STAGING_SECRET_KEY
// in the newer `sb_secret_…` form, and as of 2026-10-16 that one is rejected with "Invalid API key"
// (rotated, or the new key format is not enabled on this project). The legacy service-role JWT
// works, so it is the one tried first and the other is kept as a fallback rather than removed.
const secret =
  process.env.STAGING_SERVICE_ROLE_KEY ?? process.env.STAGING_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (url?.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error(
    `${URL_VAR} points at the production project (${PRODUCTION_PROJECT_REF}). These tests write, ` +
      "so they must never run there. Point them at lacordobesa-staging (see .env.staging.local).",
  );
}

/** Why the suite cannot run, or false when it can. Mirrors the browser tests: a checkout with no
 *  credentials has to stay able to run `npm run check`, so this skips rather than fails. */
export const skip = !url
  ? "no Supabase URL, set STAGING_* in .env.staging.local"
  : !publishable
    ? "no publishable key, set STAGING_PUBLISHABLE_KEY"
    : !secret
      ? "no secret key, set STAGING_SECRET_KEY"
      : false;

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** The browser's client: publishable key, no session. Sees only what RLS exposes to `anon`. */
export const anon = () => createClient(url, publishable, options);

/** The server's client: bypasses RLS. For fixtures and cleanup only. */
export const admin = () => createClient(url, secret, options);

const staffUser = process.env.STAGING_STAFF_USER;
const staffPass = process.env.STAGING_STAFF_PASS;

/** Why the staff tests cannot run, or false. */
export const skipStaff = skip || (!staffUser || !staffPass ? "no STAGING_STAFF_USER / STAGING_STAFF_PASS" : false);

/**
 * A signed-in staff client, which is what the staff pages hold.
 *
 * Staff sign in with a short name, not an address, and `lib/staff.ts` maps it onto a synthetic
 * e-mail on a domain nobody receives mail on. The same mapping is repeated here rather than
 * imported, because this file is plain `.mjs` and the app module is TypeScript behind the `@/`
 * alias; if the domain in lib/staff.ts ever changes, this is the second place to change.
 *
 * It carries the `authenticated` role, so what it can reach is decided by the RLS policies and by
 * `is_staff()`, not by a key that bypasses them.
 */
export async function staff() {
  const email = staffUser.includes("@") ? staffUser.trim().toLowerCase() : `${staffUser.trim().toLowerCase()}@staff.lacordobesa.local`;
  const client = createClient(url, publishable, options);
  const { error } = await client.auth.signInWithPassword({ email, password: staffPass });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return client;
}

// ------------------------------------------------------------------ test data

/**
 * A phone number no real guest has, carrying a per-run id.
 *
 * It has to be a *different* number per test: `request_reservation` allows three requests per phone
 * number in 24 hours and three open future bookings, and refuses a second booking for the same day
 * outright (duplicate_booking). Tests that shared a number would fail in whatever order they
 * happened to run in.
 */
let counter = 0;
export const testPhone = () => `+4915${String(Date.now() % 100000).padStart(5, "0")}${String(counter++).padStart(3, "0")}`;

/** A name that says where the row came from, for anyone who finds one in the staging dashboard. */
export const TEST_NAME = "ZZ Test Harness";

const made = { reservations: [], preorders: [], waitlist_entries: [], event_inquiries: [], broadcast_optins: [] };

/** Remember a row so cleanup() deletes it. Returns the id, so a call can be wrapped. */
export function track(table, id) {
  if (id) made[table].push(id);
  return id;
}

/**
 * Delete everything the run created, and anything a crashed earlier run left behind.
 *
 * The sweep by name is what keeps the site-wide brake from being spent permanently by a test that
 * threw before its own cleanup. preorder_lines go with their preorder by cascade.
 */
export async function cleanup() {
  if (skip) return;
  const supabase = admin();
  for (const [table, ids] of Object.entries(made)) {
    if (ids.length) await supabase.from(table).delete().in("id", ids);
    ids.length = 0;
  }
  for (const table of ["reservations", "preorders", "waitlist_entries", "event_inquiries"]) {
    await supabase.from(table).delete().eq("name", TEST_NAME);
  }
  // The quota buckets this run took, so a later run starts from a clean per-address allowance.
  await supabase.from("request_quota").delete().like("bucket", "zz-test-%");
}

// ------------------------------------------------------------------ assertions

/**
 * Calls an RPC that is expected to fail, and returns the error code it raised.
 *
 * Every form RPC signals refusal with `raise exception '<code>'`, which arrives as a PostgrestError
 * whose message is the bare code. The Server Actions match on exactly that string to pick the
 * sentence a guest reads (lib/form-errors.ts), so the code is part of the contract and not an
 * implementation detail.
 */
export async function rpcError(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (!error) throw new Error(`${name} was expected to fail but returned ${JSON.stringify(data)}`);
  return error.message;
}

/** The shop's today, which is what every date in these functions is measured against. */
export const berlinToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

/** `days` from the shop's today, as an ISO date. */
export function berlinDatePlus(days) {
  const base = new Date(`${berlinToday()}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
