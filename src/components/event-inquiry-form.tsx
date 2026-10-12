"use client";

import { useActionState } from "react";
import { requestEventInquiry } from "@/app/catering/actions";
import { BUDGET_BANDS, BUDGET_CODES, OCCASION_CODES, OCCASIONS } from "@/lib/events";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

export function EventInquiryForm({ minDate }: { minDate: string }) {
  const [state, formAction, pending] = useActionState(requestEventInquiry, null);

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>¡Gracias! Anfrage erhalten.</strong>
        <p>
          Wir schauen uns deine Feier an und melden uns, meist innerhalb von zwei Tagen, mit einem Vorschlag. Wenn es
          dringend ist, ruf uns gern direkt an.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="form">
      <div>
        <label htmlFor="occasion">Was feiert ihr?</label>
        <select id="occasion" name="occasion" defaultValue="geburtstag" required>
          {OCCASION_CODES.map((code) => (
            <option key={code} value={code}>
              {OCCASIONS[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="preorder-when">
        <div>
          {/* Both optional on purpose: the date and the headcount are often what the guest wants to discuss. */}
          <label htmlFor="event_date">Datum (falls schon klar)</label>
          <input id="event_date" name="event_date" type="date" min={minDate} />
        </div>
        <div>
          <label htmlFor="guests">Personen (ungefähr)</label>
          <input id="guests" name="guests" type="number" min={1} max={500} inputMode="numeric" placeholder="z. B. 25" />
        </div>
      </div>

      <div>
        <label htmlFor="budget_band">Welcher Rahmen passt?</label>
        <select id="budget_band" name="budget_band" defaultValue="unsicher" required>
          {BUDGET_CODES.map((code) => (
            <option key={code} value={code}>
              {BUDGET_BANDS[code]}
            </option>
          ))}
        </select>
        <p className="form-note">Nur zur Orientierung, damit wir dir gleich etwas Passendes vorschlagen können.</p>
      </div>

      <div>
        <label htmlFor="ev-name">Name</label>
        <input id="ev-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="ev-phone">Telefon</label>
        <input id="ev-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" required />
      </div>
      <div>
        <label htmlFor="ev-email">E-Mail (optional)</label>
        <input id="ev-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="message">Erzähl uns von deiner Feier</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={1500}
          placeholder="Bei uns im Lokal oder bei euch? Warmes Essen, Fingerfood oder eine mesa dulce? Gibt es Allergien oder vegetarische Gäste?"
        />
      </div>

      {state && !state.ok && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Wird gesendet …" : "Anfrage senden"}
      </button>
      <p className="form-note">
        Eine Anfrage ist noch keine Buchung. Wir melden uns mit einem Vorschlag, dann besprechen wir alles in Ruhe.
      </p>
    </form>
  );
}
