"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useTrackForm } from "@/components/analytics";
import { useFormGuard } from "@/components/form-guard";
import { requestEventInquiry } from "@/app/catering/actions";
import { OccasionIcon } from "@/components/icons";
import { BookingCalendar } from "@/components/booking-calendar";
import { ContactFields, type Contact } from "@/components/contact-fields";
import { PhoneNote } from "@/components/phone-note";
import { Wizard, type WizardStep } from "@/components/wizard";
import { addDays, fmtDate, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { BUDGET_CODES, GUEST_OPTIONS, OCCASION_CODES, type BudgetBand, type Occasion } from "@/lib/events";
import type { Locale } from "@/lib/i18n";

const MESSAGE_MAX = 1500;
/** A celebration is planned further ahead than a table, so the calendar opens on five weeks and
 *  reaches a year out, four weeks at a time. */
const FIRST_WEEKS = 5;
const DAYS_AHEAD = 365;
const NEVER_CHANGES = () => () => {};

/**
 * A celebration inquiry, asked one question at a time.
 *
 * Shares the wizard with the table booking rather than re-implementing it: same progress bar, same
 * go-back chips, same step animation. Date and headcount are usually what the guest wants to
 * discuss, so both can be answered "not sure yet"; `null` is "not asked yet", `""` is that answer.
 * The date is picked on the same calendar as the table booking and the pre-order.
 *
 * Every answer rides along as a hidden input, because only the current step is mounted. The contact
 * fields live in state for the same reason: going back through a chip unmounts them.
 */
export function EventInquiryForm({ locale, minDate }: { locale: Locale; minDate: string }) {
  const [state, formAction, pending] = useActionState(requestEventInquiry, null);
  const guard = useFormGuard("inquiry");
  useTrackForm("inquiry", state, pending);
  const t = getDictionary(locale).inquiryForm;
  const stepOf = getDictionary(locale).wizard.stepOf;

  const [step, setStep] = useState(1);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [guests, setGuests] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetBand | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "", notes: "" });
  const today = useSyncExternalStore(NEVER_CHANGES, todayISO, () => minDate);
  // From tomorrow: a celebration is never arranged for the same day.
  const firstDay = addDays(today > minDate ? today : minDate, 1);

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
          <BookingCalendar
            locale={locale}
            today={today}
            firstDay={firstDay}
            maxDate={addDays(firstDay, DAYS_AHEAD)}
            selected={eventDate || null}
            isClosed={() => false}
            onPick={(iso) => {
              setEventDate(iso);
              setStep(3);
            }}
            label={t.date}
            initialWeeks={FIRST_WEEKS}
          />
          <div className="slots">
            <button
              type="button"
              className="slot"
              aria-pressed={eventDate === ""}
              onClick={() => {
                setEventDate("");
                setStep(3);
              }}
            >
              {t.dateUnknown}
            </button>
          </div>
        </div>
      ),
    },
    {
      title: t.steps[3],
      summary: guests === null ? null : guests ? `${t.guestsAboutBefore}${guests}${t.guestsAboutAfter}` : t.guestsUnknown,
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
          {guard}
          <input type="hidden" name="event_date" value={eventDate ?? ""} />
          <input type="hidden" name="guests" value={guests ?? ""} />
          <input type="hidden" name="budget_band" value={budget ?? "unsicher"} />

          <ContactFields
            id="ev"
            value={contact}
            onChange={setContact}
            labels={{ name: t.name, phone: t.phone, email: t.email, notes: t.message, notesPlaceholder: t.messagePlaceholder }}
            notesName="message"
            notesMax={MESSAGE_MAX}
          >
            {state && !state.ok && (
              <p className="form-error" role="alert">
                {state.error}
              </p>
            )}
            <button type="submit" className="button" disabled={pending}>
              {pending ? t.submitting : t.submit}
            </button>
            <p className="form-note">{t.note}</p>
          </ContactFields>
        </form>
      ),
    },
  ];

  return <Wizard step={step} setStep={setStep} steps={steps} stepLabel={stepOf} footer={<PhoneNote locale={locale} />} />;
}
