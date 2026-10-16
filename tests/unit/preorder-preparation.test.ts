/** The fresh-or-frozen choice for empanadas. The Server Action refuses anything outside the pair and
 *  the database check constraint says the same, so the three have to agree on what the pair is. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPreparation, PREPARATIONS, PREPARATION_STAFF_LABEL } from "@/lib/preorder-preparation";

describe("isPreparation", () => {
  test("accepts exactly fresh and frozen", () => {
    assert.deepEqual([...PREPARATIONS], ["fresh", "frozen"]);
    for (const value of PREPARATIONS) assert.equal(isPreparation(value), true);
  });

  test("refuses everything else, including the empty answer of a basket without empanadas", () => {
    for (const value of ["", "Fresh", "cold", null, undefined, 1]) assert.equal(isPreparation(value), false);
  });

  test("every value has a staff label", () => {
    for (const value of PREPARATIONS) assert.ok(PREPARATION_STAFF_LABEL[value]);
  });
});
