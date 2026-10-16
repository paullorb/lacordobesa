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

/** How a day relates to today, for the hint on a calendar day. Weeks run Monday to Sunday, so
 *  "this Friday" is the Friday of the current week and "next Saturday" is the Saturday of the week
 *  after. Anything further out gets no relative name. */
export type RelativeDay =
  | { kind: "today" | "tomorrow" | "dayAfter" | "past" | "later" }
  | { kind: "thisWeek" | "nextWeek"; weekday: number };

export function relativeDay(iso: string, today: string): RelativeDay {
  const diff = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (diff < 0) return { kind: "past" };
  if (diff === 0) return { kind: "today" };
  if (diff === 1) return { kind: "tomorrow" };
  if (diff === 2) return { kind: "dayAfter" };
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  const weeks = (Date.parse(`${startOfWeek(iso)}T12:00:00Z`) - Date.parse(`${startOfWeek(today)}T12:00:00Z`)) / (7 * 86_400_000);
  if (weeks === 0) return { kind: "thisWeek", weekday };
  if (weeks === 1) return { kind: "nextWeek", weekday };
  return { kind: "later" };
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "2026-10-12" -> "Mo., 12.10.2026" (de) / "lun, 12/10/2026" (es) / "Mon 12 Oct 2026" (en).
 *
 *  English spells the month: day-before-month numbers ("12/10/2026") are the British order and read
 *  as 10 December to an American, and the page is read by both.
 *
 *  Formatted in UTC on purpose: the value is a calendar date, not an instant, so shifting it into a
 *  timezone is what would make it render as the wrong day. */
export function fmtDate(iso: string, locale: Locale, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    weekday: "short",
    day: locale === "en" ? "numeric" : "2-digit",
    month: locale === "en" ? "short" : "2-digit",
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

// ---------------------------------------------------------------- the shop's clock
// Opening hours and pickup lead times are about what the clock on the shop wall says, not about the
// visitor's. Both helpers below read an instant through Europe/Berlin and never through the
// machine's timezone, so a guest in Los Angeles sees the same "open now" as a guest in Frankfurt.

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const BERLIN_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const BERLIN_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date, weekday (0 = Sunday, as `opening_hours` has it) and minutes past midnight in Berlin. */
export function berlinClock(now: Date): { date: string; weekday: number; minute: number } {
  const parts = Object.fromEntries(BERLIN_CLOCK.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: BERLIN_DATE.format(now),
    weekday: WEEKDAY[parts.weekday],
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The first pickup a lead time allows, as a Berlin date and a time rounded up to the 15-minute
 *  step. The same rule request_preorder() enforces with too_soon. */
export function leadBoundary(leadHours: number, now: number = Date.now()): { date: string; time: string } {
  const at = new Date(now + leadHours * 3_600_000);
  const { date, minute } = berlinClock(at);
  const rounded = Math.ceil(minute / 15) * 15;
  // 23:50 rounds up to 24:00, which is 00:00 tomorrow rather than a time of day.
  if (rounded >= 24 * 60) return { date: addDays(date, 1), time: "00:00" };
  return { date, time: `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}` };
}
