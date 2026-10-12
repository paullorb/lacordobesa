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

/** "2026-10-12" -> "Mo., 12.10.2026" (de) / "lun, 12/10/2026" (es) / "Mon, 12/10/2026" (en).
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
