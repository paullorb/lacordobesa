"use client";

import { useEffect, useState } from "react";
import { addDays, berlinClock } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

type Hours = { weekday: number; opens: string | null; closes: string | null; is_closed: boolean };
type State = { kind: "open" | "later" | "closed"; text: string } | null;

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (t: string) => t.slice(0, 5);

function status(hours: Hours[], closures: string[], locale: Locale, now: Date): State {
  const t = getDictionary(locale).home;
  const { date, weekday, minute } = berlinClock(now);
  // A holiday or a week off overrides the weekly hours, as it does for reservations.
  const day = (ahead: number) =>
    closures.includes(addDays(date, ahead))
      ? undefined
      : hours.find((h) => h.weekday === (weekday + ahead) % 7 && !h.is_closed && h.opens && h.closes);

  const today = day(0);
  if (today?.opens && today.closes) {
    if (minute >= minutes(today.opens) && minute < minutes(today.closes)) {
      return { kind: "open", text: t.statusOpen(hhmm(today.closes)) };
    }
    if (minute < minutes(today.opens)) return { kind: "later", text: t.statusLater(hhmm(today.opens)) };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const wd = (weekday + ahead) % 7;
    const next = day(ahead);
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
export function OpenStatus({
  hours,
  closures,
  locale,
  className,
}: {
  hours: Hours[];
  /** Closure dates (YYYY-MM-DD) covering at least today and the week ahead. */
  closures: string[];
  locale: Locale;
  className?: string;
}) {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const update = () => setState(status(hours, closures, locale, new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [hours, closures, locale]);

  return (
    <p className={`open-status${className ? ` ${className}` : ""}`} data-state={state?.kind ?? "pending"}>
      <span className="open-dot" aria-hidden="true" />
      <span>{state?.text ?? " "}</span>
    </p>
  );
}
