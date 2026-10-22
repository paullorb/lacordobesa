/**
 * What a partial save of the staff settings form does to the stored JSON.
 *
 * The form only carries a handful of the keys behind `reservations` and `preorders`. If saveSettings
 * rebuilt the object from the form, every other key (slot length, sitting length, lead times, ...)
 * would silently drop back to its default the first time anyone pressed Speichern.
 * saveSettings itself needs a request (requireStaff, updateTag), so the merge it relies on is pinned here.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RESERVATION_SETTINGS } from "@/lib/data";
import { DEFAULT_PREORDER_SETTINGS, type PreorderSettings } from "@/lib/preorders";
import { effectiveReservationSettings, mergeStored, reservationFormError } from "@/lib/settings-merge";
import type { ReservationSettings } from "@/lib/data";

const stored: ReservationSettings = {
  enabled: true,
  slot_minutes: 20,
  duration_minutes: 120,
  capacity_seats: 24,
  max_party_size: 10,
  min_lead_hours: 5,
  max_days_ahead: 45,
  last_seating_minutes_before_close: 30,
};

describe("mergeStored", () => {
  test("a partial submit keeps every key the form did not carry", () => {
    const merged = mergeStored<ReservationSettings>(stored, { enabled: false, capacity_seats: 30, max_party_size: 6 });
    assert.deepEqual(merged, { ...stored, enabled: false, capacity_seats: 30, max_party_size: 6 });
    assert.equal(merged.slot_minutes, 20);
    assert.equal(merged.duration_minutes, 120);
    assert.equal(merged.last_seating_minutes_before_close, 30);
  });

  test("a stored value is not replaced by the default when the form leaves it out", () => {
    const merged = mergeStored<PreorderSettings>({ ...DEFAULT_PREORDER_SETTINGS, max_lines: 3, max_quantity: 7 }, { enabled: false });
    assert.equal(merged.enabled, false);
    assert.equal(merged.max_lines, 3);
    assert.equal(merged.max_quantity, 7);
    assert.notEqual(merged.max_lines, DEFAULT_PREORDER_SETTINGS.max_lines);
  });

  test("a submitted false and 0 win over what was stored", () => {
    const merged = mergeStored<ReservationSettings>(stored, { enabled: false, min_lead_hours: 0 });
    assert.equal(merged.enabled, false);
    assert.equal(merged.min_lead_hours, 0);
  });

  test("missing or malformed stored values start from nothing instead of throwing", () => {
    for (const bad of [undefined, null, "text", 5, [1, 2]]) {
      assert.deepEqual(mergeStored<PreorderSettings>(bad, { enabled: true }), { enabled: true });
    }
  });

  test("does not modify what it was given", () => {
    const before = structuredClone(stored);
    mergeStored<ReservationSettings>(stored, { capacity_seats: 1 });
    assert.deepEqual(stored, before);
  });
});

describe("effectiveReservationSettings", () => {
  test("stored keys win over the defaults, missing keys fall back to them", () => {
    const e = effectiveReservationSettings({ capacity_seats: 33 });
    assert.equal(e.capacity_seats, 33);
    assert.equal(e.slot_minutes, DEFAULT_RESERVATION_SETTINGS.slot_minutes);
  });
});

describe("reservationFormError", () => {
  test("accepts one seat and one person, refuses zero", () => {
    assert.equal(reservationFormError({ capacity_seats: 1, max_party_size: 1 }), null);
    assert.match(reservationFormError({ capacity_seats: 0, max_party_size: 4 }) ?? "", /Ingresá valores válidos/);
    assert.match(reservationFormError({ capacity_seats: 20, max_party_size: 0 }) ?? "", /Ingresá valores válidos/);
  });
});
