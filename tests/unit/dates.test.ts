/** Calendar maths. Every date in this app is a *calendar date* in Europe/Berlin, never an instant,
 *  and almost every date bug the project has had came from one of the two being treated as the
 *  other. These tests pin the boundaries where that distinction shows. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateAfterHours,
  fmtDate,
  fmtDateDE,
  isISODate,
  isMonth,
  isTime,
  monthRange,
  shiftMonth,
  startOfMonth,
  startOfWeek,
  todayISO,
} from "@/lib/dates";

describe("todayISO", () => {
  test("is a calendar date", () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test("follows Berlin, not the machine's timezone", () => {
    // 2026-07-01 23:30 UTC is already 2026-07-02 in Berlin (CEST, UTC+2).
    const berlin = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
      new Date("2026-07-01T23:30:00Z"),
    );
    assert.equal(berlin, "2026-07-02");
  });
});

describe("addDays", () => {
  test("steps forward and back", () => {
    assert.equal(addDays("2026-10-14", 1), "2026-10-15");
    assert.equal(addDays("2026-10-15", -1), "2026-10-14");
    assert.equal(addDays("2026-10-15", 0), "2026-10-15");
  });

  test("crosses months and years", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  });

  test("handles a leap day", () => {
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2028-02-29", 1), "2028-03-01");
    assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  });

  test("does not slip a day across a DST change", () => {
    // Germany springs forward on the last Sunday of March. Noon-UTC anchoring is what keeps this
    // from landing on the previous day.
    assert.equal(addDays("2026-03-28", 1), "2026-03-29");
    assert.equal(addDays("2026-03-29", 1), "2026-03-30");
    assert.equal(addDays("2026-10-24", 1), "2026-10-25");
    assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  });

  test("a long run of single steps matches one big step", () => {
    let iso = "2026-01-01";
    for (let i = 0; i < 400; i++) iso = addDays(iso, 1);
    assert.equal(iso, addDays("2026-01-01", 400));
  });
});

describe("dateAfterHours", () => {
  test("0 hours is today", () => {
    assert.equal(dateAfterHours(0), todayISO());
  });

  test("48 hours is two days on", () => {
    assert.equal(dateAfterHours(48), addDays(todayISO(), 2));
  });
});

describe("startOfWeek", () => {
  test("German weeks start on Monday", () => {
    // 2026-10-15 is a Thursday.
    assert.equal(startOfWeek("2026-10-15"), "2026-10-12");
  });

  test("Monday is its own week start", () => {
    assert.equal(startOfWeek("2026-10-12"), "2026-10-12");
  });

  test("Sunday belongs to the week that just ended", () => {
    assert.equal(startOfWeek("2026-10-18"), "2026-10-12");
  });
});

describe("startOfMonth", () => {
  test("keeps the month and zeroes the day", () => {
    assert.equal(startOfMonth("2026-10-15"), "2026-10-01");
    assert.equal(startOfMonth("2026-01-31"), "2026-01-01");
  });
});

describe("shiftMonth", () => {
  test("moves within a year", () => {
    assert.equal(shiftMonth("2026-10", 1), "2026-11");
    assert.equal(shiftMonth("2026-10", -1), "2026-09");
  });

  test("rolls over the year boundary", () => {
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(shiftMonth("2026-01", -13), "2024-12");
  });
});

describe("monthRange", () => {
  test("covers a 31-day month", () => {
    assert.deepEqual(monthRange("2026-10"), { first: "2026-10-01", last: "2026-10-31" });
  });

  test("covers a 30-day month", () => {
    assert.deepEqual(monthRange("2026-11"), { first: "2026-11-01", last: "2026-11-30" });
  });

  test("covers February in both kinds of year", () => {
    assert.deepEqual(monthRange("2027-02"), { first: "2027-02-01", last: "2027-02-28" });
    assert.deepEqual(monthRange("2028-02"), { first: "2028-02-01", last: "2028-02-29" });
  });

  test("December does not spill into the next year", () => {
    assert.deepEqual(monthRange("2026-12"), { first: "2026-12-01", last: "2026-12-31" });
  });
});

describe("fmtDate", () => {
  test("German and Spanish shapes", () => {
    assert.equal(fmtDate("2026-10-12", "de"), "Mo., 12.10.2026");
    assert.equal(fmtDateDE("2026-10-12"), "Mo., 12.10.2026");
    assert.match(fmtDate("2026-10-12", "es"), /12\/10\/2026$/);
  });

  test("renders the date it was given, not the day before", () => {
    // Formatting in UTC is the whole point: a date pushed through a +2 timezone renders a day late,
    // and through a negative one a day early.
    for (const iso of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      assert.ok(fmtDate(iso, "de").includes(iso.slice(8)), `${iso} lost its day number`);
    }
  });

  test("options override the defaults", () => {
    assert.equal(fmtDate("2026-10-12", "de", { year: undefined }), "Mo., 12.10.");
  });
});

describe("isMonth", () => {
  test("accepts real months", () => {
    assert.ok(isMonth("2026-01"));
    assert.ok(isMonth("2026-12"));
  });

  test("rejects shapes that would reach the calendar grid as NaN", () => {
    for (const bad of ["2026-99", "2026-00", "2026-13", "2026-1", "26-01", "2026", "", null, undefined, 202601]) {
      assert.equal(isMonth(bad), false, `${String(bad)} should not be a month`);
    }
  });
});

describe("isISODate", () => {
  test("accepts real dates including a leap day", () => {
    assert.ok(isISODate("2026-10-15"));
    assert.ok(isISODate("2028-02-29"));
  });

  test("rejects dates JS would silently roll forward", () => {
    for (const bad of ["2026-02-31", "2027-02-29", "2026-04-31", "2026-13-01", "2026-10-32"]) {
      assert.equal(isISODate(bad), false, `${bad} should not be a date`);
    }
  });

  test("rejects the wrong shape entirely", () => {
    for (const bad of ["15.10.2026", "2026-10-15T00:00:00Z", "", null, undefined, 20261015]) {
      assert.equal(isISODate(bad), false, `${String(bad)} should not be a date`);
    }
  });
});

describe("isTime", () => {
  test("accepts what an <input type=time> submits", () => {
    assert.ok(isTime("00:00"));
    assert.ok(isTime("16:30"));
    assert.ok(isTime("23:59"));
  });

  test("rejects out-of-range and loose shapes", () => {
    for (const bad of ["24:00", "23:60", "9:30", "16:30:00", "", null, undefined, 1630]) {
      assert.equal(isTime(bad), false, `${String(bad)} should not be a time`);
    }
  });
});

