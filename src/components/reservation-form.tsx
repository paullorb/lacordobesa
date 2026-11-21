"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { BookingCalendar } from "@/components/booking-calendar";
import { fmtDate, todayISO } from "@/lib/dates";
import { getDictionary, type Dictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, type Locale } from "@/lib/i18n";
import { track, useTrackForm } from "@/components/analytics";
import { useFormGuard } from "@/components/form-guard";
import { ArrowIcon } from "@/components/icons";
import { WaitlistForm } from "@/components/waitlist-form";
import { ContactFields, type Contact } from "@/components/contact-fields";
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

/** Today does not change while somebody fills in a form, and if they leave the page open past
 *  midnight the RPC still has the last word. Hoisted so React is not handed a new subscribe
 *  function on every render. */
export const NEVER_CHANGES = () => () => {};

export function ReservationForm({ locale, maxPartySize, minDate, maxDate, closedWeekdays, phoneHref, phoneLabel }: Props) {
  const t = getDictionary(locale).reservation;
  // Monday first in every language: the calendar grid is built that way, and a German, Spanish or English
  // reader expects the week to start where their own calendar starts it.
  const weekdayLong = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "long" });
  const people = (n: number) => `${n} ${n === 1 ? t.person : t.people}`;
  const [state, formAction, submitting] = useActionState<RequestState, FormData>(requestReservation, null);
  const guard = useFormGuard("reservation");
  useTrackForm("reservation", state, submitting);
  const [step, setStep] = useState<Step>(1);
  useEffect(() => {
    if (step > 1) track("reservation_step", String(step));
  }, [step]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reason, setReason] = useState<UnavailableReason | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "", notes: "" });
  // Date + time the last submit was made for, so a slot error stops showing once the guest picks another slot.
  const [attempt, setAttempt] = useState("");
  const [loading, startLoading] = useTransition();
  const request = useRef(0);

  // `minDate` is baked into a cached shell, so between midnight and the next revalidation it still
  // names yesterday: the calendar then offered a day that is gone and printed "Heute" on it. The
  // browser's clock is the one that is right. useSyncExternalStore rather than an effect, because
  // the server and the first client render have to agree (the server has only `minDate` to go on)
  // and React is the thing that knows when it is safe to swap in the real answer.
  const today = useSyncExternalStore(NEVER_CHANGES, todayISO, () => minDate);
  const firstDay = today > minDate ? today : minDate;

  // Preselect the first day with free seats, but stay on step 1: the guest should see the calendar first.
  useEffect(() => {
    const id = ++request.current;
    startLoading(async () => {
      const first = await getFirstAvailableDay(firstDay, maxDate);
      if (id !== request.current || !first) return;
      setDate(first.date);
      setSlots(first.slots);
    });
  }, [firstDay, maxDate]);

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
  // Every slot exists but none has a free seat: the day is full, which is the one blocker a waitlist
  // can do something about. "Ruhetag" or "zu kurzfristig" are not helped by waiting.
  const fullyBooked = slots.length > 0 && bookable.length === 0;
  const blocker = date ? unavailableMessage(date, reason, fullyBooked, phoneHref, phoneLabel, t, weekdayLong) : null;

  const steps: WizardStep[] = [
    {
      title: t.steps[1],
      summary: date ? fmtDate(date, locale) : null,
      changeLabel: t.changeDate,
      body: (
        <div className="wizard-body">
          <BookingCalendar
            locale={locale}
            today={today}
            firstDay={firstDay}
            maxDate={maxDate}
            selected={date}
            isClosed={(iso) => closedWeekdays.includes(at(iso).getUTCDay())}
            disabled={loading}
            onPick={chooseDate}
            label={t.pickDate}
          />
          {loading && <p className="form-note">{t.loading}</p>}
          {!loading && blocker && (
            <p className="form-note" role="status">
              {blocker}
            </p>
          )}
          {!loading && fullyBooked && (
            <WaitlistForm key={date} locale={locale} date={date} partySize={partySize} maxPartySize={maxPartySize} />
          )}
          {!loading && bookable.length > 0 && (
            <div>
              <button type="button" className="button" onClick={() => setStep(2)}>
                {t.continueWith(fmtDate(date, locale, { year: undefined }))} <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.steps[2],
      summary: time ? `${time} ${t.at}`.trim() : null,
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
          {guard}
          <input type="hidden" name="time" value={time} />
          <input type="hidden" name="party_size" value={partySize} />
          <ContactFields
            id="r"
            value={contact}
            onChange={setContact}
            labels={{ name: t.name, phone: t.phone, email: t.email, notes: t.notes, notesPlaceholder: t.notesPlaceholder }}
          >
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
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </button>
          </ContactFields>
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
  if (reason === "paused") return <>{t.unavailable.paused}{phone}</>;
  if (reason === "error") return <>{t.unavailable.error}{phone}</>;
  if (fullyBooked) return <>{t.unavailable.full}{phone}</>;
  return null;
}
