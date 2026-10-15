"use client";

import { useEffect, useState } from "react";
import { berlinClock } from "@/lib/dates";

export type HoursRow = { weekday: number; label: string; text: string; closed: boolean };

/**
 * The week's opening hours as rows, with today's row marked.
 *
 * The rows arrive formatted from the server component that owns the data and render with the
 * rest of the cached page; only the mark is added in the browser, because "today" is a question
 * for the clock on the shop wall (Berlin time, not the visitor's), the same clock OpenStatus
 * reads. Until the script has run no row is marked, which is also what a reader without
 * JavaScript gets.
 *
 * Two shapes for the two places it is shown: a two-column grid in the visit card and a
 * definition list in the footer. Same rows, same mark, so the two never disagree.
 */
export function OpeningHours({ rows, todayLabel, variant }: { rows: HoursRow[]; todayLabel: string; variant: "grid" | "list" }) {
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setToday(berlinClock(new Date()).weekday);
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const mark = (r: HoursRow) => r.weekday === today && <span className="hours-today">{todayLabel}</span>;

  if (variant === "list") {
    return (
      <dl className="footer-hours">
        {rows.map((r) => (
          <div key={r.weekday} data-today={r.weekday === today || undefined}>
            <dt>
              {r.label}
              {mark(r)}
            </dt>
            <dd className={r.closed ? "closed" : undefined}>{r.text}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="hours">
      {rows.map((r) => (
        <div key={r.weekday} style={{ display: "contents" }} data-today={r.weekday === today || undefined}>
          <span>
            {r.label}
            {mark(r)}
          </span>
          <span className={r.closed ? "closed" : undefined}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}
