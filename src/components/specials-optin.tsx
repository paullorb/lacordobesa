"use client";

import { useActionState, useState } from "react";
import { subscribeToSpecials } from "@/app/specials/actions";
import { BROADCAST_CHANNELS, CHANNEL_LABEL, CONSENT_TEXT, type BroadcastChannel } from "@/lib/broadcast";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Opt-in for the weekly special. One contact detail, one explicit consent checkbox, nothing else:
 *  every extra field here costs sign-ups, and none of them would be used. */
export function SpecialsOptin() {
  const [state, formAction, pending] = useActionState(subscribeToSpecials, null);
  const [channel, setChannel] = useState<BroadcastChannel>("whatsapp");

  if (state?.ok) {
    return (
      <div className="optin optin-done" role="status">
        <strong>¡Listo! Du bist dabei.</strong>
        <p>Wir melden uns, wenn es etwas Besonderes gibt. Abmelden kannst du dich jederzeit über den Link in der Nachricht.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="optin">
      <div className="optin-copy">
        <p className="eyebrow">No te lo pierdas</p>
        <h2>Specials nicht verpassen</h2>
        <p>
          Locro im Winter, Empanadas-Aktionen, ein neuer Kuchen: wir sagen dir Bescheid, wenn es etwas Besonderes gibt.
          Höchstens ein paar Nachrichten im Monat.
        </p>
      </div>

      <div className="optin-fields">
        <div className="slots" role="group" aria-label="Wie dürfen wir dich erreichen?">
          {BROADCAST_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              className="slot"
              aria-pressed={channel === c}
              onClick={() => setChannel(c)}
            >
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        <input type="hidden" name="channel" value={channel} />

        <div>
          <label htmlFor="optin-name">Name (optional)</label>
          <input id="optin-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" />
        </div>

        {channel === "whatsapp" ? (
          <div>
            <label htmlFor="optin-phone">Handynummer</label>
            <input
              id="optin-phone"
              name="phone"
              type="tel"
              maxLength={FIELD_LIMITS.phone}
              autoComplete="tel"
              required
              placeholder="+49 …"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="optin-email">E-Mail</label>
            <input id="optin-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" required />
          </div>
        )}

        <label className="optin-consent">
          <input type="checkbox" name="consent" required />
          <span>{CONSENT_TEXT[channel]}</span>
        </label>

        {state && !state.ok && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Bescheid geben"}
        </button>
      </div>
    </form>
  );
}
