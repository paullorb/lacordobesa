"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

type Hours = { weekday: number; opens: string | null; closes: string | null; is_closed: boolean };
type State = { kind: "open" | "later" | "closed"; text: string } | null;

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (t: string) => t.slice(0, 5);

/** Weekday and minutes past midnight in Frankfurt, wherever the visitor happens to be. */
function frankfurtNow(now: Date) {
  const parts = Object.fromEntries(clock.formatToParts(now).map((p) => [p.type, p.value]));
  return { weekday: WEEKDAY[parts.weekday], minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

function status(hours: Hours[], locale: Locale, now: Date): State {
  const t = getDictionary(locale).home;
  const { weekday, minute } = frankfurtNow(now);
  const day = (wd: number) => hours.find((h) => h.weekday === wd && !h.is_closed && h.opens && h.closes);

  const today = day(weekday);
  if (today?.opens && today.closes) {
    if (minute >= minutes(today.opens) && minute < minutes(today.closes)) {
      return { kind: "open", text: t.statusOpen(hhmm(today.closes)) };
    }
    if (minute < minutes(today.opens)) return { kind: "later", text: t.statusLater(hhmm(today.opens)) };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const wd = (weekday + ahead) % 7;
    const next = day(wd);
    if (next?.opens) {
      const when = ahead === 1 ? t.statusTomorrow : t.statusOnDay(t.weekdays[wd]);
      return { kind: "closed", text: t.statusClosed(when, hhmm(next.opens)) };
    }
  }
  return null;
}

/**
 * Whether the shop is open right now, and if not, when it next is: the one thing most people
 * scrolling a restaurant's site actually came for.
 *
 * Computed in the browser, because the page around it is a static shell cached for hours; a
 * server-rendered "open now" would be stale by the evening. Frankfurt time, not the visitor's.
 * Until it has run it renders an empty, invisible line of the same height, so nothing shifts.
 */
export function OpenStatus({ hours, locale, className }: { hours: Hours[]; locale: Locale; className?: string }) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const update = () => setState(status(hours, locale, new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [hours, locale]);

  return (
    <p className={`open-status${className ? ` ${className}` : ""}`} data-state={state?.kind ?? "pending"}>
      <span className="open-dot" aria-hidden="true" />
      <span>{state?.text ?? " "}</span>
    </p>
  );
}
