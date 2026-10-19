/**
 * What a signed-in staff member can do, as the `authenticated` role.
 *
 * This is the half of the database that neither `anon` nor the secret key represents: the staff
 * pages hold a real session, so everything they reach goes through the RLS policies and through
 * `is_staff()`. Three things are covered here that nothing else reaches:
 *
 *  - `create_preorder_manually` (migration 20261016132747, the most recent commit on main). It was
 *    written to make a phone order atomic, and "atomic" is exactly the property a test has to pin:
 *    a basket that is refused halfway must leave no order behind at all.
 *  - `arrange_menu_categories` / `arrange_menu_items` (20261015061507, 20261015085007). Reordering
 *    the menu by drag has to end with a contiguous order and no duplicate positions, whatever it is
 *    handed.
 *  - That a staff session is *not* a way round the public forms: the form RPCs stay service_role
 *    only, so a signed-in staff member cannot spend the site-wide quota either.
 */
import { test, describe, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, berlinDatePlus, cleanup, rpcError, skipStaff, staff, TEST_NAME, testPhone, track } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

let client;
let empanada;
let singles;
let pickup;

before(async () => {
  if (skipStaff) return;
  client = await staff();

  const { data: items } = await admin()
    .from("menu_items")
    .select("id, name, preorder_step, menu_categories(slug)")
    .eq("is_preorderable", true)
    .eq("is_available", true);
  empanada = items.find((i) => i.menu_categories?.slug === "empanadas");
  singles = items.find((i) => i.menu_categories?.slug !== "empanadas" && i.preorder_step === 1);

  const { data: hours } = await admin().from("opening_hours").select("weekday, opens, is_closed");
  for (let days = 2; days <= 20; days++) {
    const date = berlinDatePlus(days);
    const day = (hours ?? []).find((h) => h.weekday === new Date(`${date}T12:00:00Z`).getUTCDay());
    if (!day || day.is_closed) continue;
    pickup = { date, time: day.opens };
    break;
  }
});

describe("the session really is a staff session", () => {
  test("is_staff() is true, which is what every policy asks", { skip: skipStaff }, async () => {
    const { data, error } = await client.rpc("is_staff");
    assert.equal(error, null);
    assert.equal(data, true);
  });

  test("the signed-in role can read the shop's books", { skip: skipStaff }, async () => {
    for (const table of ["reservations", "preorders", "waitlist_entries", "event_inquiries", "closures", "menu_items"]) {
      const { error } = await client.from(table).select("*").limit(1);
      assert.equal(error, null, `staff cannot read ${table}: ${error?.code} ${error?.message}`);
    }
  });

  test("a staff session is still not a way into the public form RPCs", { skip: skipStaff }, async () => {
    // Those are service_role only, so the quota the Server Action takes cannot be skipped by
    // signing in either.
    const { error } = await client.rpc("request_reservation", {
      p_name: TEST_NAME,
      p_phone: testPhone(),
      p_email: null,
      p_party_size: 2,
      p_date: berlinDatePlus(5),
      p_time: "19:00",
    });
    assert.ok(error, "a staff session could call request_reservation");
    assert.equal(error.code, "42501");
  });
});

describe("create_preorder_manually", () => {
  const phoned = (over = {}) => ({
    p_name: TEST_NAME,
    p_phone: testPhone(),
    p_pickup_date: pickup.date,
    p_pickup_time: pickup.time,
    p_notes: null,
    p_preparation: null,
    p_lines: [{ item_id: singles.id, quantity: 1 }],
    ...over,
  });

  test("takes an order over the phone and marks it as such", { skip: skipStaff }, async () => {
    const { data: id, error } = await client.rpc("create_preorder_manually", phoned());
    assert.equal(error, null, `the order was refused: ${error?.message}`);
    track("preorders", id);
    const { data } = await admin().from("preorders").select("name, source, status").eq("id", id).single();
    assert.equal(data.name, TEST_NAME);
    // The shop needs to tell a phone order from one a guest typed in.
    assert.ok(data.source && data.source !== "web", `a phone order was stored with source "${data.source}"`);
  });

  test("stores the basket it was given", { skip: skipStaff }, async () => {
    const { data: id, error } = await client.rpc("create_preorder_manually", phoned({
      p_lines: [{ item_id: singles.id, quantity: 2 }, { item_id: empanada.id, quantity: empanada.preorder_step }],
      p_preparation: "fresh",
    }));
    assert.equal(error, null, `the order was refused: ${error?.message}`);
    track("preorders", id);
    const { data } = await admin().from("preorder_lines").select("menu_item_id, quantity").eq("preorder_id", id);
    assert.equal(data.length, 2);
    assert.equal(Object.fromEntries(data.map((l) => [l.menu_item_id, l.quantity]))[singles.id], 2);
  });

  test("leaves no half-written order behind when a line is refused", { skip: skipStaff }, async () => {
    // The whole point of migration 20261016132747. Before it, the order row was inserted first and
    // a bad line left it in the kitchen's list with nothing in it.
    const before = await admin().from("preorders").select("id", { count: "exact", head: true });
    const code = await rpcError(client, "create_preorder_manually", phoned({
      p_lines: [{ item_id: singles.id, quantity: 1 }, { item_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
    }));
    assert.ok(code, "a basket with an unknown dish was accepted");
    const after = await admin().from("preorders").select("id", { count: "exact", head: true });
    assert.equal(after.count, before.count, "a refused order left a row behind");
  });

  test("trusts staff with a quantity the public form would refuse", { skip: skipStaff }, async () => {
    // Deliberate, and worth writing down: the manual function validates far less than
    // request_preorder. No pack size, no lead time, no opening hours, no quota and no contact
    // check. A guest ordering seven empanadas on the website is a mistake; a staff member typing
    // seven is the shop deciding to sell seven, and the person on the phone is the authority.
    // This test exists so that the asymmetry is a decision on the record rather than a surprise.
    const step = empanada.preorder_step;
    if (step <= 1) return;
    const { data: id, error } = await client.rpc("create_preorder_manually", phoned({
      p_lines: [{ item_id: empanada.id, quantity: step + 1 }],
      p_preparation: "fresh",
    }));
    assert.equal(error, null, `the shop was refused its own phone order: ${error?.message}`);
    track("preorders", id);
    const { data } = await admin().from("preorder_lines").select("quantity").eq("preorder_id", id).single();
    assert.equal(data.quantity, step + 1);
  });

  test("takes an order for a day the public form would call too soon", { skip: skipStaff }, async () => {
    // Same reasoning: somebody is on the phone, and the kitchen has already agreed to it.
    const { data: id, error } = await client.rpc("create_preorder_manually", phoned({ p_pickup_date: berlinDatePlus(0) }));
    assert.equal(error, null, `a same-day phone order was refused: ${error?.message}`);
    track("preorders", id);
  });

  test("refuses an empty basket", { skip: skipStaff }, async () => {
    const code = await rpcError(client, "create_preorder_manually", phoned({ p_lines: [] }));
    assert.ok(code, "an empty phone order was accepted");
  });

  test("is not held to the guest quota, because the shop is taking the call", { skip: skipStaff }, async () => {
    // A staff member entering four orders in a row is normal work, not abuse.
    const phone = testPhone();
    for (let i = 0; i < 4; i++) {
      const { data: id, error } = await client.rpc("create_preorder_manually", phoned({ p_phone: phone }));
      assert.equal(error, null, `the shop was rate limited on its own order ${i + 1}: ${error?.message}`);
      track("preorders", id);
    }
  });
});

describe("rearranging the menu", () => {
  /** The current order of a category's items, as the editor sees it. */
  const itemOrder = async (categoryId) =>
    (await admin().from("menu_items").select("id, sort_order").eq("category_id", categoryId).order("sort_order")).data;

  test("reordering leaves a contiguous order with no duplicate positions", { skip: skipStaff }, async () => {
    const { data: categories } = await admin().from("menu_categories").select("id").limit(1);
    const categoryId = categories[0].id;
    const before = await itemOrder(categoryId);
    if (before.length < 2) return;

    const reversed = [...before].reverse().map((i) => i.id);
    const restored = before.map((i) => i.id);
    // `finally`, not two statements at the end: this writes to the shop's real staging menu, and a
    // failing assertion between the two used to leave it reversed for every later test and for
    // anyone looking at the staff page. The failure this test exists to catch must not itself
    // change staging.
    try {
      const { error } = await client.rpc("arrange_menu_items", { p_category: categoryId, p_ids: reversed });
      assert.equal(error, null, `reordering failed: ${error?.message}`);

      const after = await itemOrder(categoryId);
      assert.deepEqual(after.map((i) => i.id), reversed, "the stored order is not the one that was asked for");
      const positions = after.map((i) => i.sort_order);
      assert.equal(new Set(positions).size, positions.length, "two dishes share a position, so the order is not stable");
    } finally {
      await client.rpc("arrange_menu_items", { p_category: categoryId, p_ids: restored });
    }
    assert.deepEqual((await itemOrder(categoryId)).map((i) => i.id), restored, "the menu was left reordered");
  });

  test("an empty list changes nothing", { skip: skipStaff }, async () => {
    const { data: categories } = await admin().from("menu_categories").select("id").limit(1);
    const before = await itemOrder(categories[0].id);
    await client.rpc("arrange_menu_items", { p_category: categories[0].id, p_ids: [] });
    const after = await itemOrder(categories[0].id);
    assert.deepEqual(after.map((i) => i.id), before.map((i) => i.id));
  });

  test("the categories can be reordered the same way", { skip: skipStaff }, async () => {
    const order = async () => (await admin().from("menu_categories").select("id, sort_order").order("sort_order")).data;
    const before = await order();
    if (before.length < 2) return;
    const reversed = [...before].reverse().map((c) => c.id);
    try {
      const { error } = await client.rpc("arrange_menu_categories", { p_ids: reversed });
      assert.equal(error, null, `reordering failed: ${error?.message}`);
      assert.deepEqual((await order()).map((c) => c.id), reversed);
    } finally {
      await client.rpc("arrange_menu_categories", { p_ids: before.map((c) => c.id) });
    }
    assert.deepEqual((await order()).map((c) => c.id), before.map((c) => c.id), "the categories were left reordered");
  });
});

describe("the numbers page", () => {
  test("analytics_breakdown answers for a staff session", { skip: skipStaff }, async () => {
    const { data, error } = await client.rpc("analytics_breakdown", {
      p_from: berlinDatePlus(-30),
      p_to: berlinDatePlus(0),
      p_event: "pageview",
      p_by: "path",
      p_detail: "",
    });
    assert.equal(error, null, `analytics_breakdown failed: ${error?.message}`);
    assert.ok(Array.isArray(data), "the breakdown is not a list of buckets");
  });

  test("every bucket it returns has a label on the staff page", { skip: skipStaff }, async () => {
    // analytics-view.ts owns the labels and normalizePath owns the buckets. A bucket with no label
    // shows up as a bare path, which is the symptom of the two drifting apart.
    const { data } = await client.rpc("analytics_breakdown", {
      p_from: berlinDatePlus(-30),
      p_to: berlinDatePlus(0),
      p_event: "pageview",
      p_by: "path",
      p_detail: "",
    });
    for (const row of data ?? []) {
      assert.ok(typeof row.bucket === "string" && row.bucket.length > 0, `a bucket has no name: ${JSON.stringify(row)}`);
      assert.ok(Number.isFinite(Number(row.total)), `bucket ${row.bucket} has no total`);
    }
  });

  test("the totals are never negative", { skip: skipStaff }, async () => {
    const { data } = await client.rpc("analytics_breakdown", {
      p_from: berlinDatePlus(-30),
      p_to: berlinDatePlus(0),
      p_event: "pageview",
      p_by: "path",
      p_detail: "",
    });
    for (const row of data ?? []) assert.ok(Number(row.total) >= 0, `${row.bucket} has ${row.total}`);
  });

  test("the publishable key still cannot read it", { skip: skipStaff }, async () => {
    const { error } = await anon().rpc("analytics_breakdown", {
      p_from: berlinDatePlus(-30),
      p_to: berlinDatePlus(0),
      p_event: "pageview",
      p_by: "path",
      p_detail: "",
    });
    assert.ok(error, "the site's own analytics are readable from the browser");
  });
});
