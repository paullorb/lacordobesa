/**
 * The facts printed on Impressum and Datenschutzerklärung.
 *
 * These are a legal obligation (§5 DDG for the Impressum, Art. 13 GDPR for the privacy notice) and
 * they are currently placeholders in square brackets, with a TODO in lib/legal.ts to replace them
 * before going live. That is a decision, not an oversight, so this file does not fail on the
 * placeholders. What it does is keep the shape intact and make the remaining placeholders countable,
 * so "is the Impressum filled in yet" has an answer that is not somebody reading the page.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { LEGAL } from "@/lib/legal";

/** A value still in square brackets has not been filled in. */
const isPlaceholder = (value: string) => /\[.*\]/.test(value);

describe("LEGAL", () => {
  test("has every field the two pages read", () => {
    assert.deepEqual(Object.keys(LEGAL).sort(), [
      "businessName",
      "ownerName",
      "privacyUpdated",
      "reservationRetention",
      "vatId",
    ]);
  });

  test("every field is a string, so nothing renders as undefined", () => {
    for (const [key, value] of Object.entries(LEGAL)) {
      assert.equal(typeof value, "string", `${key} is not a string`);
    }
  });

  test("the fields that are already real are not blank", () => {
    // vatId is deliberately allowed to be empty: a Kleinunternehmer without a USt-ID has none.
    for (const key of ["ownerName", "businessName", "privacyUpdated", "reservationRetention"] as const) {
      assert.ok(LEGAL[key].trim().length > 0, `${key} is blank, so the page prints nothing where the law wants a fact`);
    }
  });

  test("the VAT id is either absent or the right shape", () => {
    // A malformed one is worse than none: it is printed as fact on the Impressum.
    if (LEGAL.vatId !== "") assert.match(LEGAL.vatId, /^DE\d{9}$/, "a German USt-ID is DE plus nine digits");
  });

  test("uses no dash in the German copy, which is the house rule", () => {
    for (const [key, value] of Object.entries(LEGAL)) {
      assert.ok(!/[—–]/.test(value), `${key} contains a dash`);
    }
  });

  test("records which fields are still placeholders, so going live has a checklist", () => {
    const outstanding = Object.entries(LEGAL)
      .filter(([, value]) => isPlaceholder(value))
      .map(([key]) => key);
    // Not an assertion that the list is empty: the owner has not supplied these yet. The count is
    // pinned so that filling one in, or adding a new placeholder, shows up here as a change.
    assert.deepEqual(outstanding, ["ownerName", "businessName"], "the Impressum placeholder list changed");
  });
});
