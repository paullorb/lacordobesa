import Link from "next/link";
import { WEEKDAYS_DE } from "@/lib/data";
import { addDays, fmtDateDE } from "@/lib/dates";

export type DayInfo = {
  /** confirmed + pending reservations */
  reservations?: number;
  /** confirmed + pending guests */
  guests?: number;
  closed?: boolean;
  closedReason?: string;
};

type Props = {
  /** YYYY-MM */
  month: string;
  today: string;
  selected?: string;
  /** keyed by YYYY-MM-DD */
  days: Record<string, DayInfo>;
  /** which weekdays are regular closing days (0 = Sunday) */
  weeklyClosed?: number[];
  /** builds the link for a day cell */
  hrefForDay: (date: string) => string;
  /** builds the link for the prev/next month buttons */
  hrefForMonth: (month: string) => string;
};

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  const first = `${month}-01`;
  const last = addDays(shiftMonth(month, 1) + "-01", -1);
  return { first, last };
}

/** Server-rendered month grid. Mondays first, like every German calendar. */
export function MonthCalendar({ month, today, selected, days, weeklyClosed = [], hrefForDay, hrefForMonth }: Props) {
  const { first, last } = monthRange(month);
  const firstDow = new Date(`${first}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const leading = (firstDow + 6) % 7; // cells before the 1st, Monday-based
  const daysInMonth = Number(last.slice(8, 10));
  const title = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${first}T00:00:00Z`),
  );

  const cells: (string | null)[] = [...Array(leading).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <Link href={hrefForMonth(shiftMonth(month, -1))} className="btn-ghost" aria-label="Vorheriger Monat">
          ←
        </Link>
        <strong className="font-serif text-lg">{title}</strong>
        <Link href={hrefForMonth(shiftMonth(month, 1))} className="btn-ghost" aria-label="Nächster Monat">
          →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
          <div key={wd} className="pb-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted">
            {WEEKDAYS_DE[wd].slice(0, 2)}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const info = days[date] ?? {};
          const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
          const closed = info.closed || weeklyClosed.includes(dow);
          const isPast = date < today;
          const isSel = date === selected;
          const isToday = date === today;
          const cls = [
            "flex min-h-14 flex-col items-center justify-start gap-0.5 rounded-md border px-1 py-1 text-sm transition",
            isSel ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-mint",
            closed && !isSel ? "bg-gray-100 text-muted" : "",
            isPast && !isSel ? "opacity-50" : "",
          ].join(" ");
          return (
            <Link
              key={date}
              href={hrefForDay(date)}
              className={cls}
              title={`${fmtDateDE(date)}${info.closedReason ? ` – ${info.closedReason}` : closed ? " – geschlossen" : ""}`}
            >
              <span className={`font-semibold ${isToday && !isSel ? "rounded-full bg-coral px-1.5 text-white" : ""}`}>
                {Number(date.slice(8, 10))}
              </span>
              {info.reservations ? (
                <span className={`text-[0.65rem] ${isSel ? "text-white/80" : "text-blue-dark"}`}>
                  {info.reservations} · {info.guests} P.
                </span>
              ) : closed ? (
                <span className="text-[0.6rem]">zu</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
