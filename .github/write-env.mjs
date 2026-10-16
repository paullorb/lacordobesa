/**
 * Turns the repository secrets into the two env files the test suites read.
 *
 * The suites take their configuration from `.env.staging.local` (the STAGING_* names) and
 * `.env.local` (the NEXT_PUBLIC_* names the running site needs), because that is what a developer
 * has on disk. Rather than teach every suite a second way to be configured, CI writes the same two
 * files from secrets.
 *
 * Writes nothing and reports `configured=false` when the secrets are absent, which is the case for a
 * pull request from a fork. The workflow decides what that means: tolerated on a pull request,
 * a failure on the nightly run, where a canary watching nothing is worse than a red build.
 *
 * Two safeguards worth keeping:
 *
 *  - It refuses a URL pointing at the **production** project. tests/integration/harness.mjs refuses
 *    too, but by then a Supabase client has been configured; this stops the run before the files
 *    exist. A secret pasted into the wrong name is exactly the mistake this catches.
 *  - It writes with mode 600 and prints no value, only which names arrived.
 */
import { writeFileSync } from "node:fs";
import { appendFileSync } from "node:fs";

const PRODUCTION_PROJECT_REF = "iabpugtwgjqldlzjjgqj";

const REQUIRED = [
  "STAGING_SUPABASE_URL",
  "STAGING_PUBLISHABLE_KEY",
  "STAGING_SERVICE_ROLE_KEY",
  "STAGING_STAFF_USER",
  "STAGING_STAFF_PASS",
];
/** Only schema.test.mjs needs this, and it skips without it rather than failing. */
const OPTIONAL = ["STAGING_DB_URL"];

const present = [...REQUIRED, ...OPTIONAL].filter((name) => (process.env[name] ?? "").length > 0);
const missing = REQUIRED.filter((name) => !present.includes(name));

const output = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

if (missing.length > 0) {
  console.log(`Not configured. Missing: ${missing.join(", ")}`);
  console.log(`Present: ${present.length > 0 ? present.join(", ") : "(none)"}`);
  output("configured", "false");
  process.exit(0);
}

for (const name of present) {
  if (process.env[name].includes(PRODUCTION_PROJECT_REF)) {
    console.error(
      `::error::${name} contains the production project ref (${PRODUCTION_PROJECT_REF}). These ` +
        "suites write, so they must only ever point at lacordobesa-staging. Check the secret.",
    );
    process.exit(1);
  }
}

const staging = REQUIRED.concat(OPTIONAL)
  .filter((name) => present.includes(name))
  .map((name) => `${name}=${process.env[name]}`)
  .join("\n");

// The names the running site and the browser suite read. NEXT_PUBLIC_SITE_URL stays on localhost so
// that nothing in a CI run advertises the production origin, and VERCEL_ENV is left unset, which is
// what keeps src/lib/supabase/env.ts refusing production.
const local = [
  `NEXT_PUBLIC_SUPABASE_URL=${process.env.STAGING_SUPABASE_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${process.env.STAGING_PUBLISHABLE_KEY}`,
  "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
  `SUPABASE_SECRET_KEY=${process.env.STAGING_SERVICE_ROLE_KEY}`,
  `STAFF_USER=${process.env.STAGING_STAFF_USER}`,
  `STAFF_PASS=${process.env.STAGING_STAFF_PASS}`,
].join("\n");

writeFileSync(".env.staging.local", `${staging}\n`, { mode: 0o600 });
writeFileSync(".env.local", `${local}\n`, { mode: 0o600 });

console.log(`Configured from: ${present.join(", ")}`);
output("configured", "true");
