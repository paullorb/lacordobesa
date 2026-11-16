/**
 * The signed form ticket (src/lib/form-ticket.ts): the part of the abuse control that runs without a
 * database. A ticket has to be genuine, bound to its form, old enough to be a person and young
 * enough to be this page view.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkTicket, issueTicket, MAX_FORM_AGE_MS, MIN_FORM_AGE_MS } from "@/lib/form-ticket";

const KEY = "test-secret";
const T0 = 1_800_000_000_000;

describe("checkTicket", () => {
  test("accepts a genuine ticket once it is old enough", () => {
    const ticket = issueTicket(KEY, "reservation", T0);
    assert.equal(checkTicket(KEY, "reservation", ticket, T0 + MIN_FORM_AGE_MS), "ok");
    assert.equal(checkTicket(KEY, "reservation", ticket, T0 + 60_000), "ok");
  });

  test("a ticket used at once is too fast to be a person", () => {
    const ticket = issueTicket(KEY, "reservation", T0);
    assert.equal(checkTicket(KEY, "reservation", ticket, T0 + 100), "too_fast");
  });

  test("a ticket from a page left open all day has expired", () => {
    const ticket = issueTicket(KEY, "reservation", T0);
    assert.equal(checkTicket(KEY, "reservation", ticket, T0 + MAX_FORM_AGE_MS + 1), "expired");
  });

  test("a ticket is bound to its form and to the server's key", () => {
    const ticket = issueTicket(KEY, "reservation", T0);
    assert.equal(checkTicket(KEY, "waitlist", ticket, T0 + 10_000), "invalid");
    assert.equal(checkTicket("another-key", "reservation", ticket, T0 + 10_000), "invalid");
  });

  test("a forged timestamp does not verify", () => {
    const ticket = issueTicket(KEY, "reservation", T0);
    const forged = `${T0 - 10_000_000}.${ticket.split(".")[1]}`;
    assert.equal(checkTicket(KEY, "reservation", forged, T0 + 10_000), "invalid");
  });

  test("nothing, junk and non-strings are told apart", () => {
    assert.equal(checkTicket(KEY, "reservation", "", T0), "missing");
    assert.equal(checkTicket(KEY, "reservation", null, T0), "missing");
    assert.equal(checkTicket(KEY, "reservation", "not-a-ticket", T0), "invalid");
    assert.equal(checkTicket(KEY, "reservation", `${T0}.${"z".repeat(32)}`, T0), "invalid");
  });
});
