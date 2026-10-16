/**
 * The guard that decides which Supabase project this process may talk to.
 *
 * This is the check that keeps `npm run dev`, Playwright and every agent session off the live
 * database. Until 2026-10-14 they were all pointed at production, so a test run spent the site-wide
 * quota in `request_reservation` (15 an hour, 80 a day) and held real seats: submitting the
 * reservation form twenty times to see whether it works could turn a real guest away.
 *
 * The guard is the whole protection and it had no test of its own, which is the one thing that must
 * not be true of a guard. Note what is deliberate here: the production ref is hardcoded in the
 * module, because a check against a wrong environment variable cannot itself be configured by one.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase/env";

const PRODUCTION = "https://iabpugtwgjqldlzjjgqj.supabase.co";
const STAGING = "https://yfcpqyxonzjuflsqhasz.supabase.co";

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "VERCEL_ENV", "ALLOW_PRODUCTION_DB"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("supabaseUrl", () => {
  test("refuses production outside the production deployment", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION;
    assert.throws(() => supabaseUrl(), /Refusing to connect to the production Supabase project/);
  });

  test("names the escape hatch in the error, so the next person does not have to guess", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION;
    assert.throws(() => supabaseUrl(), /ALLOW_PRODUCTION_DB=1/);
  });

  test("allows production in the production deployment, which is the point of it", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION;
    process.env.VERCEL_ENV = "production";
    assert.equal(supabaseUrl(), PRODUCTION);
  });

  test("a non-production Vercel environment is still refused", () => {
    // There is no preview environment on this project on purpose (vercel.json), so anything that is
    // not exactly "production" must not reach the live data.
    process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION;
    for (const env of ["preview", "development", "Production", "PRODUCTION", ""]) {
      process.env.VERCEL_ENV = env;
      assert.throws(() => supabaseUrl(), /Refusing to connect/, `VERCEL_ENV=${env} should not pass`);
    }
  });

  test("the escape hatch has to be exactly 1, so a stray value does not open it", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PRODUCTION;
    for (const value of ["true", "yes", "0", ""]) {
      process.env.ALLOW_PRODUCTION_DB = value;
      assert.throws(() => supabaseUrl(), /Refusing to connect/, `ALLOW_PRODUCTION_DB=${value} should not open the hatch`);
    }
    process.env.ALLOW_PRODUCTION_DB = "1";
    assert.equal(supabaseUrl(), PRODUCTION);
  });

  test("staging passes without any ceremony, because it is the default target", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = STAGING;
    assert.equal(supabaseUrl(), STAGING);
  });

  test("catches the production ref wherever it appears in the URL", () => {
    // The pooler host spells the project ref differently from the direct host, and both have to be
    // caught: postgres.<ref>@aws-1-eu-central-1.pooler.supabase.com.
    for (const url of [
      PRODUCTION,
      "https://iabpugtwgjqldlzjjgqj.supabase.co/rest/v1",
      "postgresql://postgres.iabpugtwgjqldlzjjgqj@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
    ]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      assert.throws(() => supabaseUrl(), /Refusing to connect/, url);
    }
  });

  test("says which variable is missing rather than failing later on an undefined URL", () => {
    assert.throws(() => supabaseUrl(), /NEXT_PUBLIC_SUPABASE_URL is not set/);
  });
});

describe("supabasePublishableKey", () => {
  test("returns the key when it is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    assert.equal(supabasePublishableKey(), "sb_publishable_test");
  });

  test("says which variable is missing", () => {
    assert.throws(() => supabasePublishableKey(), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set/);
  });
});
