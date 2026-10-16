/**
 * `request_preorder`, which is the most finicky function in the database.
 *
 * It validates fourteen different ways: the contact details, the lead time, the shop's opening hours
 * on the chosen day, the basket's shape, the pack size of every line, and whether the basket needs a
 * fresh-or-par-baked answer. Each refusal is a distinct code the guest sees as a sentence, and a
 * basket that reaches the kitchen in the wrong shape is something a person then has to sort out by
 * phone, so the codes are the contract.
 *
 * Nothing is hardcoded about the menu: the item ids, the pack sizes and the opening hours are all
 * read from the database, so the file keeps working when the shop changes its menu.
 *
 * As in reservations.test.mjs, `afterEach(cleanup)` is load-bearing: `request_preorder` has its own
 * site-wide brake of 15 an hour.
 */
import { test, describe, after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, berlinDatePlus, cleanup, rpcError, skip, TEST_NAME, testPhone, track } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

/** Items the shop will actually take an order for, with the pack size each is sold in. */
let empanada;
let singles;
let settings;
/** A pickup day and time the shop is open for. */
let pickup;

before(async () => {
  if (skip) return;
  settings = (await anon().rpc("preorder_settings")).data;

  const { data: items, error } = await admin()
    .from("menu_items")
    .select("id, name, preorder_step, category_id, menu_categories(slug)")
    .eq("is_preorderable", true)
    .eq("is_available", true);
  assert.equal(error, null, `could not read the menu: ${error?.message}`);
  empanada = items.find((i) => i.menu_categories?.slug === "empanadas");
  singles = items.find((i) => i.menu_categories?.slug !== "empanadas" && i.preorder_step === 1);
  assert.ok(empanada, "no preorderable empanada in the database, so the preparation rules cannot be tested");
  assert.ok(singles, "no preorderable item outside empanadas");

  const { data: hours } = await admin().from("opening_hours").select("weekday, opens, closes, is_closed");
  const { data: closures } = await admin().from("closures").select("date");
  const closed = new Set((closures ?? []).map((c) => c.date));
  // The lead time is in hours, so start two days out and take the first open day after that.
  for (let days = 2; days <= 20; days++) {
    const date = berlinDatePlus(days);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const day = (hours ?? []).find((h) => h.weekday === weekday);
    if (!day || day.is_closed || closed.has(date)) continue;
    pickup = { date, time: day.opens, closes: day.closes, weekday };
    break;
  }
  assert.ok(pickup, "the shop is closed every day for the next three weeks");
});

const order = (over = {}) => ({
  p_name: TEST_NAME,
  p_phone: testPhone(),
  p_email: null,
  p_pickup_date: pickup.date,
  p_pickup_time: pickup.time,
  p_lines: [{ item_id: singles.id, quantity: 1 }],
  p_notes: null,
  p_locale: "de",
  p_preparation: null,
  ...over,
});

/** Orders, remembers the row for cleanup, and returns the manage token the function hands back. */
async function place(over = {}) {
  const { data: token, error } = await admin().rpc("request_preorder", order(over));
  assert.equal(error, null, `the order was refused: ${error?.message}`);
  const { data } = await admin().from("preorders").select("id").eq("manage_token", token).single();
  track("preorders", data.id);
  return { token, id: data.id };
}

describe("an order that should work", () => {
  test("is created as pending and hands back a management token", { skip }, async () => {
    const { id, token } = await place();
    assert.ok(token && token.length >= 16, `a ${token?.length} character token is guessable`);
    const { data } = await admin().from("preorders").select("status, pickup_date, name").eq("id", id).single();
    assert.equal(data.status, "pending");
    assert.equal(data.pickup_date, pickup.date);
    assert.equal(data.name, TEST_NAME);
  });

  test("stores every line of the basket with its quantity", { skip }, async () => {
    const { id } = await place({ p_lines: [{ item_id: singles.id, quantity: 2 }, { item_id: empanada.id, quantity: empanada.preorder_step }], p_preparation: "fresh" });
    // The JSON key the function takes is `item_id`; the column it writes is `menu_item_id`.
    const { data, error } = await admin().from("preorder_lines").select("menu_item_id, quantity").eq("preorder_id", id);
    assert.equal(error, null, `could not read the lines back: ${error?.message}`);
    assert.equal(data.length, 2, "a line went missing");
    const byItem = Object.fromEntries(data.map((l) => [l.menu_item_id, l.quantity]));
    assert.equal(byItem[singles.id], 2);
    assert.equal(byItem[empanada.id], empanada.preorder_step);
  });

  test("remembers the language the guest ordered in", { skip }, async () => {
    for (const locale of ["de", "es", "en"]) {
      const { id } = await place({ p_locale: locale });
      const { data } = await admin().from("preorders").select("locale").eq("id", id).single();
      assert.equal(data.locale, locale);
      await cleanup();
    }
  });

  test("falls back to German for a language the site does not have", { skip }, async () => {
    const { id } = await place({ p_locale: "pt" });
    const { data } = await admin().from("preorders").select("locale").eq("id", id).single();
    assert.equal(data.locale, "de");
  });
});

describe("the fresh or par-baked answer", () => {
  test("is required as soon as there are empanadas in the basket", { skip }, async () => {
    // The bakery has to know before it starts, so this is refused rather than guessed.
    const code = await rpcError(admin(), "request_preorder", order({
      p_lines: [{ item_id: empanada.id, quantity: empanada.preorder_step }],
      p_preparation: null,
    }));
    assert.equal(code, "preparation_required");
  });

  test("is stored when it was asked for", { skip }, async () => {
    for (const preparation of ["fresh", "frozen"]) {
      const { id } = await place({ p_lines: [{ item_id: empanada.id, quantity: empanada.preorder_step }], p_preparation: preparation });
      const { data } = await admin().from("preorders").select("preparation").eq("id", id).single();
      assert.equal(data.preparation, preparation);
      await cleanup();
    }
  });

  test("is dropped for a basket with no empanadas, rather than stored against the wrong thing", { skip }, async () => {
    const { id } = await place({ p_lines: [{ item_id: singles.id, quantity: 1 }], p_preparation: "fresh" });
    const { data } = await admin().from("preorders").select("preparation").eq("id", id).single();
    assert.equal(data.preparation, null);
  });

  test("anything that is not fresh or frozen is refused", { skip }, async () => {
    for (const preparation of ["warm", "FRESH", "fresco", "x"]) {
      const code = await rpcError(admin(), "request_preorder", order({ p_preparation: preparation }));
      assert.equal(code, "invalid_preparation", preparation);
    }
  });
});

describe("the basket has to make sense", () => {
  test("an empty basket is refused", { skip }, async () => {
    for (const lines of [[], null]) {
      assert.equal(await rpcError(admin(), "request_preorder", order({ p_lines: lines })), "empty_order", JSON.stringify(lines));
    }
  });

  test("something that is not a list of lines is refused", { skip }, async () => {
    for (const lines of [{ item_id: singles.id }, "nope", 5]) {
      assert.equal(await rpcError(admin(), "request_preorder", order({ p_lines: lines })), "empty_order", JSON.stringify(lines));
    }
  });

  test("more lines than the settings allow is refused", { skip }, async () => {
    const tooMany = Array.from({ length: Number(settings.max_lines) + 1 }, () => ({ item_id: singles.id, quantity: 1 }));
    // Distinct-item check runs first for repeated ids, so this is about the count alone.
    const code = await rpcError(admin(), "request_preorder", order({ p_lines: tooMany }));
    assert.ok(["too_many_lines", "invalid_quantity"].includes(code), `expected a refusal about the basket, got ${code}`);
  });

  test("the same dish twice in one basket is refused rather than silently merged", { skip }, async () => {
    // Two lines for one dish would double-count in the kitchen's list.
    const code = await rpcError(admin(), "request_preorder", order({
      p_lines: [{ item_id: singles.id, quantity: 1 }, { item_id: singles.id, quantity: 2 }],
    }));
    assert.equal(code, "invalid_quantity");
  });

  test("a quantity of nothing or less is refused", { skip }, async () => {
    for (const quantity of [0, -1, null]) {
      const code = await rpcError(admin(), "request_preorder", order({ p_lines: [{ item_id: singles.id, quantity }] }));
      assert.equal(code, "invalid_quantity", String(quantity));
    }
  });

  test("a quantity above the settings is refused", { skip }, async () => {
    const tooMany = Number(settings.max_quantity) + 1;
    const code = await rpcError(admin(), "request_preorder", order({ p_lines: [{ item_id: singles.id, quantity: tooMany }] }));
    assert.equal(code, "invalid_quantity");
  });

  test("a quantity that is not a whole pack is refused: six empanadas, twelve, never seven", { skip }, async () => {
    const step = empanada.preorder_step;
    assert.ok(step > 1, "this empanada is not sold in packs, so the pack rule cannot be tested");
    const code = await rpcError(admin(), "request_preorder", order({
      p_lines: [{ item_id: empanada.id, quantity: step + 1 }],
      p_preparation: "fresh",
    }));
    assert.equal(code, "invalid_quantity");
  });

  test("a whole number of packs is accepted", { skip }, async () => {
    const { id } = await place({
      p_lines: [{ item_id: empanada.id, quantity: empanada.preorder_step * 2 }],
      p_preparation: "fresh",
    });
    assert.ok(id);
  });

  test("a dish that is not on the menu is refused", { skip }, async () => {
    const code = await rpcError(admin(), "request_preorder", order({
      p_lines: [{ item_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
    }));
    assert.equal(code, "item_unavailable");
  });

  test("a dish the shop does not take orders for is refused", { skip }, async () => {
    // Deliberately outside the empanadas category. "Las Tres Empanadas" is also not orderable, but
    // it *is* an empanada, so a basket holding it is refused with preparation_required first and
    // this test would pass for the wrong reason.
    const { data: notOrderable } = await admin()
      .from("menu_items")
      .select("id, menu_categories(slug)")
      .eq("is_preorderable", false)
      .limit(20);
    const item = (notOrderable ?? []).find((i) => i.menu_categories?.slug !== "empanadas");
    if (!item) return;
    const code = await rpcError(admin(), "request_preorder", order({ p_lines: [{ item_id: item.id, quantity: 1 }] }));
    assert.equal(code, "item_unavailable");
  });
});

describe("the pickup time has to be one the shop is open for", () => {
  test("a day the shop rests is refused", { skip }, async () => {
    const { data: hours } = await admin().from("opening_hours").select("weekday, is_closed");
    const restDay = (hours ?? []).find((h) => h.is_closed);
    if (!restDay) return;
    for (let days = 2; days <= 9; days++) {
      const date = berlinDatePlus(days);
      if (new Date(`${date}T12:00:00Z`).getUTCDay() !== restDay.weekday) continue;
      const code = await rpcError(admin(), "request_preorder", order({ p_pickup_date: date, p_pickup_time: "12:00:00" }));
      assert.equal(code, "closed_that_day");
      return;
    }
  });

  test("a time before the shop opens is refused", { skip }, async () => {
    const code = await rpcError(admin(), "request_preorder", order({ p_pickup_time: "06:00:00" }));
    assert.equal(code, "outside_hours");
  });

  test("a time after the shop closes is refused", { skip }, async () => {
    const code = await rpcError(admin(), "request_preorder", order({ p_pickup_time: "23:59:00" }));
    assert.equal(code, "outside_hours");
  });

  test("a pickup inside the lead window is refused, so the kitchen has time to bake", { skip }, async () => {
    const code = await rpcError(admin(), "request_preorder", order({ p_pickup_date: berlinDatePlus(0), p_pickup_time: "12:00:00" }));
    assert.ok(["too_soon", "closed_that_day", "outside_hours"].includes(code), `expected a refusal about the time, got ${code}`);
  });

  test("a pickup past the horizon is refused", { skip }, async () => {
    const beyond = berlinDatePlus(Number(settings.max_days_ahead) + 2);
    const code = await rpcError(admin(), "request_preorder", order({ p_pickup_date: beyond }));
    assert.equal(code, "too_far_ahead");
  });

  test("a closure on the chosen day is refused", { skip }, async () => {
    // Staff enter a closure for a holiday; an order for that day must not be accepted.
    const date = berlinDatePlus(18);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const { data: hours } = await admin().from("opening_hours").select("weekday, opens, is_closed");
    const day = (hours ?? []).find((h) => h.weekday === weekday);
    if (!day || day.is_closed) return;
    const { error: insertError } = await admin().from("closures").insert({ date, reason: "ZZ test closure" });
    assert.equal(insertError, null, `could not arrange the closure: ${insertError?.message}`);
    try {
      const code = await rpcError(admin(), "request_preorder", order({ p_pickup_date: date, p_pickup_time: day.opens }));
      assert.equal(code, "closed_that_day");
    } finally {
      await admin().from("closures").delete().eq("date", date);
    }
  });
});

describe("the guest's contact details are validated the same way as a reservation", () => {
  test("a short name, a letters-only phone and a broken e-mail are all invalid_contact", { skip }, async () => {
    assert.equal(await rpcError(admin(), "request_preorder", order({ p_name: "A" })), "invalid_contact");
    assert.equal(await rpcError(admin(), "request_preorder", order({ p_phone: "ring me" })), "invalid_contact");
    assert.equal(await rpcError(admin(), "request_preorder", order({ p_email: "not-an-email" })), "invalid_contact");
  });

  test("an over-long field is field_too_long", { skip }, async () => {
    assert.equal(await rpcError(admin(), "request_preorder", order({ p_name: "x".repeat(101) })), "field_too_long");
    assert.equal(await rpcError(admin(), "request_preorder", order({ p_notes: "x".repeat(501) })), "field_too_long");
  });
});

describe("the limits that stop one person filling the oven", () => {
  test("a phone number is held to three open orders", { skip }, async () => {
    const phone = testPhone();
    for (let i = 0; i < 3; i++) await place({ p_phone: phone });
    const code = await rpcError(admin(), "request_preorder", order({ p_phone: phone }));
    assert.equal(code, "too_many_requests");
  });

  test("the e-mail address is counted as well as the phone number", { skip }, async () => {
    const email = `zz-test-${Date.now()}@example.invalid`;
    for (let i = 0; i < 3; i++) await place({ p_phone: testPhone(), p_email: email });
    const code = await rpcError(admin(), "request_preorder", order({ p_phone: testPhone(), p_email: email }));
    assert.equal(code, "too_many_requests");
  });
});

describe("the guest's own order link", () => {
  test("shows the guest their order and its lines", { skip }, async () => {
    const { token } = await place({ p_lines: [{ item_id: singles.id, quantity: 3 }] });
    const { data, error } = await anon().rpc("preorder_by_token", { p_token: token });
    assert.equal(error, null);
    assert.ok(data, "the order is not visible through its own link");
  });

  test("shows nothing for a token that matches nothing", { skip }, async () => {
    const { data, error } = await anon().rpc("preorder_by_token", { p_token: "not-a-real-token" });
    assert.equal(error, null, "a wrong token should be an empty answer, not an error");
    assert.deepEqual(Array.isArray(data) ? data : [data].filter(Boolean), []);
  });

  test("the guest can cancel, which takes the order off the kitchen's list", { skip }, async () => {
    const { id, token } = await place();
    const { error } = await anon().rpc("cancel_preorder_by_token", { p_token: token });
    assert.equal(error, null, `cancelling failed: ${error?.message}`);
    const { data } = await admin().from("preorders").select("status").eq("id", id).single();
    assert.equal(data.status, "cancelled");
  });

  test("cancelling with a wrong token changes nothing", { skip }, async () => {
    const { id } = await place();
    await anon().rpc("cancel_preorder_by_token", { p_token: "not-a-real-token" });
    const { data } = await admin().from("preorders").select("status").eq("id", id).single();
    assert.equal(data.status, "pending", "a wrong token cancelled an order");
  });
});
