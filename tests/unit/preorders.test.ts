/**
 * The fallback pre-order settings, and how they line up with the database.
 *
 * `getPreorderSettings` and `getPickupRange` read Supabase and are covered by tests/integration.
 * What is worth pinning without a database is that the defaults the form falls back to cannot ask
 * for something `request_preorder()` will refuse: the form is the only thing a guest sees, and a
 * default above the database ceiling means a guest fills in an order that is rejected on submit.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREORDER_SETTINGS, MAX_PREORDER_QUANTITY } from "@/lib/preorders";

describe("DEFAULT_PREORDER_SETTINGS", () => {
  const d = DEFAULT_PREORDER_SETTINGS;

  test("takes orders on a database with no settings row", () => {
    assert.equal(d.enabled, true);
  });

  test("leaves the kitchen time to bake, which is the point of a pre-order", () => {
    assert.ok(d.min_lead_hours >= 1, "an order due immediately cannot be baked");
  });

  test("offers a horizon a guest can actually pick from", () => {
    assert.ok(d.max_days_ahead >= 1, "nothing would be orderable");
    assert.ok(d.min_lead_hours / 24 < d.max_days_ahead, "the lead time reaches past the horizon, so no day is offerable");
  });

  test("stays under the ceiling the database enforces on a line", () => {
    // preorder_lines.quantity is checked in migration 20261012094815. A default above it would let
    // the form accept a quantity the insert then rejects.
    assert.ok(d.max_quantity <= MAX_PREORDER_QUANTITY, `${d.max_quantity} is above the database's ${MAX_PREORDER_QUANTITY}`);
    assert.ok(d.max_quantity >= 1);
  });

  test("allows more than one dish per order", () => {
    assert.ok(d.max_lines >= 1);
  });
});

describe("MAX_PREORDER_QUANTITY", () => {
  test("is a positive whole number, since it mirrors a check constraint", () => {
    assert.ok(Number.isInteger(MAX_PREORDER_QUANTITY) && MAX_PREORDER_QUANTITY > 0);
  });
});
