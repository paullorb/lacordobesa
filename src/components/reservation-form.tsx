"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { fmtDateDE } from "@/lib/dates";
import {
  getAvailability,
  getFirstAvailableDay,
  requestReservation,
  type RequestState,
  type Slot,
  type UnavailableReason,
} from "@/app/reservations/actions";

type Props = {
  maxPartySize: number;
  minDate: string;
  maxDate: string;
  closedWeekdays: number[];
  phoneHref: string;
  phoneLabel: string;
};

type Step = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<Step, string> = {
  1: "Wann möchtest du kommen?",
  2: "Um wie viel Uhr?",
  3: "Für wie viele Personen?",
  4: "Wer kommt?",
};

/** Monday first, the way a German calendar reads. */
const WEEKDAY_HEADS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const weekdayLong = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long" });
const monthLong = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "long", year: "numeric" });

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function ReservationForm({ maxPartySize, minDate, maxDate, closedWeekdays, phoneHref, phoneLabel }: Props) {
  const [state, formAction, submitting] = useActionState<RequestState, FormData>(requestReservation, null);
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reason, setReason] = useState<UnavailableReason | null>(null);
  const [movedFrom, setMovedFrom] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "" });
  // Date + time the last submit was made for, so a slot error stops showing once the guest picks another slot.
  const [attempt, setAttempt] = useState("");
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
      setMovedFrom(first.date !== minDate);
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
    setMovedFrom(false);
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
        <strong>¡Gracias! Anfrage erhalten.</strong>
        <p>
          {fmtDateDE(date)} um {time} Uhr für {partySize} {partySize === 1 ? "Person" : "Personen"}. Wir melden uns so
          bald wie möglich telefonisch oder per WhatsApp, um deine Reservierung zu bestätigen. Bis dahin ist der Tisch
          noch nicht fest zugesagt.
        </p>
      </div>
    );
  }

  const selectedSlot = slots.find((s) => s.time === time);
  const maxForSlot = Math.min(maxPartySize, selectedSlot?.seatsLeft ?? maxPartySize);
  const bookable = slots.filter((s) => s.seatsLeft > 0);
  const months = calendarMonths(minDate, maxDate);
  const blocker = date
    ? unavailableMessage(date, reason, slots.length > 0 && bookable.length === 0, phoneHref, phoneLabel)
    : null;
  // The request can only be sent once we know who to call back – so the button only appears then.
  const contactReady = contact.name.trim().length >= 2 && contact.phone.trim().length >= 5;

  return (
    <div className="form wizard">
      <div className="wizard-head">
        <p className="wizard-step">Schritt {step} von 4</p>
        <div className="wizard-dots" aria-hidden="true">
          {([1, 2, 3, 4] as const).map((n) => (
            <span key={n} className={n <= step ? "on" : undefined} />
          ))}
        </div>
      </div>

      {step > 1 && (
        <div className="wizard-summary">
          <button type="button" className="chip" onClick={() => setStep(1)}>
            {fmtDateDE(date)} <span aria-hidden="true">✎</span>
            <span className="sr-only">Datum ändern</span>
          </button>
          {step > 2 && (
            <button type="button" className="chip" onClick={() => setStep(2)}>
              {time} Uhr <span aria-hidden="true">✎</span>
              <span className="sr-only">Uhrzeit ändern</span>
            </button>
          )}
          {step > 3 && partySize && (
            <button type="button" className="chip" onClick={() => setStep(3)}>
              {partySize} {partySize === 1 ? "Person" : "Personen"} <span aria-hidden="true">✎</span>
              <span className="sr-only">Personenzahl ändern</span>
            </button>
          )}
        </div>
      )}

      <h3 className="wizard-title">{STEP_TITLES[step]}</h3>

      {step === 1 && (
        <div className="wizard-body">
          {movedFrom && (
            <p className="form-note" role="status">
              Heute ist keine Online-Reservierung möglich (Ruhetag oder zu kurzfristig) – wir haben den nächsten Tag
              mit freien Plätzen vorausgewählt.
            </p>
          )}
          <div className="calendar" role="group" aria-label="Datum wählen">
            {months.map((month) => (
              <div className="calendar-month" key={month.key}>
                <p className="calendar-label">{month.label}</p>
                <div className="calendar-heads" aria-hidden="true">
                  {WEEKDAY_HEADS.map((w) => (
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
                        aria-label={fmtDateDE(iso, { weekday: "long" })}
                        disabled={closed || loading}
                        title={closed ? "Ruhetag" : undefined}
                        onClick={() => chooseDate(iso)}
                      >
                        {Number(iso.slice(8))}
                        {iso === minDate && <small>Heute</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {loading && <p className="form-note">Verfügbarkeit wird geladen …</p>}
          {!loading && blocker && (
            <p className="form-note" role="status">
              {blocker}
            </p>
          )}
          {!loading && bookable.length > 0 && (
            <div>
              <button type="button" className="button" onClick={() => setStep(2)}>
                Weiter mit {fmtDateDE(date, { year: undefined })} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="wizard-body">
          <div className="slots times" role="group" aria-label="Uhrzeit wählen">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className="slot"
                aria-pressed={time === s.time}
                disabled={s.seatsLeft <= 0}
                title={s.seatsLeft <= 0 ? "Ausgebucht" : undefined}
                onClick={() => chooseTime(s.time, s.seatsLeft)}
              >
                {s.time}
              </button>
            ))}
          </div>
          {loading && <p className="form-note">Verfügbarkeit wird geladen …</p>}
        </div>
      )}

      {step === 3 && (
        <div className="wizard-body">
          <div className="slots" role="group" aria-label="Personenzahl wählen">
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
            {maxForSlot < maxPartySize
              ? `Zu dieser Uhrzeit sind nur noch ${maxForSlot} Plätze frei. `
              : ""}
            Größere Gruppen (ab {maxPartySize + 1} Personen) bitte telefonisch: <a href={phoneHref}>{phoneLabel}</a>
          </p>
        </div>
      )}

      {step === 4 && partySize && (
        <form
          className="wizard-body wizard-contact"
          action={(fd) => {
            setAttempt(`${date} ${time}`);
            formAction(fd);
          }}
        >
          <input type="hidden" name="date" value={date} />
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
              <label htmlFor="r-name">Name</label>
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
              <label htmlFor="r-phone">Telefon</label>
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
            <label htmlFor="r-email">E-Mail (optional)</label>
          </div>
          <div className="field-float">
            <textarea
              id="r-notes"
              name="notes"
              rows={2}
              maxLength={FIELD_LIMITS.notes}
              placeholder="Kinderstuhl, Allergien, Anlass …"
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            />
            <label htmlFor="r-notes">Anmerkungen (optional)</label>
          </div>

          {state && !state.ok && attempt === `${date} ${time}` && (
            <div className="form-error" role="alert">
              {state.error}
              {state.retryTime && (
                <>
                  {" "}
                  <button type="button" className="text-button" onClick={chooseOtherTime}>
                    Andere Uhrzeit wählen
                  </button>
                </>
              )}
            </div>
          )}

          {contactReady ? (
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Wird gesendet …" : "Tisch anfragen"}
            </button>
          ) : (
            <p className="form-note" role="status">
              Name und Telefonnummer eintragen – danach kannst du den Tisch anfragen.
            </p>
          )}
          <p className="form-note">Deine Anfrage ist unverbindlich, bis wir sie bestätigen.</p>
        </form>
      )}

      {step > 1 && step < 4 && bookable.length === 0 && !loading && (
        <p className="form-note">
          Für diesen Tag ist nichts mehr frei. Ruf uns gern an: <a href={phoneHref}>{phoneLabel}</a>
        </p>
      )}
    </div>
  );
}

type CalendarMonth = { key: string; label: string; pad: number; days: string[] };

/**
 * One Monday-first calendar block per month touched by `minDate`..`maxDate`. Only bookable days get a
 * tile; `pad` is the width of the empty run before the first one, so the weekday columns line up.
 */
function calendarMonths(minDate: string, maxDate: string): CalendarMonth[] {
  const months: CalendarMonth[] = [];
  let cursor = minDate.slice(0, 7);
  while (cursor <= maxDate.slice(0, 7)) {
    const [year, month] = cursor.split("-").map(Number);
    const days: string[] = [];
    for (let day = 1; day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); day++) {
      const iso = `${cursor}-${String(day).padStart(2, "0")}`;
      if (iso >= minDate && iso <= maxDate) days.push(iso);
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

function unavailableMessage(
  date: string,
  reason: UnavailableReason | null,
  fullyBooked: boolean,
  phoneHref: string,
  phoneLabel: string,
) {
  const phone = (
    <>
      {" "}
      Ruf uns gern an: <a href={phoneHref}>{phoneLabel}</a>
    </>
  );
  if (reason === "closed") return <>{weekdayLong.format(at(date))}s ist Ruhetag. Bitte wähle einen anderen Tag.</>;
  if (reason === "holiday") return <>An diesem Tag haben wir geschlossen. Bitte wähle einen anderen Tag.</>;
  if (reason === "late") return <>Für diesen Tag ist es für eine Online-Reservierung zu kurzfristig.{phone}</>;
  if (reason === "error") return <>Die Verfügbarkeit konnte nicht geladen werden. Bitte versuch es noch einmal.{phone}</>;
  if (fullyBooked) return <>An diesem Tag ist leider alles ausgebucht.{phone}</>;
  return null;
}
