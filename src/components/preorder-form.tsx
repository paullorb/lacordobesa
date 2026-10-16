"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useTrackForm } from "@/components/analytics";
import { requestPreorder } from "@/app/vorbestellen/actions";
import { ArrowIcon, MenuIcon } from "@/components/icons";
import { CalendarDay } from "@/components/calendar-day";
import { calendarMonths } from "@/components/reservation-form";
import { Wizard, type WizardStep } from "@/components/wizard";
import { PhoneNote } from "@/components/phone-note";
import { EMPANADA_SLUG, PREPARATIONS, type Preparation } from "@/lib/preorder-preparation";
import type { PreorderableItem } from "@/lib/preorders";
import { fmtDate, leadBoundary, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, localeHref, type Locale } from "@/lib/i18n";
import { isUntranslated, menuDescription } from "@/lib/menu-text";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Opening hours as the form needs them: weekday (0 = Sunday) to the window the shop is open. */
export type PickupWindow = { opens: string; closes: string } | null;

type Props = {
  locale: Locale;
  items: PreorderableItem[];
  /** Indexed by weekday, 0 = Sunday, matching Date#getUTCDay and the opening_hours table. */
  windows: PickupWindow[];
  closedDates: string[];
  minDate: string;
  maxDate: string;
  maxQuantity: number;
  maxLines: number;
  leadHours: number;
};

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Pickup times every half hour, from the first one that is both open and far enough ahead, to half
 *  an hour before closing (nobody wants a tray of empanadas handed over while the chairs go up). */
function pickupSlots(window: PickupWindow, earliest: string | undefined) {
  if (!window) return [];
  const start = Math.ceil(Math.max(toMinutes(window.opens), toMinutes(earliest ?? window.opens)) / 30) * 30;
  const out: string[] = [];
  for (let m = start; m <= toMinutes(window.closes) - 30; m += 30) out.push(toTime(m));
  return out;
}

/**
 * A pre-order, asked the way the celebration inquiry asks: which kind, which dishes, when, who.
 *
 * The kind comes first (Empanadas, Pizzas) so the dish list that follows is only the ones the guest
 * came for, rather than every pre-orderable dish at once. A basket with empanadas gets one more
 * question, fresh or par-baked for the freezer; without them that step does not exist, so the step
 * numbers below are never hard-coded: each button moves to `step + 1` and the Wizard counts the array.
 *
 * Quantities move in the dish's pack size, so empanadas go 6, 12, 18 and a pizza goes one at a time;
 * request_preorder() refuses anything else. The guest's details come last and the closing note says
 * what happens next, because a pre-order is a request that the shop confirms with a call, not a sale.
 *
 * Every answer rides along as a hidden input, because only the current step is mounted.
 */
export function PreorderForm({ locale, items, windows, closedDates, minDate, maxDate, maxQuantity, maxLines, leadHours }: Props) {
  const [state, formAction, pending] = useActionState(requestPreorder, null);
  useTrackForm("preorder", state, pending);
  const dict = getDictionary(locale);
  const t = dict.preorderForm;
  const r = dict.reservation;
  const monthLong = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", month: "long", year: "numeric" });

  // The calendar hints ("Morgen") count from the visitor's today; the server render has no clock to trust.
  const today = useSyncExternalStore(
    () => () => {},
    todayISO,
    () => minDate,
  );
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [preparation, setPreparation] = useState<Preparation | "">("");
  // The stepper entry that last changed, so only that number plays its bump (and not every row again
  // whenever the step remounts). `n` makes each press a new key and so a fresh run of the animation.
  const [bump, setBump] = useState<{ id: string; n: number; dir: "up" | "down" } | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", notes: "" });
  const contactField = (key: keyof typeof contact) => ({
    value: contact[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact({ ...contact, [key]: e.target.value }),
  });

  const chosen = items.filter((i) => (quantities[i.id] ?? 0) > 0);
  const categories = [...new Set(items.map((i) => i.category))];
  const slugOf = (category: string) => items.find((i) => i.category === category)?.categorySlug ?? "";
  // A dish already counted stays in the order even if its category is unticked again, so going
  // back to step 1 can never silently drop something from the basket.
  const shown = categories.filter((c) => picked.includes(c) || items.some((i) => i.category === c && (quantities[i.id] ?? 0) > 0));

  const windowOf = (iso: string) => windows[at(iso).getUTCDay()];
  const isClosed = (iso: string) => closedDates.includes(iso) || !windowOf(iso);
  // On the first possible day the lead time, not the opening hour, sets the earliest pickup. Read
  // only once a date is picked, so the clock never runs during the server render.
  function slotsFor(iso: string) {
    if (!iso || isClosed(iso)) return [];
    const boundary = leadBoundary(leadHours);
    if (iso < boundary.date) return [];
    return pickupSlots(windowOf(iso), iso === boundary.date ? boundary.time : undefined);
  }
  const slots = date ? slotsFor(date) : [];
  const hasEmpanadas = chosen.some((i) => i.categorySlug === EMPANADA_SLUG);

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.successTitle}</strong>
        <p>
          {t.successBefore(fmtDate(date, locale))}
          <a href={localeHref(locale, `/vorbestellung/${state.token}`)}>{t.successLink}</a>
          {t.successAfter}
        </p>
      </div>
    );
  }

  function go(to: number) {
    setBump(null);
    setStep(to);
  }

  function change(item: PreorderableItem, delta: number) {
    setBump((b) => ({ id: item.id, n: (b?.n ?? 0) + 1, dir: delta > 0 ? "up" : "down" }));
    setQuantities((q) => {
      const next = Math.min(Math.max((q[item.id] ?? 0) + delta * item.preorder_step, 0), maxQuantity - (maxQuantity % item.preorder_step));
      return { ...q, [item.id]: next };
    });
  }

  const itemsSummary = chosen.length
    ? chosen
        .slice(0, 2)
        .map((i) => `${quantities[i.id]} × ${i.name}`)
        .join(", ") + (chosen.length > 2 ? ` +${chosen.length - 2}` : "")
    : null;

  const categoriesStep: WizardStep = {
    title: t.steps.categories,
    summary: shown.length ? shown.join(" · ") : null,
    changeLabel: t.changeCategories,
    body: (
      <div className="wizard-body">
        <div className="slots occasions" role="group" aria-label={t.steps.categories}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="slot slot-icon"
              aria-pressed={picked.includes(category)}
              onClick={() => setPicked((p) => (p.includes(category) ? p.filter((c) => c !== category) : [...p, category]))}
            >
              <MenuIcon slug={slugOf(category)} size={24} />
              {category}
            </button>
          ))}
        </div>
        <div>
          <button type="button" className="button" disabled={shown.length === 0} onClick={() => go(2)}>
            {t.continueLabel} <ArrowIcon direction="right" />
          </button>
        </div>
      </div>
    ),
  };

  const itemsStep: WizardStep = {
    title: t.steps.items,
    summary: itemsSummary,
    changeLabel: t.changeItems,
    body: (
      <div className="wizard-body">
        {shown.map((category) => (
          <div key={category} className="preorder-group">
            <h4>
              <MenuIcon slug={slugOf(category)} size={22} className="icon-inline" /> {category}
            </h4>
            <ul>
              {items
                .filter((i) => i.category === category)
                .map((item) => {
                  const n = quantities[item.id] ?? 0;
                  const description = menuDescription(item, locale);
                  const bumped = bump?.id === item.id ? bump : null;
                  return (
                    <li key={item.id} data-chosen={n > 0 || undefined}>
                      <div>
                        <strong>{item.name}</strong>
                        {description && <small lang={isUntranslated(item, locale) ? "de" : undefined}>{description}</small>}
                        <span className="preorder-meta">
                          {item.price_label ? `${item.price_label} ${t.per(item.preorder_unit)}` : t.per(item.preorder_unit)}
                          {item.preorder_step > 1 && ` · ${t.inPacks(item.preorder_step)}`}
                        </span>
                      </div>
                      <div className="stepper" role="group" aria-label={t.quantityLabel(item.name, item.preorder_unit)}>
                        <button type="button" onClick={() => change(item, -1)} disabled={n === 0} aria-label={t.less(item.name)}>
                          −
                        </button>
                        {/* The bump alternates between two identically drawn animations (-0, -1): a new
                            animation-name restarts it, and the node stays put so the live region still announces. */}
                        <output aria-live="polite" data-bump={bumped ? `${bumped.dir}-${bumped.n % 2}` : undefined}>
                          {n}
                        </output>
                        <button
                          type="button"
                          onClick={() => change(item, 1)}
                          disabled={n + item.preorder_step > maxQuantity || (n === 0 && chosen.length >= maxLines)}
                          aria-label={t.more(item.name, item.preorder_step)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {chosen.length >= maxLines && <p className="form-note">{t.tooManyLines(maxLines)}</p>}
        <div>
          <button type="button" className="button" disabled={chosen.length === 0} onClick={() => go(3)}>
            {t.continueLabel} <ArrowIcon direction="right" />
          </button>
        </div>
      </div>
    ),
  };

  // Only exists while the basket holds an empanada; the Wizard counts the array, so the dots and
  // "Schritt x von y" follow without anything here knowing a step number.
  const preparationStep: WizardStep = {
    title: t.steps.preparation,
    summary: preparation ? t.preparation[preparation].short : null,
    changeLabel: t.changePreparation,
    body: (
      <div className="wizard-body">
        <div className="slots choices" role="group" aria-label={t.steps.preparation}>
          {PREPARATIONS.map((option) => (
            <button key={option} type="button" className="slot choice" aria-pressed={preparation === option} onClick={() => setPreparation(option)}>
              <strong>{t.preparation[option].title}</strong>
              <small>{t.preparation[option].text}</small>
            </button>
          ))}
        </div>
        <p className="form-note">{t.preparationNote}</p>
        <div>
          <button type="button" className="button" disabled={!preparation} onClick={() => go(step + 1)}>
            {t.continueLabel} <ArrowIcon direction="right" />
          </button>
        </div>
      </div>
    ),
  };

  const dateStep: WizardStep = {
    title: t.steps.date,
    summary: date ? fmtDate(date, locale, { year: undefined }) : null,
    changeLabel: t.changeDate,
    body: (
      <div className="wizard-body">
        <div className="calendar" role="group" aria-label={t.pickupDate}>
          {calendarMonths(minDate, maxDate, monthLong).map((month) => (
            <div className="calendar-month" key={month.key}>
              <p className="calendar-label">{month.label}</p>
              <div className="calendar-heads" aria-hidden="true">
                {r.weekdayHeads.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {month.pad > 0 && <span style={{ gridColumn: `span ${month.pad}` }} />}
                {month.days.map((iso) => {
                  const closed = isClosed(iso);
                  return (
                    <CalendarDay
                      key={iso}
                      iso={iso}
                      today={today}
                      locale={locale}
                      pressed={date === iso}
                      closed={closed}
                      onPick={() => {
                        setDate(iso);
                        setTime("");
                        // A day with times goes straight to choosing one; a day that is too soon
                        // stays here, with the reason below the calendar.
                        if (slotsFor(iso).length > 0) go(step + 1);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {date && slots.length === 0 && (
          <p className="form-note" role="status">
            {t.tooSoonThatDay}
          </p>
        )}
      </div>
    ),
  };

  const timeStep: WizardStep = {
    title: t.steps.time,
    summary: time || null,
    changeLabel: t.changeTime,
    body: (
      <div className="wizard-body">
        {slots.length === 0 ? (
          <p className="form-note" role="status">
            {t.tooSoonThatDay}
          </p>
        ) : (
          <div className="slots times" role="group" aria-label={t.pickupTime}>
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                className="slot"
                aria-pressed={time === s}
                onClick={() => {
                  setTime(s);
                  go(step + 1);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    ),
  };

  const contactStep: WizardStep = {
    title: t.steps.contact,
    body: (
      <form className="wizard-body wizard-contact" action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="pickup_date" value={date} />
        <input type="hidden" name="pickup_time" value={time} />
        {hasEmpanadas && <input type="hidden" name="preparation" value={preparation} />}
        {chosen.map((i) => (
          <input key={i.id} type="hidden" name={`qty-${i.id}`} value={quantities[i.id]} />
        ))}

        <ul className="preorder-summary">
          {chosen.map((i) => (
            <li key={i.id}>
              <MenuIcon slug={i.categorySlug} size={18} className="icon-inline" /> {quantities[i.id]} × {i.name}
            </li>
          ))}
          {hasEmpanadas && preparation && (
            <li>
              <small>{t.steps.preparation}</small>
              {t.preparation[preparation].title}
            </li>
          )}
          {date && (
            <li>
              <small>{t.pickupDate}</small>
              {fmtDate(date, locale, { weekday: "long" })}, {time}
            </li>
          )}
        </ul>

        <div className="form-row">
          <div className="field-float">
            <input id="pre-name" name="name" required minLength={2} maxLength={FIELD_LIMITS.name} autoComplete="name" placeholder="María González" {...contactField("name")} />
            <label htmlFor="pre-name">{t.name}</label>
          </div>
          <div className="field-float">
            <input id="pre-phone" name="phone" type="tel" required minLength={6} maxLength={FIELD_LIMITS.phone} autoComplete="tel" placeholder="+49 170 1234567" {...contactField("phone")} />
            <label htmlFor="pre-phone">{t.phone}</label>
          </div>
        </div>
        <div className="field-float">
          <input id="pre-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" placeholder="maria@example.com" {...contactField("email")} />
          <label htmlFor="pre-email">{t.email}</label>
        </div>
        <div className="field-float">
          <textarea id="pre-notes" name="notes" rows={3} maxLength={FIELD_LIMITS.notes} placeholder={t.wishesPlaceholder} {...contactField("notes")} />
          <label htmlFor="pre-notes">{t.wishes}</label>
        </div>

        {state && !state.ok && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="button" disabled={pending}>
          {pending ? t.submitting : t.submit}
        </button>
        <p className="form-note">{t.note(leadHours)}</p>
      </form>
    ),
  };

  const steps: WizardStep[] = [categoriesStep, itemsStep, ...(hasEmpanadas ? [preparationStep] : []), dateStep, timeStep, contactStep];

  return (
    <Wizard
      step={step}
      setStep={go}
      steps={steps}
      stepLabel={dict.wizard.stepOf}
      footer={<PhoneNote locale={locale} />}
      headingLevel={2}
    />
  );
}
