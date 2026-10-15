/** The numbers page. A "cover" counts seats, never bookings, and never counts somebody who did
 *  not sit down, so these tests mostly pin what is *excluded* from each figure. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reservationStats, topPreorderedDishes, type ReservationRow } from "@/lib/staff-stats";

const TODAY = "2026-10-15"; // a Thursday

const row = (over: Partial<ReservationRow> = {}): ReservationRow => ({
  date: TODAY,
  start_time: "19:00:00",
  party_size: 2,
  status: "confirmed",
  source: "web",
  ...over,
});

describe("covers", () => {
  test("count seats, not bookings", () => {
    const stats = reservationStats([row({ party_size: 2 }), row({ party_size: 5 })], TODAY);
    assert.equal(stats.coversToday, 7);
  });

  test("leave out cancellations and no-shows", () => {
    const stats = reservationStats(
      [row({ party_size: 4 }), row({ party_size: 4, status: "cancelled" }), row({ party_size: 4, status: "no_show" })],
      TODAY,
    );
    assert.equal(stats.coversToday, 4);
  });

  test("count a pending booking today, because those people are still expected", () => {
    assert.equal(reservationStats([row({ status: "pending", party_size: 3 })], TODAY).coversToday, 3);
  });

  test("do not count a pending booking from a past day, which was simply never answered", () => {
    const stats = reservationStats([row({ date: "2026-10-13", status: "pending", party_size: 3 })], TODAY);
    assert.equal(stats.coversWeek, 0);
  });

  test("the week starts on Monday and ends today", () => {
    const stats = reservationStats(
      [
        row({ date: "2026-10-11", party_size: 10 }), // Sunday, previous week
        row({ date: "2026-10-12", party_size: 2 }), // Monday, this week
        row({ date: "2026-10-15", party_size: 3 }), // today
        row({ date: "2026-10-16", party_size: 8 }), // tomorrow, not yet
      ],
      TODAY,
    );
    assert.equal(stats.coversWeek, 5);
  });

  test("the month starts on the first", () => {
    const stats = reservationStats(
      [
        row({ date: "2026-09-30", party_size: 9 }),
        row({ date: "2026-10-01", party_size: 2 }),
        row({ date: "2026-10-15", party_size: 2 }),
      ],
      TODAY,
    );
    assert.equal(stats.coversMonth, 4);
  });
});

describe("rates", () => {
  test("are judged only on bookings whose day has passed", () => {
    const stats = reservationStats(
      [row({ date: "2026-10-14", status: "no_show" }), row({ date: "2026-10-14", status: "completed" })],
      TODAY,
    );
    assert.deepEqual(stats.noShow, { value: 1, of: 2, percent: 50 });
  });

  test("a booking still in the future cannot be a no-show yet", () => {
    const stats = reservationStats([row({ date: "2026-10-20" }), row({ date: "2026-10-14", status: "no_show" })], TODAY);
    assert.equal(stats.noShow.of, 1);
  });

  test("a past booking nobody answered is left out of the denominator", () => {
    const stats = reservationStats(
      [row({ date: "2026-10-14", status: "pending" }), row({ date: "2026-10-14", status: "completed" })],
      TODAY,
    );
    assert.equal(stats.cancelled.of, 1);
  });

  test("nothing to divide by is 'no data yet', not nought per cent", () => {
    const stats = reservationStats([], TODAY);
    assert.equal(stats.noShow.percent, null);
    assert.equal(stats.cancelled.percent, null);
    assert.equal(stats.online.percent, null);
    assert.equal(stats.averageParty, null);
  });

  test("the online share counts everything the team did not type in", () => {
    const stats = reservationStats([row({ source: "web" }), row({ source: "staff" }), row({ source: "web" })], TODAY);
    assert.deepEqual(stats.online, { value: 2, of: 3, percent: 67 });
  });
});

describe("averageParty", () => {
  test("is seats per seated booking, to one decimal", () => {
    const stats = reservationStats([row({ party_size: 2 }), row({ party_size: 3 }), row({ party_size: 2 })], TODAY);
    assert.equal(stats.averageParty, 2.3);
  });

  test("ignores bookings nobody showed up for", () => {
    const stats = reservationStats([row({ party_size: 4 }), row({ party_size: 20, status: "cancelled" })], TODAY);
    assert.equal(stats.averageParty, 4);
  });
});

describe("byWeekday", () => {
  test("reads Monday first", () => {
    const stats = reservationStats([], TODAY);
    assert.deepEqual(
      stats.byWeekday.map((b) => b.label),
      ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    );
  });

  test("puts a Thursday booking under Do", () => {
    const stats = reservationStats([row({ date: "2026-10-15", party_size: 6 })], TODAY);
    assert.equal(stats.byWeekday.find((b) => b.label === "Do")?.value, 6);
    assert.equal(stats.byWeekday.find((b) => b.label === "Mo")?.value, 0);
  });

  test("puts a Sunday booking under So, not under Mo", () => {
    const stats = reservationStats([row({ date: "2026-10-11", party_size: 6 })], TODAY);
    assert.equal(stats.byWeekday.find((b) => b.label === "So")?.value, 6);
  });
});

describe("byHour", () => {
  test("is sorted by the clock and labelled in German", () => {
    const stats = reservationStats(
      [row({ start_time: "20:30:00" }), row({ start_time: "18:00:00" }), row({ start_time: "18:45:00" })],
      TODAY,
    );
    assert.deepEqual(stats.byHour, [
      { label: "18 Uhr", value: 4 },
      { label: "20 Uhr", value: 2 },
    ]);
  });

  test("pads a morning hour, so the labels line up", () => {
    const stats = reservationStats([row({ start_time: "09:15:00" })], TODAY);
    assert.equal(stats.byHour[0].label, "09 Uhr");
  });

  test("has no entry for an hour nobody booked", () => {
    assert.deepEqual(reservationStats([], TODAY).byHour, []);
  });
});

describe("bookingsWindow", () => {
  test("counts every row, including the ones no figure above uses", () => {
    const rows = [row(), row({ status: "cancelled" }), row({ date: "2026-10-01", status: "no_show" })];
    assert.equal(reservationStats(rows, TODAY).bookingsWindow, 3);
  });
});

describe("topPreorderedDishes", () => {
  test("adds up the same dish across orders", () => {
    const bars = topPreorderedDishes([
      { label: "Empanada Criolla", quantity: 6 },
      { label: "Empanada Criolla", quantity: 6 },
      { label: "Flan", quantity: 2 },
    ]);
    assert.deepEqual(bars, [
      { label: "Empanada Criolla", value: 12 },
      { label: "Flan", value: 2 },
    ]);
  });

  test("breaks a tie alphabetically, so the order is stable between loads", () => {
    const bars = topPreorderedDishes([
      { label: "Provoleta", quantity: 3 },
      { label: "Alfajor", quantity: 3 },
    ]);
    assert.deepEqual(
      bars.map((b) => b.label),
      ["Alfajor", "Provoleta"],
    );
  });

  test("caps the list, because the point is the top of it", () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ label: `Dish ${i}`, quantity: i }));
    assert.equal(topPreorderedDishes(lines).length, 6);
    assert.equal(topPreorderedDishes(lines, 3).length, 3);
  });

  test("is empty when nobody has pre-ordered", () => {
    assert.deepEqual(topPreorderedDishes([]), []);
  });
});
