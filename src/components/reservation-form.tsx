"use client";

import { useActionState, useState, useTransition } from "react";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { getAvailability, requestReservation, type RequestState, type Slot } from "@/app/reservations/actions";

type Props = {
  maxPartySize: number;
  minDate: string;
  maxDate: string;
  phoneHref: string;
  phoneLabel: string;
};

export function ReservationForm({ maxPartySize, minDate, maxDate, phoneHref, phoneLabel }: Props) {
  const [state, formAction, submitting] = useActionState<RequestState, FormData>(requestReservation, null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadingSlots, startLoading] = useTransition();

  function chooseDate(value: string) {
    setDate(value);
    setTime("");
    setSlots(null);
    if (value) startLoading(async () => setSlots(await getAvailability(value)));
  }

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>¡Gracias! Anfrage erhalten.</strong>
        <p>
          Wir melden uns so bald wie möglich telefonisch oder per WhatsApp, um deine Reservierung zu bestätigen. Bis
          dahin ist der Tisch noch nicht fest zugesagt.
        </p>
      </div>
    );
  }

  const freeSlots = slots?.filter((s) => s.seatsLeft >= partySize) ?? [];

  return (
    <form className="form" action={formAction}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="r-date">Datum</label>
          <input
            id="r-date"
            name="date"
            type="date"
            required
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => chooseDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="r-party">Personen</label>
          <select id="r-party" name="party_size" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}>
            {Array.from({ length: maxPartySize }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "Person" : "Personen"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Uhrzeit</label>
        <input type="hidden" name="time" value={time} />
        {!date && <p className="form-note">Wähle zuerst ein Datum.</p>}
        {date && loadingSlots && <p className="form-note">Verfügbarkeit wird geladen …</p>}
        {date && !loadingSlots && slots && slots.length === 0 && (
          <p className="form-note">An diesem Tag haben wir geschlossen oder nehmen keine Reservierungen an.</p>
        )}
        {date && !loadingSlots && slots && slots.length > 0 && (
          <div className="slots" role="group" aria-label="Uhrzeit wählen">
            {slots.map((s) => {
              const free = s.seatsLeft >= partySize;
              return (
                <button
                  key={s.time}
                  type="button"
                  className="slot"
                  aria-pressed={time === s.time}
                  disabled={!free}
                  title={free ? undefined : "Ausgebucht"}
                  onClick={() => setTime(s.time)}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}
        {date && !loadingSlots && slots && slots.length > 0 && freeSlots.length === 0 && (
          <p className="form-note">
            Für {partySize} Personen ist an diesem Tag leider nichts mehr frei. Ruf uns gern an:{" "}
            <a href={phoneHref}>{phoneLabel}</a>
          </p>
        )}
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="r-name">Name</label>
          <input id="r-name" name="name" required minLength={2} maxLength={FIELD_LIMITS.name} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="r-phone">Telefon</label>
          <input id="r-phone" name="phone" type="tel" required minLength={5} maxLength={FIELD_LIMITS.phone} autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="r-email">E-Mail (optional)</label>
        <input id="r-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="r-notes">Anmerkungen (optional)</label>
        <textarea id="r-notes" name="notes" rows={3} maxLength={FIELD_LIMITS.notes} placeholder="Kinderstuhl, Allergien, Anlass …" />
      </div>

      {state && !state.ok && <div className="form-error" role="alert">{state.error}</div>}

      <button className="button" type="submit" disabled={submitting || !time}>
        {submitting ? "Wird gesendet …" : "Tisch anfragen"}
      </button>
      <p className="form-note">
        Deine Anfrage ist unverbindlich, bis wir sie bestätigen. Größere Gruppen (ab {maxPartySize + 1} Personen) bitte
        telefonisch.
      </p>
    </form>
  );
}
