/**
 * The guest's manage links after migration 20261116110000: they expire, and they stop offering
 * cancel and move once the booking has started.
 *
 * Rows are inserted straight through the secret-key client, because the RPCs that create bookings
 * refuse past dates (which is exactly the situation under test).
 */
import { test, describe, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, berlinDatePlus, berlinToday, bookableDates, cleanup, rpcError, skip, TEST_NAME, testPhone, track } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

const FUTURE = skip ? [] : await bookableDates(1);

/** The minute of day on the shop's clock, so a "started" and a "not yet started" time can be picked. */
function berlinMinute() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour").value) * 60 + Number(parts.find((p) => p.type === "minute").value);
}

async function insertReservation(over = {}) {
  const { data, error } = await admin()
    .from("reservations")
    .insert({ name: TEST_NAME, phone: testPhone(), party_size: 2, date: berlinToday(), start_time: "12:00", status: "confirmed", ...over })
    .select("id, manage_token")
    .single();
  assert.equal(error, null, `fixture insert failed: ${error?.message}`);
  track("reservations", data.id);
  return data;
}

describe("manage link expiry (reservations)", () => {
  test("a link still works 13 days after the booking date", { skip }, async () => {
    const { manage_token } = await insertReservation({ date: berlinDatePlus(-13), status: "completed" });
    const { data } = await anon().rpc("reservation_by_token", { p_token: manage_token });
    assert.equal(data?.length, 1);
  });

  test("a link shows nothing 15 days after the booking date", { skip }, async () => {
    const { manage_token } = await insertReservation({ date: berlinDatePlus(-15), status: "completed" });
    const { data, error } = await anon().rpc("reservation_by_token", { p_token: manage_token });
    assert.equal(error, null);
    assert.deepEqual(data, [], "an expired link still returns the booking");
  });

  test("an expired link cannot cancel or move either", { skip }, async () => {
    const { id, manage_token } = await insertReservation({ date: berlinDatePlus(-15), status: "confirmed" });
    assert.equal(await rpcError(anon(), "cancel_reservation_by_token", { p_token: manage_token }), "not_found");
    assert.equal(
      await rpcError(anon(), "move_reservation_by_token", { p_token: manage_token, p_date: FUTURE[0], p_time: "19:00:00", p_party_size: 2 }),
      "not_found",
    );
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "confirmed");
  });
});

describe("started bookings (reservations)", () => {
  test("a booking whose start time has passed today cannot be cancelled by the guest", { skip }, async () => {
    if (berlinMinute() < 1) return; // 00:00 itself: nothing earlier today to use.
    const { id, manage_token } = await insertReservation({ date: berlinToday(), start_time: "00:00", status: "confirmed" });
    assert.equal(await rpcError(anon(), "cancel_reservation_by_token", { p_token: manage_token }), "in_the_past");
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "confirmed", "staff could no longer record a no-show");
  });

  test("a booking later today can still be cancelled", { skip }, async () => {
    if (berlinMinute() > 23 * 60 + 50) return;
    const { id, manage_token } = await insertReservation({ date: berlinToday(), start_time: "23:59", status: "confirmed" });
    const { error } = await anon().rpc("cancel_reservation_by_token", { p_token: manage_token });
    assert.equal(error, null, error?.message);
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "cancelled");
  });

  test("a past, still-open booking cannot be moved to a future slot", { skip }, async () => {
    const { id, manage_token } = await insertReservation({ date: berlinDatePlus(-7), status: "confirmed" });
    const { data: slots } = await anon().rpc("reservation_availability", { p_date: FUTURE[0] });
    const slot = slots.find((s) => s.seats_left >= 2);
    const code = await rpcError(anon(), "move_reservation_by_token", {
      p_token: manage_token,
      p_date: FUTURE[0],
      p_time: slot.slot,
      p_party_size: 2,
    });
    assert.equal(code, "in_the_past");
    const { data } = await admin().from("reservations").select("date, status").eq("id", id).single();
    assert.equal(data.date, berlinDatePlus(-7));
    assert.equal(data.status, "confirmed");
  });
});

describe("manage link expiry (pre-orders)", () => {
  async function insertPreorder(pickupDate) {
    const { data, error } = await admin()
      .from("preorders")
      .insert({ name: TEST_NAME, phone: testPhone(), pickup_date: pickupDate, pickup_time: "12:00", status: "confirmed" })
      .select("id, manage_token")
      .single();
    assert.equal(error, null, `fixture insert failed: ${error?.message}`);
    track("preorders", data.id);
    return data;
  }

  test("an order link works 13 days after pickup and shows nothing after 15", { skip }, async () => {
    const recent = await insertPreorder(berlinDatePlus(-13));
    const old = await insertPreorder(berlinDatePlus(-15));
    assert.equal((await anon().rpc("preorder_by_token", { p_token: recent.manage_token })).data?.length, 1);
    assert.deepEqual((await anon().rpc("preorder_by_token", { p_token: old.manage_token })).data, []);
  });

  test("an expired order link cannot cancel", { skip }, async () => {
    const old = await insertPreorder(berlinDatePlus(-15));
    assert.equal(await rpcError(anon(), "cancel_preorder_by_token", { p_token: old.manage_token }), "not_found");
  });
});
