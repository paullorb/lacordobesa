/**
 * `join_waitlist`: the refusals that need no full day.
 *
 * NOT RUN when written: there was no Docker in the session that added this file, so it has never
 * executed. Run `npm run test:integration` before trusting it.
 *
 * Only a full day has a waitlist (every slot exists and none has a free seat; migration
 * 20261014024537). The accepted path therefore needs a day filled to capacity in every slot, which
 * means either many bookings against the 15 an hour brake or temporarily rewriting
 * site_settings.reservations. Neither is done here; what is pinned is that the RPC does not queue a
 * guest for a day that still has room, and that it validates before it looks at the day.
 */
import { test, describe, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { admin, bookableDates, berlinToday, cleanup, rpcError, skip, TEST_NAME, testPhone } from "./harness.mjs";

afterEach(cleanup);
after(cleanup);

const DAYS = skip ? [] : await bookableDates(1);

const entry = (over = {}) => ({
  p_name: TEST_NAME,
  p_phone: testPhone(),
  p_email: null,
  p_date: DAYS[0],
  p_party_size: 2,
  p_time_preference: null,
  ...over,
});

describe("join_waitlist", () => {
  test("refuses a day that still has a free seat: book it instead (not_full)", { skip }, async () => {
    const message = await rpcError(admin(), "join_waitlist", entry());
    assert.match(message, /not_full/);
    const { count } = await admin().from("waitlist_entries").select("*", { count: "exact", head: true }).eq("name", TEST_NAME);
    assert.equal(count, 0, "a refused request left a row behind");
  });

  test("refuses a party larger than the room takes (party_too_large)", { skip }, async () => {
    assert.match(await rpcError(admin(), "join_waitlist", entry({ p_party_size: 99 })), /party_too_large/);
  });

  test("refuses a day that has already gone (in_the_past)", { skip }, async () => {
    const yesterday = new Date(`${berlinToday()}T12:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    assert.match(await rpcError(admin(), "join_waitlist", entry({ p_date: yesterday.toISOString().slice(0, 10) })), /in_the_past/);
  });

  test("refuses an unusable phone number (invalid_contact)", { skip }, async () => {
    assert.match(await rpcError(admin(), "join_waitlist", entry({ p_phone: "abc" })), /invalid_contact/);
  });
});
