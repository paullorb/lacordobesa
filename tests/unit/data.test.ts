/**
 * The cache tags and the fallback settings behind the public pages.
 *
 * The getters themselves talk to Supabase and are covered by tests/integration. What is pinned here
 * is the part that has no database in it and still decides what a guest sees.
 *
 * The tags matter more than they look: public content is cached with `use cache` and is only ever
 * invalidated by `updateTag()` in a staff Server Action, so a tag that does not match between the
 * reader and the writer means the site keeps serving the old text with nothing to show that it is
 * stale (CLAUDE.md says the same thing about writing straight into site_settings).
 *
 * The defaults are what the shop runs on when `site_settings` has no row yet, which is the state a
 * fresh database and a failed read are both in.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RESERVATION_SETTINGS, fmtTime, TAG, WEEKDAYS_DE } from "@/lib/data";

describe("fmtTime", () => {
  test('turns a Postgres time into what a guest reads: "09:00:00" -> "09:00"', () => {
    assert.equal(fmtTime("09:00:00"), "09:00");
    assert.equal(fmtTime("23:30:00"), "23:30");
  });

  test("is already correct for a value with no seconds", () => {
    assert.equal(fmtTime("09:00"), "09:00");
  });

  test("drops a fractional second, which Postgres can return", () => {
    assert.equal(fmtTime("09:00:00.000000"), "09:00");
  });

  test("a closed day has no time, and must render as nothing rather than as null", () => {
    assert.equal(fmtTime(null), "");
    assert.equal(fmtTime(""), "");
  });
});

describe("WEEKDAYS_DE", () => {
  test("is indexed by getDay(), so Sunday comes first", () => {
    // opening_hours.weekday follows JavaScript's numbering, where 0 is Sunday. Starting this list
    // on Monday would print every opening time one day out.
    assert.equal(WEEKDAYS_DE.length, 7);
    assert.equal(WEEKDAYS_DE[0], "Sonntag");
    assert.equal(WEEKDAYS_DE[1], "Montag");
    assert.equal(WEEKDAYS_DE[6], "Samstag");
    assert.equal(WEEKDAYS_DE[new Date("2026-10-16T12:00:00Z").getUTCDay()], "Freitag");
  });

  test("uses no dash in any name, which is the house rule for German copy", () => {
    for (const day of WEEKDAYS_DE) assert.ok(!/[—–]/.test(day), `${day} contains a dash`);
  });
});

describe("TAG", () => {
  test("every tag is a distinct non-empty string", () => {
    const tags = Object.values(TAG);
    assert.ok(tags.every((t) => typeof t === "string" && t.length > 0));
    assert.equal(new Set(tags).size, tags.length, "two cache tags collide, so one invalidates the other");
  });

  test("names the three things staff can change", () => {
    assert.deepEqual(Object.keys(TAG).sort(), ["content", "gallery", "hours"]);
  });
});

describe("DEFAULT_RESERVATION_SETTINGS", () => {
  const d = DEFAULT_RESERVATION_SETTINGS;

  test("lets a guest book on a database with no settings row", () => {
    assert.equal(d.enabled, true);
  });

  test("is internally consistent, so the calendar it produces is not empty", () => {
    assert.ok(d.slot_minutes > 0, "a slot length of zero generates no slots at all");
    assert.ok(d.duration_minutes >= d.slot_minutes, "a sitting shorter than a slot");
    assert.ok(d.max_days_ahead >= 1, "nothing would be bookable");
    assert.ok(d.min_lead_hours >= 0);
    assert.ok(d.max_party_size >= 1 && d.max_party_size <= d.capacity_seats, "a party larger than the whole room");
    assert.ok(d.last_seating_minutes_before_close >= 0);
  });

  test("a sitting fits between the last seating and closing time", () => {
    // Otherwise the last bookable slot runs past the time the shop locks the door.
    assert.ok(
      d.last_seating_minutes_before_close <= d.duration_minutes,
      "the last seating is further from closing than a sitting is long, so an hour is given away",
    );
  });

  test("the slot length divides an hour, so slots land on readable times", () => {
    assert.equal(60 % d.slot_minutes, 0, `${d.slot_minutes} minute slots drift off the clock`);
  });
});
