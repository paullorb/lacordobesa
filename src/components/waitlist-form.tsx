"use client";

import { useActionState } from "react";
import { joinWaitlist } from "@/app/reservations/actions";
import { fmtDateDE } from "@/lib/dates";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Offered where the wizard would otherwise be a dead end: the day is full.
 *
 *  Collapsed behind a <details> on purpose. The guest's first instinct is to try another day, and
 *  the calendar is right there; the waitlist is for the guest who wants *that* day. */
export function WaitlistForm({ date, partySize, maxPartySize }: { date: string; partySize: number | null; maxPartySize: number }) {
  const [state, formAction, pending] = useActionState(joinWaitlist, null);

  if (state?.ok) {
    return (
      <div className="waitlist-done" role="status">
        <strong>Du stehst auf der Warteliste.</strong>
        <p>
          Wird für {fmtDateDE(date)} ein Tisch frei, melden wir uns bei dir. Das ist keine Zusage, aber Absagen kommen
          öfter vor als man denkt.
        </p>
      </div>
    );
  }

  return (
    <details className="waitlist">
      <summary>Auf die Warteliste für {fmtDateDE(date, { year: undefined })}</summary>
      <form action={formAction} className="waitlist-form">
        <p className="manage-hint">
          Wenn jemand absagt, rufen wir dich an. Keine Zusage, aber eine echte Chance: Absagen kommen öfter vor als man
          denkt.
        </p>
        <input type="hidden" name="date" value={date} />
        <div>
          <label htmlFor="wl-name">Name</label>
          <input id="wl-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="wl-phone">Telefon</label>
          <input id="wl-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" required />
        </div>
        <div>
          <label htmlFor="wl-email">E-Mail (optional)</label>
          <input id="wl-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
        </div>
        <div className="preorder-when">
          <div>
            <label htmlFor="wl-party">Personen</label>
            <input
              id="wl-party"
              name="party_size"
              type="number"
              min={1}
              max={maxPartySize}
              defaultValue={partySize ?? 2}
              required
            />
          </div>
          <div>
            <label htmlFor="wl-pref">Wunschzeit (optional)</label>
            <input id="wl-pref" name="time_preference" maxLength={120} placeholder="ab 19 Uhr, lieber früh …" />
          </div>
        </div>

        {state && !state.ok && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? "Wird gesendet …" : "Auf die Warteliste"}
        </button>
      </form>
    </details>
  );
}
