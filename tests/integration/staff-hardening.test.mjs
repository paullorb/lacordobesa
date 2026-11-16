/**
 * Two database rules added in 20261116100000 and 20261116100100, and the staff invites table of
 * 20261116100200.
 *
 *  - site_settings keys the app treats as admin-only ('review_scores') are admin-only in RLS as well,
 *    so a `staff`-role session cannot write them through PostgREST. Every other key still accepts a
 *    staff write.
 *  - preorder_settings() fills in each missing key, so a partial row cannot turn a limit into NULL.
 *  - staff_invites: unreachable for anon and signed-in sessions, and a claim is one atomic UPDATE:
 *    only one of two concurrent claims gets the row, and an expired or revoked invite never does.
 */
import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { admin, anon, skip, skipStaff, staff } from "./harness.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

let plain; // a signed-in session whose staff row has role 'staff'
let plainId;
const hashes = [];

before(async () => {
  if (skip) return;
  const email = `zz-test-plain-${randomBytes(4).toString("hex")}@staff.lacordobesa.local`;
  const password = randomBytes(12).toString("hex");
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(error, null);
  plainId = data.user.id;
  const { error: staffError } = await admin().from("staff").insert({ user_id: plainId, role: "staff" });
  assert.equal(staffError, null);
  plain = createClient(url, publishable, options);
  const { error: signInError } = await plain.auth.signInWithPassword({ email, password });
  assert.equal(signInError, null);
});

after(async () => {
  if (skip) return;
  if (hashes.length) await admin().from("staff_invites").delete().in("token_hash", hashes);
  if (plainId) await admin().auth.admin.deleteUser(plainId);
  await admin().from("site_settings").delete().eq("key", "zz-test");
});

describe("admin-only site_settings keys", () => {
  test("a staff-role session cannot write review_scores, insert or update", { skip }, async () => {
    const before = await admin().from("site_settings").select("value").eq("key", "review_scores").maybeSingle();
    const insert = await plain.from("site_settings").upsert({ key: "review_scores", value: { hijacked: true } });
    assert.ok(insert.error, "a staff session wrote review_scores");
    const after = await admin().from("site_settings").select("value").eq("key", "review_scores").maybeSingle();
    assert.deepEqual(after.data?.value ?? null, before.data?.value ?? null);
  });

  test("a staff-role session cannot rename another key into review_scores", { skip }, async () => {
    await admin().from("site_settings").upsert({ key: "zz-test", value: {} });
    const { data, error } = await plain.from("site_settings").update({ key: "review_scores" }).eq("key", "zz-test").select();
    assert.ok(error || (data ?? []).length === 0, "a staff session renamed a row into review_scores");
    const { data: still } = await admin().from("site_settings").select("key").eq("key", "zz-test").maybeSingle();
    assert.ok(still, "the test row must still carry its own key");
  });

  test("a staff-role session still writes every other key", { skip }, async () => {
    const { error } = await plain.from("site_settings").upsert({ key: "zz-test", value: { a: 1 } });
    assert.equal(error, null, error?.message);
    const { error: del } = await plain.from("site_settings").delete().eq("key", "zz-test");
    assert.equal(del, null);
  });

  test("an admin session may still write review_scores", { skip: skipStaff }, async () => {
    const admins = await staff();
    const { data: before } = await admin().from("site_settings").select("value").eq("key", "review_scores").maybeSingle();
    const value = before?.value ?? {};
    const { error } = await admins.from("site_settings").upsert({ key: "review_scores", value });
    assert.equal(error, null, error?.message);
  });
});

describe("preorder_settings()", () => {
  test("every key is present even when the stored row has only some", { skip }, async () => {
    const db = admin();
    const { data: original } = await db.from("site_settings").select("value").eq("key", "preorders").maybeSingle();
    try {
      await db.from("site_settings").upsert({ key: "preorders", value: { enabled: true, max_lines: null, min_lead_hours: 48 } });
      const { data, error } = await db.rpc("preorder_settings");
      assert.equal(error, null, error?.message);
      assert.equal(data.min_lead_hours, 48, "a stored key must win");
      assert.equal(data.max_lines, 12, "a null key falls back to the default");
      assert.equal(data.max_days_ahead, 60);
      assert.equal(data.max_quantity, 50);
      assert.equal(data.enabled, true);
    } finally {
      if (original) await db.from("site_settings").upsert({ key: "preorders", value: original.value });
    }
  });
});

describe("revoke_user_sessions()", () => {
  test("a revoked session can neither refresh nor pass the Auth server's check", { skip }, async () => {
    const email = `zz-test-revoke-${randomBytes(4).toString("hex")}@staff.lacordobesa.local`;
    const password = randomBytes(12).toString("hex");
    const { data: created } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    try {
      const victim = createClient(url, publishable, options);
      const { data: signedIn, error } = await victim.auth.signInWithPassword({ email, password });
      assert.equal(error, null);
      const { access_token, refresh_token } = signedIn.session;
      assert.equal((await victim.auth.getUser(access_token)).error, null, "the fresh session should be valid");

      // Not callable with a user's own session.
      const denied = await victim.rpc("revoke_user_sessions", { p_user_id: created.user.id });
      assert.ok(denied.error, "a signed-in user could revoke sessions");

      const { data: removed, error: rpcError } = await admin().rpc("revoke_user_sessions", { p_user_id: created.user.id });
      assert.equal(rpcError, null, rpcError?.message);
      assert.ok(removed >= 1);

      const other = createClient(url, publishable, options);
      assert.ok((await other.auth.refreshSession({ refresh_token })).error, "the refresh token still worked");
      assert.ok((await other.auth.getUser(access_token)).error, "the access token still passed the Auth server");
    } finally {
      await admin().auth.admin.deleteUser(created.user.id);
    }
  });
});

describe("staff_invites", () => {
  const hash = () => {
    const h = createHash("sha256").update(randomBytes(32)).digest("hex");
    hashes.push(h);
    return h;
  };
  const inFuture = (ms) => new Date(Date.now() + ms).toISOString();

  /** The claim the signup action makes: one UPDATE, so exactly one caller can win. */
  const claim = (db, h) =>
    db
      .from("staff_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", h)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id, role")
      .maybeSingle();

  test("neither anon nor a signed-in session can read or write the table", { skip }, async () => {
    for (const client of [anon(), plain]) {
      const read = await client.from("staff_invites").select("id").limit(1);
      assert.ok(read.error, "the invites table was readable");
      const write = await client.from("staff_invites").insert({ token_hash: hash(), expires_at: inFuture(1000) });
      assert.ok(write.error, "the invites table was writable");
    }
  });

  test("two concurrent claims: one wins", { skip }, async () => {
    const h = hash();
    const { error } = await admin().from("staff_invites").insert({ token_hash: h, expires_at: inFuture(60_000) });
    assert.equal(error, null, error?.message);
    const results = await Promise.all([claim(admin(), h), claim(admin(), h), claim(admin(), h)]);
    assert.equal(results.filter((r) => r.data).length, 1, "more than one claim succeeded");
  });

  test("an expired, revoked or used invite is never claimed", { skip }, async () => {
    const expired = hash();
    const revoked = hash();
    await admin().from("staff_invites").insert({ token_hash: expired, expires_at: inFuture(-1000) });
    await admin().from("staff_invites").insert({ token_hash: revoked, expires_at: inFuture(60_000), revoked_at: new Date().toISOString() });
    assert.equal((await claim(admin(), expired)).data, null);
    assert.equal((await claim(admin(), revoked)).data, null);
  });

  test("the hash is unique and the role is limited", { skip }, async () => {
    const h = hash();
    assert.equal((await admin().from("staff_invites").insert({ token_hash: h, expires_at: inFuture(1000) })).error, null);
    assert.ok((await admin().from("staff_invites").insert({ token_hash: h, expires_at: inFuture(1000) })).error, "duplicate hash accepted");
    assert.ok((await admin().from("staff_invites").insert({ token_hash: hash(), role: "owner", expires_at: inFuture(1000) })).error, "unknown role accepted");
  });
});
