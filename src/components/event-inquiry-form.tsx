"use client";

import { useActionState, useRef, useState } from "react";
import { useTrackForm } from "@/components/analytics";
import { requestEventInquiry } from "@/app/catering/actions";
import { ArrowIcon, OccasionIcon } from "@/components/icons";
import { Wizard, type WizardStep } from "@/components/wizard";
import { fmtDate } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { BUDGET_CODES, OCCASION_CODES, type BudgetBand, type Occasion } from "@/lib/events";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

const MESSAGE_MAX = 1500;

/**
 * A celebration inquiry, asked one question at a time.
 *
 * Shares the wizard with the table booking rather than re-implementing it: same progress bar, same
 * go-back chips, same step animation. The questions differ, and so does what a step is allowed to
 * leave blank. Date and headcount are usually the things the guest wants to discuss, so step 2
 * carries a continue button instead of advancing on a choice, and its chip says so rather than
 * showing an empty answer.
 *
 * Every answer rides along as a hidden input, because only the current step is mounted. The contact
 * fields live in state for the same reason: going back through a chip unmounts them.
 */
export function EventInquiryForm({ locale, minDate }: { locale: Locale; minDate: string }) {
  const [state, formAction, pending] = useActionState(requestEventInquiry, null);
  useTrackForm("inquiry", state, pending);
  const t = getDictionary(locale).inquiryForm;
  const stepOf = getDictionary(locale).wizard.stepOf;

  const [step, setStep] = useState(1);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [guests, setGuests] = useState("");
  const [budget, setBudget] = useState<BudgetBand | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", message: "" });
  const dateInput = useRef<HTMLInputElement>(null);
  const guestsInput = useRef<HTMLInputElement>(null);
  const contactField = (key: keyof typeof contact) => ({
    value: contact[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact({ ...contact, [key]: e.target.value }),
  });

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.successTitle}</strong>
        <p>{t.successText}</p>
      </div>
    );
  }

  // "12.10.2026 · ca. 25 Personen", or whichever half the guest actually gave.
  const whenSummary =
    [eventDate ? fmtDate(eventDate, locale) : t.dateOpen, guests ? `${t.guestsAboutBefore}${guests}${t.guestsAboutAfter}` : null]
      .filter(Boolean)
      .join(" · ");

  const steps: WizardStep[] = [
    {
      title: t.steps[1],
      summary: occasion ? t.occasions[occasion] : null,
      changeLabel: t.changeOccasion,
      body: (
        <div className="wizard-body">
          {/* A grid rather than the wrapping pills the other steps use: six answers of very
              different lengths wrapped into a ragged block that was hard to scan, and each one
              now carries its own drawing. */}
          <div className="slots occasions" role="group" aria-label={t.occasion}>
            {OCCASION_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className="slot slot-icon"
                aria-pressed={occasion === code}
                onClick={() => {
                  setOccasion(code);
                  setStep(2);
                }}
              >
                <OccasionIcon code={code} />
                {t.occasions[code]}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: t.steps[2],
      summary: whenSummary,
      changeLabel: t.changeWhen,
      body: (
        <div className="wizard-body">
          <div className="preorder-when">
            <div>
              {/* Both optional on purpose: the date and the headcount are often what the guest wants to discuss. */}
              <label htmlFor="event_date">{t.date}</label>
              <input
                ref={dateInput}
                id="event_date"
                type="date"
                min={minDate}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="guests">{t.guests}</label>
              <input
                ref={guestsInput}
                id="guests"
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                placeholder={t.guestsPlaceholder}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="button"
              className="button"
              // Checked here, because the inputs unmount on the next step and only hidden copies of
              // their values reach the server, where a past date or 900 guests would be a late error.
              onClick={() => {
                if (dateInput.current?.reportValidity() && guestsInput.current?.reportValidity()) setStep(3);
              }}
            >
              {t.continueLabel} <ArrowIcon direction="right" />
            </button>
          </div>
        </div>
      ),
    },
    {
      title: t.steps[3],
      summary: budget ? t.budgets[budget] : null,
      changeLabel: t.changeBudget,
      body: (
        <div className="wizard-body">
          <div className="slots" role="group" aria-label={t.budget}>
            {BUDGET_CODES.map((code) => (
              <button
                key={code}
                type="button"
                className="slot"
                aria-pressed={budget === code}
                onClick={() => {
                  setBudget(code);
                  setStep(4);
                }}
              >
                {t.budgets[code]}
              </button>
            ))}
          </div>
          <p className="form-note">{t.budgetNote}</p>
        </div>
      ),
    },
    {
      title: t.steps[4],
      body: (
        <form className="wizard-body wizard-contact" action={formAction}>
          <input type="hidden" name="occasion" value={occasion ?? "andere"} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="event_date" value={eventDate} />
          <input type="hidden" name="guests" value={guests} />
          <input type="hidden" name="budget_band" value={budget ?? "unsicher"} />

          <div className="form-row">
            <div className="field-float">
              <input
                id="ev-name"
                name="name"
                required
                minLength={2}
                maxLength={FIELD_LIMITS.name}
                autoComplete="name"
                placeholder="María González"
                {...contactField("name")}
              />
              <label htmlFor="ev-name">{t.name}</label>
            </div>
            <div className="field-float">
              <input
                id="ev-phone"
                name="phone"
                type="tel"
                required
                minLength={5}
                maxLength={FIELD_LIMITS.phone}
                autoComplete="tel"
                placeholder="+49 170 1234567"
                {...contactField("phone")}
              />
              <label htmlFor="ev-phone">{t.phone}</label>
            </div>
          </div>
          <div className="field-float">
            <input
              id="ev-email"
              name="email"
              type="email"
              maxLength={FIELD_LIMITS.email}
              autoComplete="email"
              placeholder="maria@example.com"
              {...contactField("email")}
            />
            <label htmlFor="ev-email">{t.email}</label>
          </div>
          <div className="field-float">
            <textarea
              id="message"
              name="message"
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder={t.messagePlaceholder}
              {...contactField("message")}
            />
            <label htmlFor="message">{t.message}</label>
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
      ),
    },
  ];

  return <Wizard step={step} setStep={setStep} steps={steps} stepLabel={stepOf} />;
}
