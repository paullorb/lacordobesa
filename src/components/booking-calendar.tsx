"use client";

import { useState } from "react";
import { CalendarDay } from "@/components/calendar-day";
import { ArrowIcon } from "@/components/icons";
import { getDictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  /** The visitor's today, for the ring and the "Morgen" hints. */
  today: string;
  /** The first day that can be picked. Earlier days in its week are drawn, but not offered. */
  firstDay: string;
  /** The last day that can be picked. */
  maxDate: string;
  selected: string | null;
  isClosed: (iso: string) => boolean;
  disabled?: boolean;
  onPick: (iso: string) => void;
  label: string;
  /** Weeks shown at first, with a button for more. Leave unset to show the whole range at once. */
  initialWeeks?: number;
};

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (day: string, days: number) => iso(new Date(at(day).getTime() + days * 86_400_000));
/** Monday is column 0, Sunday column 6, in every language. */
const column = (day: string) => (at(day).getUTCDay() + 6) % 7;
const MORE_WEEKS = 4;

/**
 * The date picker every form on the site uses: the table booking, the pre-order and the
 * celebration inquiry.
 *
 * Always whole weeks, Monday to Sunday. The days before the first bookable one and after the last
 * are still drawn, faded and not offered, so every row is a full week and the grid reads like the
 * calendar on the wall rather than a run of numbers that starts and stops mid-row. One continuous
 * grid rather than a block per month, so a week that crosses into the next month stays one row;
 * the first of each month carries the month's short name under its number instead.
 */
export function BookingCalendar({ locale, today, firstDay, maxDate, selected, isClosed, disabled, onPick, label, initialWeeks }: Props) {
  const t = getDictionary(locale).reservation;
  const [extra, setExtra] = useState(0);
  const start = shift(firstDay, -column(firstDay));
  const end = shift(maxDate, 6 - column(maxDate));
  const totalWeeks = Math.round((at(end).getTime() - at(start).getTime()) / 86_400_000 + 1) / 7;
  const weeks = Math.min(totalWeeks, initialWeeks === undefined ? totalWeeks : initialWeeks + extra);
  const days = Array.from({ length: weeks * 7 }, (_, i) => shift(start, i));
  const shortMonth = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "short" });

  return (
    <>
      <div className="calendar" role="group" aria-label={label}>
        <div className="calendar-month">
          <p className="calendar-label">{rangeLabel(days[0], days[days.length - 1], locale)}</p>
          <div className="calendar-heads" aria-hidden="true">
            {t.weekdayHeads.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day, i) => {
              const month = i === 0 || day.endsWith("-01") ? shortMonth.format(at(day)) : null;
              if (day < firstDay || day > maxDate) {
                return (
                  <span key={day} className="day-out" aria-hidden="true">
                    {Number(day.slice(8))}
                    {month && <small>{month}</small>}
                  </span>
                );
              }
              return (
                <CalendarDay
                  key={day}
                  iso={day}
                  today={today}
                  locale={locale}
                  pressed={selected === day}
                  closed={isClosed(day)}
                  disabled={disabled}
                  month={month}
                  onPick={() => onPick(day)}
                />
              );
            })}
          </div>
        </div>
      </div>
      {weeks < totalWeeks && (
        <button type="button" className="text-button more-dates" onClick={() => setExtra(extra + MORE_WEEKS)}>
          {t.moreDates} <ArrowIcon direction="down" size={14} />
        </button>
      )}
    </>
  );
}

const RANGE_WORD: Record<Locale, string> = { de: "bis", es: "a", en: "to" };

/** "November 2026", "November bis Dezember 2026" or "Dezember 2026 bis Januar 2027". Built by hand
 *  rather than with formatRange, whose separators differ between ICU builds and so between the
 *  server render and the browser. */
function rangeLabel(from: string, to: string, locale: Locale) {
  const full = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long", year: "numeric" });
  const month = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long" });
  if (from.slice(0, 7) === to.slice(0, 7)) return full.format(at(from));
  if (from.slice(0, 4) === to.slice(0, 4)) return `${month.format(at(from))} ${RANGE_WORD[locale]} ${full.format(at(to))}`;
  return `${full.format(at(from))} ${RANGE_WORD[locale]} ${full.format(at(to))}`;
}
