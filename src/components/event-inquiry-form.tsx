"use client";

import { useActionState } from "react";
import { requestEventInquiry } from "@/app/catering/actions";
import { BUDGET_CODES, OCCASION_CODES } from "@/lib/events";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

export function EventInquiryForm({ locale, minDate }: { locale: Locale; minDate: string }) {
  const [state, formAction, pending] = useActionState(requestEventInquiry, null);
  const t = getDictionary(locale).inquiryForm;

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.successTitle}</strong>
        <p>{t.successText}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="form">
      <div>
        <label htmlFor="occasion">{t.occasion}</label>
        <select id="occasion" name="occasion" defaultValue="geburtstag" required>
          {OCCASION_CODES.map((code) => (
            <option key={code} value={code}>
              {t.occasions[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="preorder-when">
        <div>
          {/* Both optional on purpose: the date and the headcount are often what the guest wants to discuss. */}
          <label htmlFor="event_date">{t.date}</label>
          <input id="event_date" name="event_date" type="date" min={minDate} />
        </div>
        <div>
          <label htmlFor="guests">{t.guests}</label>
          <input id="guests" name="guests" type="number" min={1} max={500} inputMode="numeric" placeholder={t.guestsPlaceholder} />
        </div>
      </div>

      <div>
        <label htmlFor="budget_band">{t.budget}</label>
        <select id="budget_band" name="budget_band" defaultValue="unsicher" required>
          {BUDGET_CODES.map((code) => (
            <option key={code} value={code}>
              {t.budgets[code]}
            </option>
          ))}
        </select>
        <p className="form-note">{t.budgetNote}</p>
      </div>

      <div>
        <label htmlFor="ev-name">{t.name}</label>
        <input id="ev-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="ev-phone">{t.phone}</label>
        <input id="ev-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" required />
      </div>
      <div>
        <label htmlFor="ev-email">{t.email}</label>
        <input id="ev-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="message">{t.message}</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          maxLength={1500}
          placeholder={t.messagePlaceholder}
        />
      </div>

      {state && !state.ok && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button" disabled={pending}>
        {pending ? t.submitting : t.submit}
      </button>
      <p className="form-note">{t.note}</p>
    </form>
  );
}
