"use client";

import { useActionState, useState } from "react";
import { subscribeToSpecials } from "@/app/specials/actions";
import { BROADCAST_CHANNELS, CHANNEL_LABEL, type BroadcastChannel } from "@/lib/broadcast";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Opt-in for the weekly special. One contact detail, one explicit consent checkbox, nothing else:
 *  every extra field here costs sign-ups, and none of them would be used. */
export function SpecialsOptin({ locale }: { locale: Locale }) {
  const [state, formAction, pending] = useActionState(subscribeToSpecials, null);
  const [channel, setChannel] = useState<BroadcastChannel>("whatsapp");
  const t = getDictionary(locale).optin;

  if (state?.ok) {
    return (
      <div className="optin optin-done" role="status">
        <strong>{t.doneTitle}</strong>
        <p>{t.doneText}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="optin">
      <div className="optin-copy">
        <p className="eyebrow">{t.eyebrow}</p>
        <h2>{t.title}</h2>
        <p>{t.text}</p>
      </div>

      <div className="optin-fields">
        <div className="slots" role="group" aria-label={t.channelLabel}>
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
        <input type="hidden" name="locale" value={locale} />

        <div>
          <label htmlFor="optin-name">{t.name}</label>
          <input id="optin-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" />
        </div>

        {channel === "whatsapp" ? (
          <div>
            <label htmlFor="optin-phone">{t.phone}</label>
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
            <label htmlFor="optin-email">{t.emailLabel}</label>
            <input id="optin-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" required />
          </div>
        )}

        <label className="optin-consent">
          <input type="checkbox" name="consent" required />
          <span>{t.consent[channel]}</span>
        </label>

        {state && !state.ok && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
