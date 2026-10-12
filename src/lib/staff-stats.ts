/** Aggregations for the staff numbers page.
 *
 *  Pure functions over rows the page already fetched, rather than SQL. A 20-seat bakery produces a
 *  few hundred reservations a quarter, so the whole window fits in one bounded query, and keeping the
 *  arithmetic here means no extra migration stands between the team and their numbers.
 *
 *  A "cover" (Gast) counts seats, not bookings, and never counts a cancelled or no-show booking:
 *  those are people who did not sit down. */

import { startOfMonth, startOfWeek } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

/** Short weekday labels, Monday first, as the team reads a week. Spelled out here rather than taken
 *  from WEEKDAYS_DE so this module stays free of the server-only data layer and can be run on its own. */
const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export type ReservationRow = Pick<Tables<"reservations">, "date" | "start_time" | "party_size" | "status" | "source">;

/** Bookings where somebody actually sat down (or still intends to). */
const SEATED = new Set(["pending", "confirmed", "completed"]);

const covers = (rows: ReservationRow[]) =>
  rows.filter((r) => SEATED.has(r.status)).reduce((n, r) => n + r.party_size, 0);

export type Rate = { value: number; of: number; percent: number | null };

/** A share with its denominator kept, so the page can say "3 von 48" instead of a bare 6 %.
 *  percent is null when there is nothing to divide by: 0 of 0 is not 0 %, it is "noch keine Daten". */
function rate(value: number, of: number): Rate {
  return { value, of, percent: of > 0 ? Math.round((value / of) * 100) : null };
}

export type Bar = { label: string; value: number };

export type ReservationStats = {
  coversToday: number;
  coversWeek: number;
  coversMonth: number;
  bookingsWindow: number;
  noShow: Rate;
  cancelled: Rate;
  online: Rate;
  averageParty: number | null;
  byWeekday: Bar[];
  byHour: Bar[];
};

/**
 * @param rows   every reservation in the window, ending today
 * @param today  today in the shop's timezone
 */
export function reservationStats(rows: ReservationRow[], today: string): ReservationStats {
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  // Rates are judged on bookings whose date has passed: a confirmed booking for next Friday is not
  // yet a no-show, and counting it as "kept" would flatter the number just as much.
  const past = rows.filter((r) => r.date < today);
  const decided = past.filter((r) => r.status !== "pending");
  const noShows = past.filter((r) => r.status === "no_show").length;
  const cancellations = rows.filter((r) => r.status === "cancelled").length;
  const seated = rows.filter((r) => SEATED.has(r.status));

  const weekdayTotals = new Array(7).fill(0) as number[];
  const hourTotals = new Map<number, number>();
  for (const r of seated) {
    weekdayTotals[new Date(`${r.date}T12:00:00Z`).getUTCDay()] += r.party_size;
    const hour = Number(r.start_time.slice(0, 2));
    if (Number.isInteger(hour)) hourTotals.set(hour, (hourTotals.get(hour) ?? 0) + r.party_size);
  }

  return {
    coversToday: covers(rows.filter((r) => r.date === today)),
    coversWeek: covers(rows.filter((r) => r.date >= weekStart && r.date <= today)),
    coversMonth: covers(rows.filter((r) => r.date >= monthStart && r.date <= today)),
    bookingsWindow: rows.length,
    noShow: rate(noShows, decided.length),
    cancelled: rate(cancellations, rows.length),
    online: rate(rows.filter((r) => r.source !== "staff").length, rows.length),
    averageParty: seated.length > 0 ? Math.round((covers(seated) / seated.length) * 10) / 10 : null,
    byWeekday: [1, 2, 3, 4, 5, 6, 0].map((wd, i) => ({ label: WEEKDAY_SHORT[i], value: weekdayTotals[wd] })),
    byHour: [...hourTotals.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, value]) => ({ label: `${String(hour).padStart(2, "0")} Uhr`, value })),
  };
}

export type PreorderLineRow = { label: string; quantity: number };

/** The dishes people actually order ahead, biggest first. Capped, because the point is the top of
 *  the list; a long tail of one-offs says nothing. */
export function topPreorderedDishes(lines: PreorderLineRow[], limit = 6): Bar[] {
  const totals = new Map<string, number>();
  for (const l of lines) totals.set(l.label, (totals.get(l.label) ?? 0) + l.quantity);
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "de"))
    .slice(0, limit);
}
