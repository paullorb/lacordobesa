/** Which Supabase project this process is allowed to talk to.
 *
 *  Until 2026-10-14 the Vercel project had NEXT_PUBLIC_SUPABASE_URL set for `production`,
 *  `preview` *and* `development`, all pointing at the live project, and `.env.local` pointed
 *  there too. So `npm run dev` and every agent session wrote into the real database. That is
 *  worse than stray rows: a test run spends the site-wide quota in `request_reservation`
 *  (15/hour, 80/24 h) and holds real seats in `reservation_availability`, so submitting the
 *  reservation form twenty times to see whether it works can turn a real guest away.
 *
 *  Development and all write tests use a disposable local Supabase stack. This check keeps
 *  production protected: only the production deployment on Vercel may reach production.
 *
 *  Escape hatch for the rare deliberate case (a one-off script, reproducing something that only
 *  exists in live data): `ALLOW_PRODUCTION_DB=1`. It has to be typed each time, which is the
 *  whole point. */

/** Hardcoded on purpose. This guards against a wrong environment variable, so it cannot itself
 *  be read from one. */
const PRODUCTION_PROJECT_REF = "iabpugtwgjqldlzjjgqj";

function assertAllowedProject(url: string) {
  // The browser has no VERCEL_ENV to judge by, and its URL was decided by the server build that
  // already passed this check.
  if (typeof window !== "undefined") return;
  if (!url.includes(PRODUCTION_PROJECT_REF)) return;
  if (process.env.VERCEL_ENV === "production") return;
  if (process.env.ALLOW_PRODUCTION_DB === "1") return;

  throw new Error(
    `Refusing to connect to the production Supabase project (${PRODUCTION_PROJECT_REF}) outside ` +
      "the production deployment. Use local Supabase for development and tests, " +
      "or set ALLOW_PRODUCTION_DB=1 if you really mean to touch live data.",
  );
}

/** The project URL, checked against the rule above. */
export function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  assertAllowedProject(url);
  return url;
}

/** The publishable (anon) key. Ships in the browser; RLS is what protects the data. */
export function supabasePublishableKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  return key;
}
