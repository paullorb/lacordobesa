"use client";

import { fmtDate, relativeDay } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

type Props = {
  iso: string;
  today: string;
  locale: Locale;
  pressed: boolean;
  closed: boolean;
  disabled?: boolean;
  onPick: () => void;
};

/** One day in a booking calendar. Pointing at it names the day the way people say it ("Morgen",
 *  "Diesen Freitag"), which a bare number cannot; today is marked by a ring, not by a label. */
export function CalendarDay({ iso, today, locale, pressed, closed, disabled, onPick }: Props) {
  const r = getDictionary(locale).reservation;
  const rel = relativeDay(iso, today);
  const weekday = fmtDate(iso, locale, { weekday: "long", day: undefined, month: undefined, year: undefined });
  const hint = closed
    ? r.restDay
    : rel.kind === "today" || rel.kind === "tomorrow" || rel.kind === "dayAfter"
      ? r.dayHint[rel.kind]
      : rel.kind === "thisWeek" || rel.kind === "nextWeek"
        ? r.dayHint[rel.kind](weekday)
        : fmtDate(iso, locale, { weekday: "long", day: "numeric", month: "long", year: undefined });
  const named = rel.kind === "later" && !closed;
  const label = named ? hint : `${fmtDate(iso, locale, { weekday: "long" })}, ${hint}`;

  return (
    <button
      type="button"
      className={`day${iso === today ? " is-today" : ""}`}
      aria-pressed={pressed}
      aria-label={label}
      disabled={closed || disabled}
      data-hint={hint}
      data-col={(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7}
      onClick={onPick}
    >
      {Number(iso.slice(8))}
    </button>
  );
}
