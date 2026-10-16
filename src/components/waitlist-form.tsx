"use client";

import { useActionState } from "react";
import { useTrackForm } from "@/components/analytics";
import { joinWaitlist } from "@/app/reservierung/actions";
import { PhoneNote } from "@/components/phone-note";
import { fmtDate } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Offered where the wizard would otherwise be a dead end: the day is full.
 *
 *  Collapsed behind a <details> on purpose. The guest's first instinct is to try another day, and
 *  the calendar is right there; the waitlist is for the guest who wants *that* day. */
export function WaitlistForm({
  locale,
  date,
  partySize,
  maxPartySize,
}: {
  locale: Locale;
  date: string;
  partySize: number | null;
  maxPartySize: number;
}) {
  const [state, formAction, pending] = useActionState(joinWaitlist, null);
  useTrackForm("waitlist", state, pending);
  const t = getDictionary(locale).waitlist;

  if (state?.ok) {
    return (
      <div className="waitlist-done" role="status">
        <strong>{t.doneTitle}</strong>
        <p>{t.doneText(fmtDate(date, locale))}</p>
      </div>
    );
  }

  return (
    <details className="waitlist">
      <summary>{t.summary(fmtDate(date, locale, { year: undefined }))}</summary>
      <form action={formAction} className="waitlist-form">
        <p className="manage-hint">{t.explain}</p>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label htmlFor="wl-name">{t.name}</label>
          <input id="wl-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="wl-phone">{t.phone}</label>
          <input id="wl-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" required />
        </div>
        <div>
          <label htmlFor="wl-email">{t.email}</label>
          <input id="wl-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
        </div>
        <div className="preorder-when">
          <div>
            <label htmlFor="wl-party">{t.party}</label>
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
            <label htmlFor="wl-pref">{t.preference}</label>
            <input id="wl-pref" name="time_preference" maxLength={120} placeholder={t.preferencePlaceholder} />
          </div>
        </div>

        {state && !state.ok && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <PhoneNote locale={locale} />
      </form>
    </details>
  );
}
