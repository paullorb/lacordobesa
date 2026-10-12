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

/** "2026-10-12" -> "Mo., 12.10.2026" */
export function fmtDateDE(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opts,
  }).format(new Date(`${iso}T00:00:00Z`));
}
