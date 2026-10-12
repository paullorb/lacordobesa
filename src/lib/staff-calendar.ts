import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { DayInfo } from "@/components/staff/month-calendar";
import { monthRange } from "@/components/staff/month-calendar";

/** Reservation counts, closures and weekly closing days for one month's calendar. */
export async function loadCalendarMonth(supabase: SupabaseClient<Database>, month: string) {
  const { first, last } = monthRange(month);
  const [{ data: rows }, { data: closures }, { data: hours }] = await Promise.all([
    supabase
      .from("reservations")
      .select("date, party_size")
      .gte("date", first)
      .lte("date", last)
      .in("status", ["pending", "confirmed"]),
    supabase.from("closures").select("date, reason").gte("date", first).lte("date", last),
    supabase.from("opening_hours").select("weekday, is_closed"),
  ]);

  const days: Record<string, DayInfo> = {};
  for (const r of rows ?? []) {
    const d = (days[r.date] ??= {});
    d.reservations = (d.reservations ?? 0) + 1;
    d.guests = (d.guests ?? 0) + r.party_size;
  }
  for (const c of closures ?? []) {
    const d = (days[c.date] ??= {});
    d.closed = true;
    d.closedReason = c.reason ?? undefined;
  }
  const weeklyClosed = (hours ?? []).filter((h) => h.is_closed).map((h) => h.weekday);
  return { days, weeklyClosed };
}

export function monthParam(sp: Record<string, string | string[] | undefined>, fallback: string) {
  const m = sp.monat;
  return typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? m : fallback.slice(0, 7);
}
