/**
 * The abuse controls added in migrations 20261116110100 to 20261116110300: the circuit-breaker
 * pressure signal, the per-contact limits on seat-holding bookings, giving back a mail attempt that
 * failed, and the sign-up language.
 *
 * The application-side half (honeypot, signed ticket) is unit-tested in tests/unit/form-ticket.test.ts.
 * These need the local Supabase stack.
 */
import { test, describe, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, bookableDates, cleanup, rpcError, skip, TEST_NAME, testPhone, track } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

const DAYS = skip ? [] : await bookableDates(4);

async function freeSlot(date, seats = 2) {
  const { data } = await anon().rpc("reservation_availability", { p_date: date });
  const slot = (data ?? []).find((s) => s.seats_left >= seats);
  assert.ok(slot, `no slot on ${date} has room for ${seats}`);
  return slot.slot;
}

const booking = async (date, over = {}) => ({
  p_name: TEST_NAME,
  p_phone: testPhone(),
  p_email: null,
  p_party_size: 2,
  p_date: date,
  p_time: await freeSlot(date, over.p_party_size ?? 2),
  p_notes: null,
  p_locale: "de",
  ...over,
});

async function book(date, over = {}) {
  const { data, error } = await admin().rpc("request_reservation", await booking(date, over));
  assert.equal(error, null, `the booking was refused: ${error?.message}`);
  return track("reservations", data);
}

describe("form_under_pressure", () => {
  test("is false on a quiet site, for every form", { skip }, async () => {
    for (const form of ["reservation", "preorder", "inquiry", "waitlist", "specials"]) {
      const { data, error } = await admin().rpc("form_under_pressure", { p_form: form });
      assert.equal(error, null, error?.message);
      assert.equal(data, false, `${form} reports pressure on a quiet site`);
    }
  });

  test("is true once a form's recent requests pass the soft limit", { skip }, async () => {
    // Inserted directly: eight in the last hour is the reservation form's pressure threshold.
    const rows = Array.from({ length: 8 }, () => ({
      name: TEST_NAME,
      phone: testPhone(),
      party_size: 1,
      date: DAYS[0],
      start_time: "16:00",
      status: "cancelled",
    }));
    const { data, error } = await admin().from("reservations").insert(rows).select("id");
    assert.equal(error, null, error?.message);
    for (const row of data) track("reservations", row.id);
    assert.equal((await admin().rpc("form_under_pressure", { p_form: "reservation" })).data, true);
    assert.equal((await admin().rpc("form_under_pressure", { p_form: "nonsense" })).data, false);
  });

  test("is not callable with the publishable key", { skip }, async () => {
    const { error } = await anon().rpc("form_under_pressure", { p_form: "reservation" });
    assert.ok(error, "anon could read the pressure signal");
  });
});

describe("request_reservation per-contact limits", () => {
  test("one e-mail address is held to three open bookings even with a new phone number each time", { skip }, async () => {
    const email = `zz-test-${Date.now()}@example.invalid`;
    for (const date of DAYS.slice(0, 3)) await book(date, { p_email: email });
    const code = await rpcError(admin(), "request_reservation", await booking(DAYS[3], { p_email: email }));
    assert.equal(code, "too_many_requests");
  });

  test("seats waiting for staff are capped per contact", { skip }, async () => {
    const email = `zz-test-${Date.now()}@example.invalid`;
    // Two parties of six fill the cap of twelve pending seats; a third seat is one too many.
    await book(DAYS[0], { p_email: email, p_party_size: 6 });
    await book(DAYS[1], { p_email: email, p_party_size: 6 });
    const code = await rpcError(admin(), "request_reservation", await booking(DAYS[2], { p_email: email, p_party_size: 1 }));
    assert.equal(code, "too_many_requests");
  });

  test("confirmed seats do not count against the pending cap", { skip }, async () => {
    const email = `zz-test-${Date.now()}@example.invalid`;
    const first = await book(DAYS[0], { p_email: email, p_party_size: 6 });
    await admin().from("reservations").update({ status: "confirmed" }).eq("id", first);
    await book(DAYS[1], { p_email: email, p_party_size: 6 });
    await book(DAYS[2], { p_email: email, p_party_size: 2 });
  });
});

describe("the specials sign-up helpers", () => {
  const email = () => `zz-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.invalid`;
  const token = () => Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  const consent = "Ich möchte per E-Mail über Specials informiert werden.";

  async function signUp(address) {
    const { data, error } = await admin().rpc("request_broadcast_email", {
      p_name: "ZZ Test",
      p_email: address,
      p_consent_text: consent,
      p_confirmation_token: token(),
    });
    assert.equal(error, null, error?.message);
    return data;
  }

  const cleanOptin = (address) => admin().from("broadcast_optins").delete().eq("email", address);

  test("a released attempt lets the retry through; without release the cooldown holds", { skip }, async () => {
    const address = email();
    try {
      assert.equal(await signUp(address), true);
      assert.equal(await signUp(address), false, "the 10-minute cooldown is gone");
      const { error } = await admin().rpc("release_broadcast_email_attempt", { p_email: address.toUpperCase() });
      assert.equal(error, null, error?.message);
      assert.equal(await signUp(address), true, "the retry after a failed mail was swallowed by the cooldown");
      assert.equal(await signUp(address), false, "releasing must not switch the cooldown off");
    } finally {
      await cleanOptin(address);
      await admin().from("broadcast_email_send_attempts").delete().gt("id", 0).gte("created_at", new Date(Date.now() - 60_000).toISOString());
    }
  });

  test("the release function is for the server only", { skip }, async () => {
    const { error } = await anon().rpc("release_broadcast_email_attempt", { p_email: "x@example.invalid" });
    assert.ok(error, "anon can release attempts");
  });

  test("the sign-up language is stored on a pending row and ignored for a bad value", { skip }, async () => {
    const address = email();
    try {
      await signUp(address);
      await admin().rpc("set_broadcast_optin_locale", { p_channel: "email", p_email: address, p_phone: "", p_locale: "es" });
      let { data } = await admin().from("broadcast_optins").select("locale").eq("email", address).single();
      assert.equal(data.locale, "es");
      await admin().rpc("set_broadcast_optin_locale", { p_channel: "email", p_email: address, p_phone: "", p_locale: "xx" });
      ({ data } = await admin().from("broadcast_optins").select("locale").eq("email", address).single());
      assert.equal(data.locale, "es", "an unknown language overwrote a good one");
    } finally {
      await cleanOptin(address);
    }
  });
});
