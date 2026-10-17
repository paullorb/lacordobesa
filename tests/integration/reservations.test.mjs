/**
 * `request_reservation` and the guest's own management links.
 *
 * This function is the single gate between a public form and the shop's calendar, and it had no
 * test. It raises twelve different codes, every one of which the Server Action turns into a
 * sentence a guest reads (lib/form-errors.ts), so each code is part of the contract: renaming one
 * silently downgrades a precise message to the generic "that did not work".
 *
 * It is called here with the **secret** key, because that is how it is called in production: the
 * Server Action takes a unit of the caller's quota and then calls the RPC, and `anon` has had no
 * execute on it since migration 20261014072715 (see grants.test.mjs).
 *
 * ## Housekeeping
 *
 * `afterEach(cleanup)` is not tidiness. The function has a site-wide brake of 15 requests an hour
 * counted straight off `reservations.created_at`, so rows left behind by this file would spend the
 * allowance for the browser suite and for anyone testing a form by hand, and the resulting
 * `too_many_requests` would look like a bug in the booking form. Clearing after every test keeps at
 * most two test rows in the table at a time.
 */
import { test, describe, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, bookableDates, berlinDatePlus, berlinToday, cleanup, rpcError, skip, TEST_NAME, testPhone, track } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

/**
 * Five days the calendar really has room on, from five days out: far enough that the lead time
 * allows them, and found by asking, so the shop's rest day is never one of them.
 */
const DAYS = skip ? [] : await bookableDates(5);

/** The usual day for a booking. */
const SOON = DAYS[2];

/** The first slot on `date` with room for `seats`, read the way the form reads it. */
async function freeSlot(date = SOON, seats = 2) {
  const { data, error } = await anon().rpc("reservation_availability", { p_date: date });
  assert.equal(error, null, `reservation_availability failed: ${error?.message}`);
  const slot = (data ?? []).find((s) => s.seats_left >= seats);
  assert.ok(slot, `no slot on ${date} has room for ${seats}`);
  return slot.slot;
}

/** The arguments of a booking that should succeed, with anything overridden. */
const booking = (over = {}) => ({
  p_name: TEST_NAME,
  p_phone: testPhone(),
  p_email: null,
  p_party_size: 2,
  p_date: SOON,
  p_time: "16:00:00",
  p_notes: null,
  p_locale: "de",
  ...over,
});

/** Books, remembers the row for cleanup, and returns its id. */
async function book(over = {}) {
  const { data, error } = await admin().rpc("request_reservation", booking(over));
  assert.equal(error, null, `the booking was refused: ${error?.message}`);
  return track("reservations", data);
}

describe("a booking that should work", () => {
  test("is created as pending, so staff confirm it rather than the guest", { skip }, async () => {
    const id = await book({ p_time: await freeSlot() });
    const { data } = await admin().from("reservations").select("*").eq("id", id).single();
    assert.equal(data.status, "pending");
    assert.equal(data.party_size, 2);
    assert.equal(data.date, SOON);
  });

  test("gets a management token, which is what the confirmation mail links to", { skip }, async () => {
    const id = await book({ p_time: await freeSlot() });
    const { data } = await admin().from("reservations").select("manage_token").eq("id", id).single();
    assert.ok(data.manage_token, "no management token was generated");
    assert.ok(data.manage_token.length >= 16, `a ${data.manage_token.length} character token is guessable`);
  });

  test("remembers the language the guest booked in, for the confirmation mail", { skip }, async () => {
    for (const locale of ["de", "es", "en"]) {
      const id = await book({ p_time: await freeSlot(), p_locale: locale });
      const { data } = await admin().from("reservations").select("locale").eq("id", id).single();
      assert.equal(data.locale, locale);
      await cleanup();
    }
  });

  test("falls back to German for a locale the site does not have, rather than refusing the booking", { skip }, async () => {
    // A booking is worth more than a correctly tagged language.
    const id = await book({ p_time: await freeSlot(), p_locale: "fr" });
    const { data } = await admin().from("reservations").select("locale").eq("id", id).single();
    assert.equal(data.locale, "de");
  });

  test("trims the guest's input rather than storing the padding", { skip }, async () => {
    const id = await book({ p_time: await freeSlot(), p_name: `  ${TEST_NAME}  `, p_notes: "  am Fenster  " });
    const { data } = await admin().from("reservations").select("name, notes").eq("id", id).single();
    assert.equal(data.name, TEST_NAME);
    assert.equal(data.notes, "am Fenster");
  });

  test("stores an empty note as nothing, not as an empty string", { skip }, async () => {
    const id = await book({ p_time: await freeSlot(), p_notes: "   " });
    const { data } = await admin().from("reservations").select("notes").eq("id", id).single();
    assert.equal(data.notes, null);
  });
});

describe("the guest's contact details are validated", () => {
  test("a name of one character is refused", { skip }, async () => {
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_name: "A" })), "invalid_contact");
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_name: "  " })), "invalid_contact");
  });

  test("a phone number with letters in it is refused", { skip }, async () => {
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_phone: "call me" })), "invalid_contact");
  });

  test("a phone number with too few digits is refused", { skip }, async () => {
    // The pattern allows +()./ and spaces, so the digit count is a separate check.
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_phone: "+49 1" })), "invalid_contact");
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_phone: "()/ ." })), "invalid_contact");
  });

  test("the punctuation people actually write a phone number with is accepted", { skip }, async () => {
    const id = await book({ p_time: await freeSlot(), p_phone: "+49 (0)69 / 123.456" });
    assert.ok(id, "a normally written phone number was refused");
  });

  test("an address that is not an e-mail address is refused", { skip }, async () => {
    for (const email of ["not-an-email", "a@b", "a b@example.com", "a@@example.com"]) {
      assert.equal(await rpcError(admin(), "request_reservation", booking({ p_email: email })), "invalid_contact", email);
    }
  });

  test("no e-mail address at all is fine, because the phone number is the one that matters", { skip }, async () => {
    const id = await book({ p_time: await freeSlot(), p_email: null });
    assert.ok(id);
    await cleanup();
    assert.ok(await book({ p_time: await freeSlot(), p_email: "  " }), "a blank e-mail should be treated as none");
  });

  test("an over-long field is refused before anything is stored", { skip }, async () => {
    const cases = [
      ["p_name", "x".repeat(101)],
      ["p_phone", "1".repeat(31)],
      ["p_email", `${"x".repeat(250)}@example.com`],
      ["p_notes", "x".repeat(501)],
    ];
    for (const [field, value] of cases) {
      assert.equal(await rpcError(admin(), "request_reservation", booking({ [field]: value })), "field_too_long", field);
    }
  });

  test("the length is measured before trimming, so padding cannot sneak past it", { skip }, async () => {
    // A 95 character name padded to 105 is still refused: the raw value is what is checked.
    const padded = `${" ".repeat(10)}${"x".repeat(95)}`;
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_name: padded })), "field_too_long");
  });
});

describe("the party size has to fit the room", () => {
  test("nothing and nobody are refused", { skip }, async () => {
    for (const size of [null, 0, -1]) {
      assert.equal(await rpcError(admin(), "request_reservation", booking({ p_party_size: size })), "party_too_large", String(size));
    }
  });

  test("a party larger than the setting is refused", { skip }, async () => {
    const { data: settings } = await anon().rpc("reservation_settings");
    const tooMany = Number(settings.max_party_size) + 1;
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_party_size: tooMany })), "party_too_large");
  });

  test("a party of exactly the maximum is accepted", { skip }, async () => {
    const { data: settings } = await anon().rpc("reservation_settings");
    const max = Number(settings.max_party_size);
    const id = await book({ p_party_size: max, p_time: await freeSlot(SOON, max) });
    assert.ok(id, `a party of ${max}, which is the stated maximum, was refused`);
  });
});

describe("the date and time have to be bookable", () => {
  test("a date past the planning horizon is refused", { skip }, async () => {
    const { data: settings } = await anon().rpc("reservation_settings");
    const beyond = berlinDatePlus(Number(settings.max_days_ahead) + 2);
    assert.equal(await rpcError(admin(), "request_reservation", booking({ p_date: beyond })), "too_far_ahead");
  });

  test("a time inside the lead window is refused as too_soon, not as unavailable", { skip }, async () => {
    // The guest has to be told "call us" rather than "pick another time".
    const code = await rpcError(admin(), "request_reservation", booking({ p_date: berlinToday(), p_time: "00:01:00" }));
    assert.equal(code, "too_soon");
  });

  test("a date in the past is refused", { skip }, async () => {
    const code = await rpcError(admin(), "request_reservation", booking({ p_date: berlinDatePlus(-1), p_time: "19:00:00" }));
    assert.equal(code, "too_soon", "a past date should be refused by the lead-time check");
  });

  test("a time the shop does not offer is refused as slot_unavailable", { skip }, async () => {
    // 04:00 is inside no sitting, so availability has no such slot.
    const code = await rpcError(admin(), "request_reservation", booking({ p_time: "04:00:00" }));
    assert.equal(code, "slot_unavailable");
  });

  test("a time that is not on the slot grid is refused", { skip }, async () => {
    // Slots are every 15 minutes, so 16:07 exists on no calendar the form can draw.
    const code = await rpcError(admin(), "request_reservation", booking({ p_time: "16:07:00" }));
    assert.equal(code, "slot_unavailable");
  });
});

describe("the limits that stop one person filling the calendar", () => {
  test("the same phone number cannot book the same day twice", { skip }, async () => {
    const phone = testPhone();
    const time = await freeSlot();
    await book({ p_phone: phone, p_time: time });
    const code = await rpcError(admin(), "request_reservation", booking({ p_phone: phone, p_date: SOON, p_time: time }));
    assert.equal(code, "duplicate_booking");
  });

  test("a phone number is held to three open future bookings", { skip }, async () => {
    const phone = testPhone();
    // Three different days, so duplicate_booking is not what trips first.
    for (const date of DAYS.slice(0, 3)) {
      await book({ p_phone: phone, p_date: date, p_time: await freeSlot(date) });
    }
    const date = DAYS[3];
    const code = await rpcError(admin(), "request_reservation", booking({ p_phone: phone, p_date: date, p_time: await freeSlot(date) }));
    assert.equal(code, "too_many_requests");
  });

  test("the same e-mail address is counted too, not only the phone number", { skip }, async () => {
    // Otherwise rotating the phone number alone defeats the per-contact limit.
    const email = `zz-test-${Date.now()}@example.invalid`;
    for (const date of DAYS.slice(0, 3)) {
      await book({ p_phone: testPhone(), p_email: email, p_date: date, p_time: await freeSlot(date) });
    }
    const date = DAYS[4];
    const code = await rpcError(
      admin(),
      "request_reservation",
      booking({ p_phone: testPhone(), p_email: email, p_date: date, p_time: await freeSlot(date) }),
    );
    assert.equal(code, "too_many_requests");
  });

  test("a phone number is matched on its digits, not on how it was typed", { skip }, async () => {
    // phone_key() exists so that +4969123456 and 069 123 456 are one person.
    const time = await freeSlot();
    await book({ p_phone: "+49 69 1234567", p_time: time });
    const code = await rpcError(admin(), "request_reservation", booking({ p_phone: "+49(0)69/1234567", p_date: SOON, p_time: time }));
    assert.equal(code, "duplicate_booking", "the same number written differently was treated as a different person");
  });
});

describe("the guest's own management link", () => {
  /** Books and returns the row's token. */
  async function booked(over = {}) {
    const id = await book({ p_time: await freeSlot(), ...over });
    const { data } = await admin().from("reservations").select("manage_token").eq("id", id).single();
    return { id, token: data.manage_token };
  }

  test("shows the guest their booking with the publishable key", { skip }, async () => {
    const { token } = await booked();
    const { data, error } = await anon().rpc("reservation_by_token", { p_token: token });
    assert.equal(error, null);
    const row = Array.isArray(data) ? data[0] : data;
    assert.equal(row.party_size, 2);
    assert.equal(row.status, "pending");
  });

  test("shows nothing for a token that matches nothing, rather than failing", { skip }, async () => {
    const { data, error } = await anon().rpc("reservation_by_token", { p_token: "not-a-real-token" });
    assert.equal(error, null, "a wrong token should be an empty answer, not an error");
    assert.deepEqual(Array.isArray(data) ? data : [data].filter(Boolean), []);
  });

  test("hands out nothing that identifies another guest", { skip }, async () => {
    // The token is the credential for one booking. The row it returns must not carry the phone
    // number or e-mail address, so a leaked link does not leak contact details.
    const { token } = await booked({ p_email: "zz-leak@example.invalid" });
    const { data } = await anon().rpc("reservation_by_token", { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    for (const field of ["phone", "email", "staff_notes"]) {
      assert.ok(!(field in row), `reservation_by_token returns ${field}`);
    }
  });

  test("manage_token_valid tells a live token from a dead one", { skip }, async () => {
    const { token } = await booked();
    assert.equal((await anon().rpc("manage_token_valid", { p_token: token })).data, true);
    assert.equal((await anon().rpc("manage_token_valid", { p_token: "nope" })).data, false);
  });

  test("the guest can cancel, which is what gives the seat back", { skip }, async () => {
    const { id, token } = await booked();
    const { error } = await anon().rpc("cancel_reservation_by_token", { p_token: token });
    assert.equal(error, null, `cancelling failed: ${error?.message}`);
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "cancelled");
  });

  test("cancelling with a wrong token changes nothing", { skip }, async () => {
    const { id } = await booked();
    await anon().rpc("cancel_reservation_by_token", { p_token: "not-a-real-token" });
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "pending", "a wrong token cancelled a booking");
  });

  test("the guest can move the booking, and the new time is the one stored", { skip }, async () => {
    const { id, token } = await booked();
    const date = DAYS[4];
    const time = await freeSlot(date);
    const { error } = await anon().rpc("move_reservation_by_token", { p_token: token, p_date: date, p_time: time, p_party_size: 3 });
    assert.equal(error, null, `moving failed: ${error?.message}`);
    const { data } = await admin().from("reservations").select("date, start_time, party_size").eq("id", id).single();
    assert.equal(data.date, date);
    assert.equal(data.start_time, time);
    assert.equal(data.party_size, 3);
  });

  test("moving is counted, so a booking cannot be moved without end", { skip }, async () => {
    const { token } = await booked();
    const { data } = await anon().rpc("reservation_by_token", { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    assert.ok(typeof row.changes_left === "number", "the guest is not told how many changes are left");
    assert.ok(row.changes_left >= 0 && row.changes_left <= 5, `changes_left is ${row.changes_left}`);
  });

  test("a cancelled booking cannot be moved back to life", { skip }, async () => {
    const { id, token } = await booked();
    await anon().rpc("cancel_reservation_by_token", { p_token: token });
    const date = DAYS[4];
    await anon().rpc("move_reservation_by_token", { p_token: token, p_date: date, p_time: await freeSlot(date), p_party_size: 2 });
    const { data } = await admin().from("reservations").select("status").eq("id", id).single();
    assert.equal(data.status, "cancelled", "a cancelled booking was revived through its link");
  });
});

describe("reservation_availability", () => {
  test("is readable from the browser, because the calendar runs on it", { skip }, async () => {
    const { data, error } = await anon().rpc("reservation_availability", { p_date: SOON });
    assert.equal(error, null);
    assert.ok(Array.isArray(data) && data.length > 0, "no slots on a normal day");
  });

  test("every slot sits on the grid the settings describe", { skip }, async () => {
    const { data: settings } = await anon().rpc("reservation_settings");
    const step = Number(settings.slot_minutes);
    const { data } = await anon().rpc("reservation_availability", { p_date: SOON });
    for (const { slot } of data) {
      const [h, m] = slot.split(":").map(Number);
      assert.equal((h * 60 + m) % step, 0, `${slot} is not on a ${step} minute grid`);
    }
  });

  test("never offers more seats than the room has", { skip }, async () => {
    const { data: settings } = await anon().rpc("reservation_settings");
    const { data } = await anon().rpc("reservation_availability", { p_date: SOON });
    for (const { slot, seats_left } of data) {
      assert.ok(seats_left <= Number(settings.capacity_seats), `${slot} offers ${seats_left} of ${settings.capacity_seats} seats`);
      assert.ok(seats_left >= 0, `${slot} offers ${seats_left} seats`);
    }
  });

  test("a booking takes the seats out of the slot it was made for", { skip }, async () => {
    const time = await freeSlot();
    const before = (await anon().rpc("reservation_availability", { p_date: SOON })).data.find((s) => s.slot === time).seats_left;
    await book({ p_time: time, p_party_size: 2 });
    const after = (await anon().rpc("reservation_availability", { p_date: SOON })).data.find((s) => s.slot === time).seats_left;
    assert.equal(after, before - 2, "the booked seats are still on offer");
  });

  test("a closed day offers nothing", { skip }, async () => {
    // Whichever weekday the shop rests on; if it rests on none, this passes trivially.
    const { data: hours } = await admin().from("opening_hours").select("weekday, is_closed");
    const closed = (hours ?? []).find((h) => h.is_closed);
    if (!closed) return;
    for (let days = 1; days <= 7; days++) {
      const date = berlinDatePlus(days);
      if (new Date(`${date}T12:00:00Z`).getUTCDay() !== closed.weekday) continue;
      const { data } = await anon().rpc("reservation_availability", { p_date: date });
      assert.deepEqual(data, [], `${date} is a closing day but offers slots`);
      return;
    }
  });
});
