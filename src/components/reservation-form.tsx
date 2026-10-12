"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { fmtDate } from "@/lib/dates";
import { getDictionary, type Dictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, type Locale } from "@/lib/i18n";
import { WaitlistForm } from "@/components/waitlist-form";
import { Wizard, type WizardStep } from "@/components/wizard";
import {
  getAvailability,
  getFirstAvailableDay,
  requestReservation,
  type RequestState,
  type Slot,
  type UnavailableReason,
} from "@/app/reservierung/actions";

type Props = {
  locale: Locale;
  maxPartySize: number;
  minDate: string;
  maxDate: string;
  closedWeekdays: number[];
  phoneHref: string;
  phoneLabel: string;
};

type Step = 1 | 2 | 3 | 4;

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** How many days step 1 offers before asking. Two weeks is the horizon most people book inside, and
 *  showing every day up to max_days_ahead (30 by default) opens with two months of tiles to scroll
 *  past. The rest is one tap away, so nothing is actually hidden. */
const FIRST_DAYS = 14;

export function ReservationForm({ locale, maxPartySize, minDate, maxDate, closedWeekdays, phoneHref, phoneLabel }: Props) {
  const t = getDictionary(locale).reservation;
  // Monday first in all three languages: the calendar grid is built that way, and a German, Spanish
  // or English reader all expect their own week to start where their own calendar starts it.
  const weekdayLong = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "long" });
  const monthLong = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long", year: "numeric" });
  const people = (n: number) => `${n} ${n === 1 ? t.person : t.people}`;
  const [state, formAction, submitting] = useActionState<RequestState, FormData>(requestReservation, null);
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reason, setReason] = useState<UnavailableReason | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "" });
  // Date + time the last submit was made for, so a slot error stops showing once the guest picks another slot.
  const [attempt, setAttempt] = useState("");
  const [showAllDays, setShowAllDays] = useState(false);
  const [loading, startLoading] = useTransition();
  const request = useRef(0);

  // Preselect the first day with free seats, but stay on step 1: the guest should see the calendar first.
  useEffect(() => {
    const id = ++request.current;
    startLoading(async () => {
      const first = await getFirstAvailableDay(minDate, maxDate);
      if (id !== request.current || !first) return;
      setDate(first.date);
      setSlots(first.slots);
    });
  }, [minDate, maxDate]);

  function loadDay(value: string, then: Step) {
    const id = ++request.current;
    setReason(null);
    startLoading(async () => {
      const result = await getAvailability(value);
      if (id !== request.current) return;
      setSlots(result.slots);
      setReason(result.reason);
      if (result.slots.some((s) => s.seatsLeft > 0)) setStep(then);
    });
  }

  function chooseDate(value: string) {
    // Tapping the day that is already loaded (e.g. the preselected one) just moves on.
    if (value === date && slots.some((s) => s.seatsLeft > 0)) {
      setStep(2);
      return;
    }
    setDate(value);
    setTime("");
    setPartySize(null);
    setSlots([]);
    loadDay(value, 2);
  }

  function chooseTime(value: string, seatsLeft: number) {
    setTime(value);
    if (partySize && partySize > seatsLeft) setPartySize(null);
    setStep(3);
  }

  function chooseOtherTime() {
    setTime("");
    setStep(2);
    loadDay(date, 2);
  }

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.successTitle}</strong>
        <p>{t.successText(fmtDate(date, locale), time, people(partySize ?? 1))}</p>
      </div>
    );
  }

  const selectedSlot = slots.find((s) => s.time === time);
  const maxForSlot = Math.min(maxPartySize, selectedSlot?.seatsLeft ?? maxPartySize);
  const bookable = slots.filter((s) => s.seatsLeft > 0);
  const months = calendarMonths(minDate, maxDate, monthLong, showAllDays ? undefined : FIRST_DAYS);
  const totalDays = countDays(minDate, maxDate);
  const truncated = !showAllDays && totalDays > FIRST_DAYS;
  // Every slot exists but none has a free seat: the day is full, which is the one blocker a waitlist
  // can do something about. "Ruhetag" or "zu kurzfristig" are not helped by waiting.
  const fullyBooked = slots.length > 0 && bookable.length === 0;
  const blocker = date ? unavailableMessage(date, reason, fullyBooked, phoneHref, phoneLabel, t, weekdayLong) : null;
  // The request can only be sent once we know who to call back, so the button only appears then.
  const contactReady = contact.name.trim().length >= 2 && contact.phone.trim().length >= 5;

  const steps: WizardStep[] = [
    {
      title: t.steps[1],
      summary: date ? fmtDate(date, locale) : null,
      changeLabel: t.changeDate,
      body: (
        <div className="wizard-body">
          <div className="calendar" role="group" aria-label={t.pickDate}>
            {months.map((month) => (
              <div className="calendar-month" key={month.key}>
                <p className="calendar-label">{month.label}</p>
                <div className="calendar-heads" aria-hidden="true">
                  {t.weekdayHeads.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {month.pad > 0 && <span style={{ gridColumn: `span ${month.pad}` }} />}
                  {month.days.map((iso) => {
                    const closed = closedWeekdays.includes(at(iso).getUTCDay());
                    return (
                      <button
                        key={iso}
                        type="button"
                        className="day"
                        aria-pressed={date === iso}
                        aria-label={fmtDate(iso, locale, { weekday: "long" })}
                        disabled={closed || loading}
                        title={closed ? t.restDay : undefined}
                        onClick={() => chooseDate(iso)}
                      >
                        {Number(iso.slice(8))}
                        {iso === minDate && <small>{t.today}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {truncated && (
            <button type="button" className="text-button more-dates" onClick={() => setShowAllDays(true)}>
              {t.moreDates} <span aria-hidden="true">↓</span>
            </button>
          )}
          {loading && <p className="form-note">{t.loading}</p>}
          {!loading && blocker && (
            <p className="form-note" role="status">
              {blocker}
            </p>
          )}
          {!loading && fullyBooked && (
            <WaitlistForm locale={locale} date={date} partySize={partySize} maxPartySize={maxPartySize} />
          )}
          {!loading && bookable.length > 0 && (
            <div>
              <button type="button" className="button" onClick={() => setStep(2)}>
                {t.continueWith(fmtDate(date, locale, { year: undefined }))} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.steps[2],
      summary: time ? `${time} ${t.at}` : null,
      changeLabel: t.changeTime,
      body: (
        <div className="wizard-body">
          <div className="slots times" role="group" aria-label={t.pickTime}>
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className="slot"
                aria-pressed={time === s.time}
                disabled={s.seatsLeft <= 0}
                title={s.seatsLeft <= 0 ? t.soldOut : undefined}
                onClick={() => chooseTime(s.time, s.seatsLeft)}
              >
                {s.time}
              </button>
            ))}
          </div>
          {loading && <p className="form-note">{t.loading}</p>}
        </div>
      ),
    },
    {
      title: t.steps[3],
      summary: partySize ? people(partySize) : null,
      changeLabel: t.changeParty,
      body: (
        <div className="wizard-body">
          <div className="slots" role="group" aria-label={t.pickParty}>
            {Array.from({ length: maxForSlot }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className="slot party"
                aria-pressed={partySize === n}
                onClick={() => {
                  setPartySize(n);
                  setStep(4);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="form-note">
            {maxForSlot < maxPartySize ? t.seatsLeft(maxForSlot) : ""}
            {t.largerGroups(maxPartySize + 1)}
            <a href={phoneHref}>{phoneLabel}</a>
          </p>
        </div>
      ),
    },
    {
      title: t.steps[4],
      body: partySize ? (
        <form
          className="wizard-body wizard-contact"
          action={(fd) => {
            setAttempt(`${date} ${time}`);
            formAction(fd);
          }}
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="time" value={time} />
          <input type="hidden" name="party_size" value={partySize} />
          <div className="form-row">
            <div className="field-float">
              <input
                id="r-name"
                name="name"
                required
                minLength={2}
                maxLength={FIELD_LIMITS.name}
                autoComplete="name"
                placeholder="María González"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
              <label htmlFor="r-name">{t.name}</label>
            </div>
            <div className="field-float">
              <input
                id="r-phone"
                name="phone"
                type="tel"
                required
                minLength={5}
                maxLength={FIELD_LIMITS.phone}
                autoComplete="tel"
                placeholder="+49 170 1234567"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
              <label htmlFor="r-phone">{t.phone}</label>
            </div>
          </div>
          <div className="field-float">
            <input
              id="r-email"
              name="email"
              type="email"
              maxLength={FIELD_LIMITS.email}
              autoComplete="email"
              placeholder="maria@example.com"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
            <label htmlFor="r-email">{t.email}</label>
          </div>
          <div className="field-float">
            <textarea
              id="r-notes"
              name="notes"
              rows={2}
              maxLength={FIELD_LIMITS.notes}
              placeholder={t.notesPlaceholder}
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            />
            <label htmlFor="r-notes">{t.notes}</label>
          </div>

          {state && !state.ok && attempt === `${date} ${time}` && (
            <div className="form-error" role="alert">
              {state.error}
              {state.retryTime && (
                <>
                  {" "}
                  <button type="button" className="text-button" onClick={chooseOtherTime}>
                    {t.otherTime}
                  </button>
                </>
              )}
            </div>
          )}

          {contactReady ? (
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </button>
          ) : (
            <p className="form-note" role="status">
              {t.needContact}
            </p>
          )}
          <p className="form-note">{t.nonBinding}</p>
        </form>
      ) : null,
    },
  ];

  return (
    <Wizard
      step={step}
      setStep={(n) => setStep(n as Step)}
      steps={steps}
      stepLabel={getDictionary(locale).wizard.stepOf}
      footer={
        step > 1 && step < 4 && bookable.length === 0 && !loading ? (
          <p className="form-note">
            {t.unavailable.nothingLeft}
            {t.callUs}
            <a href={phoneHref}>{phoneLabel}</a>
          </p>
        ) : null
      }
    />
  );
}

type CalendarMonth = { key: string; label: string; pad: number; days: string[] };

/**
 * One Monday-first calendar block per month touched by `minDate`..`maxDate`. Only bookable days get a
 * tile; `pad` is the width of the empty run before the first one, so the weekday columns line up.
 */
function calendarMonths(
  minDate: string,
  maxDate: string,
  monthLong: Intl.DateTimeFormat,
  limit?: number,
): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let cursor = minDate.slice(0, 7);
  let budget = limit ?? Number.POSITIVE_INFINITY;
  while (cursor <= maxDate.slice(0, 7)) {
    const [year, month] = cursor.split("-").map(Number);
    const days: string[] = [];
    for (let day = 1; day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); day++) {
      const iso = `${cursor}-${String(day).padStart(2, "0")}`;
      if (iso >= minDate && iso <= maxDate && budget > 0) {
        days.push(iso);
        budget--;
      }
    }
    if (days.length > 0) {
      months.push({
        key: cursor,
        label: monthLong.format(at(days[0])),
        pad: (at(days[0]).getUTCDay() + 6) % 7, // Sunday (0) belongs in the last column
        days,
      });
    }
    cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  }
  return months;
}

/** Days in the whole bookable range, so step 1 knows whether it is hiding any. */
function countDays(minDate: string, maxDate: string) {
  return Math.floor((Date.parse(`${maxDate}T00:00:00Z`) - Date.parse(`${minDate}T00:00:00Z`)) / 86_400_000) + 1;
}

function unavailableMessage(
  date: string,
  reason: UnavailableReason | null,
  fullyBooked: boolean,
  phoneHref: string,
  phoneLabel: string,
  t: Dictionary["reservation"],
  weekdayLong: Intl.DateTimeFormat,
) {
  const phone = (
    <>
      {" "}
      {t.callUs}
      <a href={phoneHref}>{phoneLabel}</a>
    </>
  );
  if (reason === "closed") return <>{t.unavailable.closed(weekdayLong.format(at(date)))}</>;
  if (reason === "holiday") return <>{t.unavailable.holiday}</>;
  if (reason === "late") return <>{t.unavailable.late}{phone}</>;
  if (reason === "error") return <>{t.unavailable.error}{phone}</>;
  if (fullyBooked) return <>{t.unavailable.full}{phone}</>;
  return null;
}
