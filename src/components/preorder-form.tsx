"use client";

import { useActionState, useState } from "react";
import { useTrackForm } from "@/components/analytics";
import { requestPreorder } from "@/app/vorbestellen/actions";
import type { PreorderableItem } from "@/lib/preorders";
import { fmtDate } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
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

const berlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The first pickup the lead time allows, as a Frankfurt date and a time rounded up to the
 *  15-minute step. The same rule request_preorder() enforces with too_soon. */
function leadBoundary(leadHours: number) {
  const parts = Object.fromEntries(berlin.formatToParts(new Date(Date.now() + leadHours * 3_600_000)).map((p) => [p.type, p.value]));
  const minute = Math.ceil((Number(parts.hour) * 60 + Number(parts.minute)) / 15) * 15;
  const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time };
}

export function PreorderForm({
  locale,
  items,
  windows,
  closedDates,
  minDate,
  maxDate,
  maxQuantity,
  maxLines,
  leadHours,
}: Props) {
  const [state, formAction, pending] = useActionState(requestPreorder, null);
  useTrackForm("preorder", state, pending);
  const t = getDictionary(locale).preorderForm;
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [date, setDate] = useState("");

  const chosen = items.filter((i) => (quantities[i.id] ?? 0) > 0);
  // The weekday of an ISO date, read in UTC so the shop's timezone cannot shift it by a day.
  const weekday = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : null;
  const pickupWindow = weekday === null ? null : windows[weekday];
  const closed = date ? closedDates.includes(date) || !pickupWindow : false;
  // On the first possible day the lead time, not the opening hour, sets the earliest pickup. Read
  // only once a date is picked, so the clock never runs during the server render. Times compare
  // as "HH:MM" strings.
  const boundary = date && pickupWindow ? leadBoundary(leadHours) : null;
  const earliest =
    boundary && date === boundary.date && boundary.time > pickupWindow!.opens ? boundary.time : pickupWindow?.opens;
  const tooLate = Boolean(boundary && pickupWindow && (date < boundary.date || earliest! > pickupWindow.closes));

  const categories = [...new Set(items.map((i) => i.category))];

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

  return (
    <form action={formAction} className="form preorder-form">
      <input type="hidden" name="locale" value={locale} />
      <fieldset className="preorder-items">
        <legend className="manage-label">{t.legend}</legend>
        {categories.map((category) => (
          <div key={category} className="preorder-group">
            <h3>{category}</h3>
            <ul>
              {items
                .filter((i) => i.category === category)
                .map((item) => (
                  <li key={item.id}>
                    <label htmlFor={`qty-${item.id}`}>
                      <strong>{item.name}</strong>
                      {menuDescription(item, locale) && (
                        <small lang={isUntranslated(item, locale) ? "de" : undefined}>{menuDescription(item, locale)}</small>
                      )}
                      <span className="preorder-meta">
                        {t.per(item.preorder_unit)}
                        {item.price_label ? ` · ${item.price_label}` : ""}
                      </span>
                    </label>
                    <input
                      id={`qty-${item.id}`}
                      name={`qty-${item.id}`}
                      type="number"
                      min={0}
                      max={maxQuantity}
                      step={1}
                      inputMode="numeric"
                      placeholder="0"
                      value={quantities[item.id] || ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setQuantities((q) => ({ ...q, [item.id]: Number.isFinite(n) ? n : 0 }));
                      }}
                      aria-label={t.quantityLabel(item.name, item.preorder_unit)}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </fieldset>

      {chosen.length > maxLines && (
        <p className="form-error" role="alert">
          {t.tooManyLines(maxLines)}
        </p>
      )}

      <div className="preorder-when">
        <div>
          <label htmlFor="pickup_date">{t.pickupDate}</label>
          <input
            id="pickup_date"
            name="pickup_date"
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="pickup_time">{t.pickupTime}</label>
          <input
            id="pickup_time"
            name="pickup_time"
            type="time"
            min={earliest}
            max={pickupWindow?.closes}
            step={900}
            disabled={!date || closed || tooLate}
            required
          />
        </div>
      </div>
      {date &&
        (closed ? (
          <p className="form-note">{t.closedThatDay}</p>
        ) : tooLate ? (
          <p className="form-note">{t.tooSoonThatDay}</p>
        ) : (
          <p className="form-note">
            {t.openThatDay(fmtDate(date, locale), pickupWindow?.opens ?? "", pickupWindow?.closes ?? "")}
            {earliest !== pickupWindow?.opens && ` ${t.earliestThatDay(earliest ?? "")}`}
          </p>
        ))}

      <div>
        <label htmlFor="pre-name">{t.name}</label>
        <input id="pre-name" name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="pre-phone">{t.phone}</label>
        <input id="pre-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} autoComplete="tel" required />
      </div>
      <div>
        <label htmlFor="pre-email">{t.email}</label>
        <input id="pre-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" />
      </div>
      <div>
        <label htmlFor="pre-notes">{t.wishes}</label>
        <textarea
          id="pre-notes"
          name="notes"
          rows={3}
          maxLength={FIELD_LIMITS.notes}
          placeholder={t.wishesPlaceholder}
        />
      </div>

      {state && !state.ok && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button" disabled={pending || chosen.length === 0 || chosen.length > maxLines || closed}>
        {pending ? t.submitting : t.submit}
      </button>
      <p className="form-note">{t.note(leadHours)}</p>
    </form>
  );
}
