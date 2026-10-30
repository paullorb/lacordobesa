/**
 * Who may call what, and who may read what.
 *
 * Forty migrations have moved these lines around and none of them had a test. The two that matter
 * most are both deliberate and both invisible from the application code:
 *
 *  - The form RPCs (`request_reservation` and its siblings) are **service_role only**, as of
 *    migration 20261014072715. They used to be callable with the publishable key, which meant a
 *    caller could skip the per-address quota in `take_request_quota` entirely: that quota is taken
 *    by the Server Action before it calls the RPC, so a caller who reaches the RPC directly never
 *    pays it. If `anon` ever regains execute on one of these, that bypass is open again and nothing
 *    else in the codebase would notice.
 *  - `menu_items` is staff-read-only (20261014135600) and the public pages read the
 *    `menu_items_public` view instead (20261014135536). An unpublished dish or a hidden price must
 *    not be reachable with the publishable key, and the obvious "fix" of granting anon a read on
 *    `menu_items` would undo that while every page kept working.
 *
 * Memory of this repo also records that production has drifted from these files before (a "staff
 * write FOR ALL" policy where staging has the split ones), so these tests are written against
 * behaviour the migrations promise, and can be pointed at either project to compare.
 *
 * Nothing here writes anything that lasts: the write attempts are all expected to be refused.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, berlinToday, cleanup, skip, TEST_NAME } from "./harness.mjs";

after(cleanup);

/** The RPCs the public forms go through. The Server Action holds the secret key and calls these
 *  after taking a unit of the caller's quota. */
const SERVER_ONLY_RPCS = [
  ["request_reservation", { p_name: "x", p_phone: "+4915111111111", p_email: null, p_party_size: 2, p_date: berlinToday(), p_time: "19:00" }],
  ["request_preorder", { p_name: "x", p_phone: "+4915111111111", p_email: null, p_pickup_date: berlinToday(), p_pickup_time: "12:00", p_lines: [] }],
  ["request_event_inquiry", { p_name: "x", p_phone: "+4915111111111", p_email: null, p_occasion: "birthday", p_budget_band: "a", p_event_date: berlinToday(), p_guests: 10, p_message: "x" }],
  ["join_waitlist", { p_name: "x", p_phone: "+4915111111111", p_email: null, p_date: berlinToday(), p_party_size: 2, p_time_preference: "evening" }],
  ["subscribe_broadcast", { p_channel: "specials", p_consent_text: "x", p_name: "x", p_phone: "+4915111111111", p_email: null }],
  ["request_broadcast_email", { p_name: "x", p_email: "x@example.test", p_consent_text: "x", p_confirmation_token: "x" }],
  ["track_event", { p_event: "pageview", p_detail: "", p_path: "/", p_referrer: "", p_device: "phone", p_browser: "chrome", p_lang: "de" }],
  ["take_request_quota", { p_bucket: "zz-test-grants", p_max_1h: 1, p_max_24h: 1 }],
];

/** Staff tools. `authenticated` plus an is_staff() check inside; never the anonymous key. */
const STAFF_ONLY_RPCS = [
  ["analytics_breakdown", { p_from: berlinToday(), p_to: berlinToday(), p_event: "pageview", p_by: "path", p_detail: "" }],
  ["arrange_menu_categories", { p_ids: [] }],
  ["arrange_menu_items", { p_category: "00000000-0000-0000-0000-000000000000", p_ids: [] }],
  ["create_preorder_manually", { p_name: "x", p_phone: "+4915111111111", p_pickup_date: berlinToday(), p_pickup_time: "12:00", p_notes: null, p_preparation: null, p_lines: [] }],
  ["is_admin", {}],
];

/** What the public pages and the guest links genuinely need. */
const PUBLIC_RPCS = [
  ["confirm_broadcast_email", { p_token: "x" }],
  ["reservation_settings", {}],
  ["preorder_settings", {}],
  ["reservation_availability", { p_date: berlinToday() }],
  ["reservation_by_token", { p_token: "no-such-token" }],
  ["preorder_by_token", { p_token: "no-such-token" }],
  ["manage_token_valid", { p_token: "no-such-token" }],
];

/** A refusal at the grant level, rather than a refusal from inside the function body. */
const isPermissionDenied = (error) =>
  error?.code === "42501" || /permission denied|not find the function|does not exist/i.test(error?.message ?? "");

describe("the form RPCs are reachable only with the server's secret key", () => {
  for (const [name, args] of SERVER_ONLY_RPCS) {
    test(`anon cannot call ${name}`, { skip }, async () => {
      const { error } = await anon().rpc(name, args);
      assert.ok(error, `${name} answered the publishable key; the quota in take_request_quota can be skipped`);
      assert.ok(isPermissionDenied(error), `${name} failed, but on its own validation (${error.code} ${error.message}) rather than on the grant`);
    });
  }
});

describe("the staff RPCs are not reachable with the publishable key", () => {
  for (const [name, args] of STAFF_ONLY_RPCS) {
    test(`anon cannot call ${name}`, { skip }, async () => {
      const { error } = await anon().rpc(name, args);
      assert.ok(error, `${name} answered the publishable key`);
      assert.ok(isPermissionDenied(error), `${name} failed on ${error.code} ${error.message}, not on the grant`);
    });
  }
});

describe("the public RPCs stay reachable, because the forms and the guest links need them", () => {
  for (const [name, args] of PUBLIC_RPCS) {
    test(`anon can call ${name}`, { skip }, async () => {
      const { error } = await anon().rpc(name, args);
      // A token that matches nothing is a normal answer (null / false), not an error.
      assert.equal(error, null, `${name} is no longer callable from the browser: ${error?.code} ${error?.message}`);
    });
  }
});

describe("what the publishable key may read", () => {
  // The content the public pages render. A read here is the page working.
  const READABLE = ["menu_categories", "menu_items_public", "specials", "special_ideas", "opening_hours", "site_settings", "gallery_items"];
  for (const table of READABLE) {
    test(`anon can read ${table}`, { skip }, async () => {
      const { error } = await anon().from(table).select("*").limit(1);
      assert.equal(error, null, `${table} is not readable from the browser: ${error?.code} ${error?.message}`);
    });
  }

  // Guest data and the shop's own books. Either no policy (an empty result) or no grant (an error);
  // both are a refusal, and what must never happen is a row coming back.
  const PRIVATE = ["reservations", "preorders", "preorder_lines", "waitlist_entries", "event_inquiries", "broadcast_optins", "broadcast_email_send_attempts", "staff", "analytics_daily", "request_quota", "closures"];
  for (const table of PRIVATE) {
    test(`anon reads no rows from ${table}`, { skip }, async () => {
      const { data, error } = await anon().from(table).select("*").limit(1);
      if (error) {
        assert.ok(isPermissionDenied(error), `unexpected error on ${table}: ${error.code} ${error.message}`);
        return;
      }
      assert.deepEqual(data, [], `${table} handed rows to the publishable key`);
    });
  }

  test("anon cannot read menu_items itself, only the published view", { skip }, async () => {
    // The view is the public surface; the table carries unpublished dishes and hidden prices.
    const { data, error } = await anon().from("menu_items").select("*").limit(1);
    if (!error) assert.deepEqual(data, [], "menu_items is readable with the publishable key");
    const view = await anon().from("menu_items_public").select("id").limit(1);
    assert.equal(view.error, null, "the public menu view is not readable, so /karte would be empty");
  });

  test("the public view really does hide what it promises to hide", { skip }, async () => {
    const all = await admin().from("menu_items").select("id");
    const published = await anon().from("menu_items_public").select("id");
    assert.equal(all.error, null);
    assert.equal(published.error, null);
    assert.ok(
      published.data.length <= all.data.length,
      `the view shows ${published.data.length} of ${all.data.length} rows, which is more than the table has`,
    );
  });
});

describe("what the publishable key may write", () => {
  // Every row here is schema-valid on purpose. A payload with a wrong column name is rejected by
  // PostgREST before row level security is ever consulted, which would make these tests pass
  // without proving anything.
  const TABLES = [
    ["menu_categories", { slug: "zz-test", label: "ZZ test" }],
    ["menu_items", { category_id: null, name: "ZZ test" }],
    ["specials", { title: "ZZ test" }],
    ["special_ideas", { title: "ZZ test" }],
    ["opening_hours", { weekday: 1 }],
    ["closures", { date: berlinToday() }],
    ["site_settings", { key: "zz-test", value: {} }],
    ["gallery_items", { image_url: "https://example.invalid/zz-test.jpg", category: "shop" }],
    ["reservations", { name: TEST_NAME, phone: "+4915111111111", date: berlinToday(), start_time: "19:00", party_size: 2 }],
    ["preorders", { name: TEST_NAME, phone: "+4915111111111", pickup_date: berlinToday(), pickup_time: "12:00" }],
    // preorder_lines still carries wide table-level grants to anon (INSERT/UPDATE/DELETE), so row
    // level security is the only thing refusing this one. Worth keeping a test on precisely because
    // the grant would not stop it.
    ["preorder_lines", { quantity: 1, label: "ZZ test" }],
    ["waitlist_entries", { name: TEST_NAME, phone: "+4915111111111", date: berlinToday(), party_size: 2 }],
    ["event_inquiries", { name: TEST_NAME, phone: "+4915111111111" }],
    ["broadcast_optins", { channel: "whatsapp", consent_text: "ZZ test" }],
    ["staff", { user_id: "00000000-0000-0000-0000-000000000000" }],
    ["analytics_daily", { day: berlinToday() }],
  ];

  for (const [table, row] of TABLES) {
    test(`anon cannot insert into ${table}`, { skip }, async () => {
      // Every public write goes through a SECURITY DEFINER function so it can be validated and
      // rate limited. A direct insert would walk past all of that.
      const { data, error } = await anon().from(table).insert(row).select();
      assert.ok(error, `anon inserted into ${table}: ${JSON.stringify(data)}`);
      assert.ok(
        isPermissionDenied(error) || error.code === "42804" || /violates row-level security/i.test(error.message),
        `${table} refused the insert for the wrong reason: ${error.code} ${error.message}`,
      );
    });
  }

  test("anon cannot update the shop's own content", { skip }, async () => {
    const { data } = await anon().from("site_settings").update({ value: { hijacked: true } }).eq("key", "reservations").select();
    assert.deepEqual(data ?? [], [], "anon updated site_settings");
  });

  test("anon cannot delete the shop's own content", { skip }, async () => {
    const { data } = await anon().from("menu_categories").delete().neq("name", "").select();
    assert.deepEqual(data ?? [], [], "anon deleted menu categories");
  });

  test("anon cannot write through the public menu view", { skip }, async () => {
    const { error } = await anon().from("menu_items_public").insert({ name: "ZZ test" }).select();
    assert.ok(error, "the public menu view accepted a write");
  });
});

// Whether RLS is actually enabled on every table, and whether the grant matrix above is complete,
// are questions about the schema rather than about a request. They need the catalog, which the REST
// API does not expose, so they live in schema.test.mjs and go through psql.
