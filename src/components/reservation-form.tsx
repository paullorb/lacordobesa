"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { addDays, fmtDateDE } from "@/lib/dates";
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

const FIRST_DAYS = 14;

const weekdayShort = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", weekday: "long" });
const monthShort = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", month: "short" });

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function ReservationForm({ maxPartySize, minDate, maxDate, closedWeekdays, phoneHref, phoneLabel }: Props) {
  const [state, formAction, submitting] = useActionState<RequestState, FormData>(requestReservation, null);
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState<number | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reason, setReason] = useState<UnavailableReason | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);
  const [movedFrom, setMovedFrom] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "" });
  const [loading, startLoading] = useTransition();
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    startLoading(async () => {
      const first = await getFirstAvailableDay(minDate);
      if (id !== request.current || !first) return;
      setDate(first.date);
      setSlots(first.slots);
      setMovedFrom(first.date !== minDate);
      setStep(2);
    });
  }, [minDate]);

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
    setDate(value);
    setTime("");
    setPartySize(null);
    setSlots([]);
    setMovedFrom(false);
    setStep(1);
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
  const days = Array.from({ length: Math.max(0, daysBetween(minDate, maxDate) + 1) }, (_, i) => addDays(minDate, i));
  const visibleDays = showAllDays ? days : days.slice(0, FIRST_DAYS);

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
          <div className="day-grid" role="group" aria-label="Datum wählen">
            {visibleDays.map((iso) => {
              const closed = closedWeekdays.includes(at(iso).getUTCDay());
              return (
                <button
                  key={iso}
                  type="button"
                  className="day"
                  aria-pressed={date === iso}
                  disabled={closed || loading}
                  title={closed ? "Ruhetag" : undefined}
                  onClick={() => chooseDate(iso)}
                >
                  <small>{iso === minDate ? "Heute" : weekdayShort.format(at(iso))}</small>
                  <strong>{Number(iso.slice(8))}</strong>
                  <small>{monthShort.format(at(iso))}</small>
                </button>
              );
            })}
          </div>
          {!showAllDays && days.length > FIRST_DAYS && (
            <button type="button" className="text-button" onClick={() => setShowAllDays(true)}>
              Weitere Tage anzeigen
            </button>
          )}
          {loading && <p className="form-note">Verfügbarkeit wird geladen …</p>}
          {!loading && date && step === 1 && (
            <p className="form-note" role="status">
              {unavailableMessage(date, reason, slots.length > 0 && bookable.length === 0, phoneHref, phoneLabel)}
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="wizard-body">
          {movedFrom && (
            <p className="form-note" role="status">
              Heute ist keine Online-Reservierung möglich (Ruhetag oder zu kurzfristig) – wir haben den nächsten Tag mit freien Plätzen vorausgewählt.
            </p>
          )}
          <div className="slots" role="group" aria-label="Uhrzeit wählen">
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
        <form className="wizard-body wizard-contact" action={formAction}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          <input type="hidden" name="party_size" value={partySize} />
          <div className="form-row">
            <div className="field">
              <label htmlFor="r-name">Name</label>
              <input
                id="r-name"
                name="name"
                required
                minLength={2}
                maxLength={FIELD_LIMITS.name}
                autoComplete="name"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="r-phone">Telefon</label>
              <input
                id="r-phone"
                name="phone"
                type="tel"
                required
                minLength={5}
                maxLength={FIELD_LIMITS.phone}
                autoComplete="tel"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="r-email">E-Mail (optional)</label>
            <input
              id="r-email"
              name="email"
              type="email"
              maxLength={FIELD_LIMITS.email}
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="r-notes">Anmerkungen (optional)</label>
            <textarea
              id="r-notes"
              name="notes"
              rows={3}
              maxLength={FIELD_LIMITS.notes}
              placeholder="Kinderstuhl, Allergien, Anlass …"
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            />
          </div>

          {state && !state.ok && (
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

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Wird gesendet …" : "Tisch anfragen"}
          </button>
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

function daysBetween(from: string, to: string) {
  return Math.round((at(to).getTime() - at(from).getTime()) / 86_400_000);
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
