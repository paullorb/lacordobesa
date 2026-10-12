import { INTL_LOCALE, type Locale } from "@/lib/i18n";

const TZ = "Europe/Berlin";

/** Today's date (YYYY-MM-DD) in the shop's timezone, regardless of server timezone. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** The date (YYYY-MM-DD) in the shop's timezone `hours` from now. Used for the earliest pickup day a
 *  pre-order can name, so the client offers the same first day the RPC would accept. */
export function dateAfterHours(hours: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + hours * 3_600_000));
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `iso`. German weeks start on Monday, while Date#getUTCDay and the
 *  opening_hours table use 0 = Sunday, hence the shift. */
export function startOfWeek(iso: string): string {
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "2026-10-12" -> "Mo., 12.10.2026" (de) / "lun, 12/10/2026" (es).
 *
 *  Formatted in UTC on purpose: the value is a calendar date, not an instant, so shifting it into a
 *  timezone is what would make it render as the wrong day. */
export function fmtDate(iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** German dates, for the staff app, which is not translated: the team works in German. */
export const fmtDateDE = (iso: string, opts: Intl.DateTimeFormatOptions = {}) => fmtDate(iso, "de", opts);

// ---------------------------------------------------------------- months
// Month maths used by the staff calendar. These lived in components/staff/month-calendar.tsx,
// which meant lib/staff-calendar.ts had to import them *from a component*; they are date maths
// and belong next to addDays().

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First and last day of a month, inclusive. */
export function monthRange(month: string) {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { first, last };
}

/** A real calendar month, not merely four digits and two more.
 *
 *  A shape-only regex admits "2026-99", which reaches the calendar grid as
 *  `new Date("2026-99-01")` -> NaN -> `[...Array(NaN)]` -> RangeError, i.e. a raw 500 on a staff
 *  page from nothing but a hand-edited query string. */
export function isMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** A real calendar date. The round trip is what rejects "2026-02-31", which JS would otherwise
 *  roll forward to the 3rd of March rather than refuse. */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** A real time of day as `HH:MM`, the shape the time slots and `<input type="time">` submit. */
export function isTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h <= 23 && m <= 59;
}
