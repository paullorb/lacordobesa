/**
 * The month view behind /staff/reservierungen and /staff/oeffnungszeiten.
 *
 * `monthParam` is the interesting half. It validates `?monat=` with isMonth() rather than a shape
 * regex, because "2026-99" matches /^\d{4}-\d{2}$/ and then reaches MonthCalendar as an invalid
 * Date, where building the grid throws RangeError: a hand-edited query string has to give you the
 * current month, not a 500 on a staff phone.
 *
 * `loadCalendarMonth` takes its client as an argument, so it can be driven with a fake one and the
 * aggregation (one row per reservation, guests summed, closures merged onto the same day) is pinned
 * here without touching a database.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadCalendarMonth, monthParam } from "@/lib/staff-calendar";

describe("monthParam", () => {
  test("takes a valid month from the query string", () => {
    assert.equal(monthParam({ monat: "2026-03" }, "2026-10-16"), "2026-03");
  });

  test("falls back to the month of the fallback date", () => {
    assert.equal(monthParam({}, "2026-10-16"), "2026-10");
    assert.equal(monthParam({ monat: undefined }, "2026-10-16"), "2026-10");
  });

  test("rejects a month number that would throw on the calendar grid", () => {
    // The whole reason isMonth() is used instead of a regex.
    for (const monat of ["2026-00", "2026-13", "2026-99"]) {
      assert.equal(monthParam({ monat }, "2026-10-16"), "2026-10", `${monat} should not be accepted`);
    }
  });

  test("rejects anything that is not a month at all", () => {
    for (const monat of ["", "oktober", "2026", "2026-1", "2026-10-16", "../2026-10", "20261"]) {
      assert.equal(monthParam({ monat }, "2026-10-16"), "2026-10", `"${monat}" should not be accepted`);
    }
  });

  test("rejects a repeated parameter, which arrives as an array", () => {
    assert.equal(monthParam({ monat: ["2026-03", "2026-04"] }, "2026-10-16"), "2026-10");
  });
});

/** A Supabase client that answers the three queries loadCalendarMonth makes. Every builder method
 *  returns the same thenable, which is how the real client chains. */
function fakeClient(tables: Record<string, unknown[]>) {
  const calls: { table: string; filters: string[] }[] = [];
  return {
    calls,
    from(table: string) {
      const record = { table, filters: [] as string[] };
      calls.push(record);
      const builder: Record<string, unknown> = {
        then: (resolve: (value: { data: unknown[] }) => unknown) => resolve({ data: tables[table] ?? [] }),
      };
      for (const method of ["select", "gte", "lte", "in", "eq", "order"]) {
        builder[method] = (...args: unknown[]) => {
          record.filters.push(`${method}(${args.join(",")})`);
          return builder;
        };
      }
      return builder;
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const load = (client: ReturnType<typeof fakeClient>, month: string) => loadCalendarMonth(client as any, month);

describe("loadCalendarMonth", () => {
  test("counts one reservation per row and adds up the guests", async () => {
    const client = fakeClient({
      reservations: [
        { date: "2026-10-16", party_size: 2 },
        { date: "2026-10-16", party_size: 4 },
        { date: "2026-10-17", party_size: 3 },
      ],
    });
    const { days } = await load(client, "2026-10");
    assert.deepEqual(days["2026-10-16"], { reservations: 2, guests: 6 });
    assert.deepEqual(days["2026-10-17"], { reservations: 1, guests: 3 });
  });

  test("asks only for the month's own range, and only for live bookings", async () => {
    const client = fakeClient({});
    await load(client, "2026-10");
    const reservations = client.calls.find((c) => c.table === "reservations");
    assert.ok(reservations, "reservations were not queried");
    assert.ok(reservations.filters.includes("gte(date,2026-10-01)"), reservations.filters.join(" "));
    assert.ok(reservations.filters.includes("lte(date,2026-10-31)"), reservations.filters.join(" "));
    // A cancelled booking must not show as a guest on the calendar.
    assert.ok(
      reservations.filters.some((f) => f.startsWith("in(status,") && f.includes("pending") && f.includes("confirmed")),
      reservations.filters.join(" "),
    );
  });

  test("gets February's length right in a leap year", async () => {
    const client = fakeClient({});
    await load(client, "2028-02");
    const reservations = client.calls.find((c) => c.table === "reservations");
    assert.ok(reservations!.filters.includes("lte(date,2028-02-29)"), reservations!.filters.join(" "));
  });

  test("marks a closure, and carries its reason", async () => {
    const client = fakeClient({ closures: [{ date: "2026-10-20", reason: "Betriebsurlaub" }] });
    const { days } = await load(client, "2026-10");
    assert.equal(days["2026-10-20"].closed, true);
    assert.equal(days["2026-10-20"].closedReason, "Betriebsurlaub");
  });

  test("turns a closure with no reason into undefined, not null", async () => {
    // DayInfo's closedReason is optional, so null would render as the word "null" on the calendar.
    const client = fakeClient({ closures: [{ date: "2026-10-20", reason: null }] });
    const { days } = await load(client, "2026-10");
    assert.equal(days["2026-10-20"].closedReason, undefined);
  });

  test("a closed day that also has bookings keeps both facts", async () => {
    const client = fakeClient({
      reservations: [{ date: "2026-10-20", party_size: 2 }],
      closures: [{ date: "2026-10-20", reason: "Feiertag" }],
    });
    const { days } = await load(client, "2026-10");
    assert.deepEqual(days["2026-10-20"], { reservations: 1, guests: 2, closed: true, closedReason: "Feiertag" });
  });

  test("reports the weekly closing days, and only the closed ones", async () => {
    const client = fakeClient({
      opening_hours: [
        { weekday: 0, is_closed: true },
        { weekday: 1, is_closed: false },
        { weekday: 2, is_closed: true },
      ],
    });
    const { weeklyClosed } = await load(client, "2026-10");
    assert.deepEqual(weeklyClosed, [0, 2]);
  });

  test("an empty month is an empty object, not a crash", async () => {
    const { days, weeklyClosed } = await load(fakeClient({}), "2026-10");
    assert.deepEqual(days, {});
    assert.deepEqual(weeklyClosed, []);
  });

  test("survives a query that returns null instead of rows", async () => {
    // Every one of the three selects can come back { data: null } on an error.
    const client = {
      from: () => ({ then: (r: (v: { data: null }) => unknown) => r({ data: null }), select: () => client.from(), gte: () => client.from(), lte: () => client.from(), in: () => client.from() }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { days, weeklyClosed } = await loadCalendarMonth(client as any, "2026-10");
    assert.deepEqual(days, {});
    assert.deepEqual(weeklyClosed, []);
  });
});
