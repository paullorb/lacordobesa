"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTrackForm } from "@/components/analytics";
import { requestEventInquiry } from "@/app/catering/actions";
import { ArrowIcon, OccasionIcon } from "@/components/icons";
import { PhoneNote } from "@/components/phone-note";
import { Wizard, type WizardStep } from "@/components/wizard";
import { addDays, fmtDate, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { BUDGET_CODES, GUEST_OPTIONS, OCCASION_CODES, type BudgetBand, type Occasion } from "@/lib/events";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

const MESSAGE_MAX = 1500;
const QUICK_DAYS = 6;
const NEVER_CHANGES = () => () => {};

/**
 * A celebration inquiry, asked one question at a time.
 *
 * Shares the wizard with the table booking rather than re-implementing it: same progress bar, same
 * go-back chips, same step animation. Date and headcount are usually what the guest wants to
 * discuss, so both can be answered "not sure yet"; `null` is "not asked yet", `""` is that answer.
 * The date offers the next few days as chips and opens the native picker for anything else.
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
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState(false);
  const [guests, setGuests] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetBand | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", message: "" });
  const dateInput = useRef<HTMLInputElement>(null);
  const today = useSyncExternalStore(NEVER_CHANGES, todayISO, () => minDate);
  const firstDay = today > minDate ? today : minDate;
  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => addDays(firstDay, i + 1));

  useEffect(() => {
    if (!customDate) return;
    try {
      dateInput.current?.showPicker();
    } catch {
      // Not allowed without a recent tap, or not supported: the field is on screen and can be typed into.
    }
  }, [customDate]);
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
      summary: eventDate === null ? null : eventDate ? fmtDate(eventDate, locale) : t.dateOpen,
      changeLabel: t.changeDate,
      body: (
        <div className="wizard-body">
          <div className="slots" role="group" aria-label={t.date}>
            {quickDays.map((iso) => (
              <button
                key={iso}
                type="button"
                className="slot"
                aria-pressed={!customDate && eventDate === iso}
                onClick={() => {
                  setCustomDate(false);
                  setEventDate(iso);
                  setStep(3);
                }}
              >
                {fmtDate(iso, locale, { year: undefined, day: "numeric" })}
              </button>
            ))}
            <button
              type="button"
              className="slot"
              aria-pressed={customDate || (!!eventDate && !quickDays.includes(eventDate))}
              onClick={() => setCustomDate(true)}
            >
              {t.otherDate}
            </button>
            <button
              type="button"
              className="slot"
              aria-pressed={!customDate && eventDate === ""}
              onClick={() => {
                setCustomDate(false);
                setEventDate("");
                setStep(3);
              }}
            >
              {t.dateUnknown}
            </button>
          </div>
          {customDate && (
            <div className="date-pick">
              <input
                ref={dateInput}
                className="date-input"
                type="date"
                required
                aria-label={t.date}
                min={firstDay}
                value={eventDate ?? ""}
                onChange={(e) => setEventDate(e.target.value)}
              />
              <button
                type="button"
                className="button"
                // Checked here, because the input unmounts on the next step and only a hidden copy
                // of its value reaches the server, where a past date would be a late error.
                onClick={() => {
                  if (dateInput.current?.reportValidity()) setStep(3);
                }}
              >
                {t.continueLabel} <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t.steps[3],
      summary: guests ? `${t.guestsAboutBefore}${guests}${t.guestsAboutAfter}` : null,
      changeLabel: t.changeGuests,
      body: (
        <div className="wizard-body">
          <div className="slots" role="group" aria-label={t.guests}>
            {GUEST_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className="slot"
                aria-pressed={guests === String(n)}
                onClick={() => {
                  setGuests(String(n));
                  setStep(4);
                }}
              >
                {t.guestsOption(n)}
              </button>
            ))}
            <button
              type="button"
              className="slot"
              aria-pressed={guests === ""}
              onClick={() => {
                setGuests("");
                setStep(4);
              }}
            >
              {t.guestsUnknown}
            </button>
          </div>
          <p className="form-note">{t.guestsNote}</p>
        </div>
      ),
    },
    {
      title: t.steps[4],
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
                  setStep(5);
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
      title: t.steps[5],
      body: (
        <form className="wizard-body wizard-contact" action={formAction}>
          <input type="hidden" name="occasion" value={occasion ?? "andere"} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="event_date" value={eventDate ?? ""} />
          <input type="hidden" name="guests" value={guests ?? ""} />
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

  return <Wizard step={step} setStep={setStep} steps={steps} stepLabel={stepOf} footer={<PhoneNote locale={locale} />} />;
}
