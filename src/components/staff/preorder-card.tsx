import { savePreorderNotes, setPreorderStatus } from "@/app/staff/actions";

import { MenuIcon } from "@/components/icons";
import { StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { fmtTime } from "@/lib/data";
import { fmtDate, fmtDateDE } from "@/lib/dates";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { preorderUrl } from "@/lib/site";
import { isPreparation, PREPARATION_STAFF_LABEL } from "@/lib/preorder-preparation";
import { type PreorderWithLines } from "@/lib/preorders";
import { PREORDER_STATUS_LABEL } from "@/lib/statuses";

export function PreorderCard({ order: o }: { order: PreorderWithLines }) {
  const lines = [...o.preorder_lines].sort((a, b) => a.label.localeCompare(b.label, "de"));
  // The guest's own language, for the link and the WhatsApp text they get back.
  const locale = isLocale(o.locale) ? o.locale : DEFAULT_LOCALE;
  const guestLink = preorderUrl(o.manage_token, locale);
  // Null on orders placed before the choice existed, on orders without empanadas and on those staff typed in.
  const preparation = isPreparation(o.preparation) ? o.preparation : null;
  const preparationText = {
    de: { fresh: "Empanadas: frisch gebacken zum Mitnehmen", frozen: "Empanadas: vorgebacken zum Einfrieren" },
    en: { fresh: "Empanadas: freshly baked to take away", frozen: "Empanadas: par-baked, to keep in your freezer" },
    es: { fresh: "Empanadas: recién horneadas para llevar", frozen: "Empanadas: pre-horneadas para congelar" },
  }[locale];
  const confirmText = (
    locale === "en"
      ? [
          `¡Hola ${o.name}! Your order at La Cordobesa is confirmed:`,
          ...lines.map((l) => `• ${l.quantity} × ${l.label}`),
          ...(preparation ? [preparationText[preparation]] : []),
          "",
          `Pickup on ${fmtDate(o.pickup_date, "en", { weekday: undefined })} at ${fmtTime(o.pickup_time)}. You pay on collection.`,
          "",
          `Check the status any time here: ${guestLink}`,
          "",
          "¡Hasta pronto!",
        ]
      : locale === "es"
      ? [
          `¡Hola ${o.name}! Tu pedido en La Cordobesa está confirmado:`,
          ...lines.map((l) => `• ${l.quantity} × ${l.label}`),
          ...(preparation ? [preparationText[preparation]] : []),
          "",
          `Retiro el ${fmtDate(o.pickup_date, "es", { weekday: undefined })} a las ${fmtTime(o.pickup_time)}. Se paga al retirar.`,
          "",
          `El estado, en todo momento acá: ${guestLink}`,
          "",
          "¡Hasta pronto!",
        ]
      : [
          `Hola ${o.name}! Deine Vorbestellung bei La Cordobesa ist bestätigt:`,
          ...lines.map((l) => `• ${l.quantity} × ${l.label}`),
          ...(preparation ? [preparationText[preparation]] : []),
          "",
          `Abholung am ${fmtDateDE(o.pickup_date, { weekday: undefined })} um ${fmtTime(o.pickup_time)} Uhr. Bezahlt wird bei der Abholung.`,
          "",
          `Status jederzeit hier: ${guestLink}`,
          "",
          "¡Hasta pronto!",
        ]
  ).join("\n");

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <strong className="font-serif text-xl">{fmtTime(o.pickup_time)}</strong>
            <span className={`status status-${o.status}`}>{PREORDER_STATUS_LABEL[o.status]}</span>
            {preparation && (
              <span className={`status ${preparation === "frozen" ? "bg-sky-100 text-sky-800" : "bg-amber-50 text-amber-800"}`} title="Zubereitung der Empanadas">
                {PREPARATION_STAFF_LABEL[preparation]}
              </span>
            )}
            {o.source === "staff" && <span className="status bg-gray-100 text-gray-600">Telefon/Vor Ort</span>}
            {locale !== DEFAULT_LOCALE && (
              <span
                className="status bg-amber-50 text-amber-800"
                title={`Auf ${locale === "es" ? "Spanisch" : "Englisch"} bestellt: der Link ist ${locale === "es" ? "spanisch" : "englisch"}`}
              >
                {locale.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-xs text-muted">{fmtDateDE(o.pickup_date)}</div>
          <div className="mt-1 font-semibold">{o.name}</div>
          <div className="text-sm text-muted">
            <a href={`tel:${o.phone}`} className="hover:text-blue-dark">
              {o.phone}
            </a>
            {o.email && (
              <>
                {" · "}
                <a href={`mailto:${o.email}`} className="hover:text-blue-dark">
                  {o.email}
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <WhatsAppButton phone={o.phone} text={confirmText} />
          {o.status === "pending" && (
            <StatusButton action={setPreorderStatus} id={o.id} status="confirmed" label="Bestätigen" primary />
          )}
          {o.status === "confirmed" && (
            <StatusButton action={setPreorderStatus} id={o.id} status="ready" label="Bereit" primary />
          )}
          {o.status === "ready" && (
            <StatusButton action={setPreorderStatus} id={o.id} status="collected" label="Abgeholt" />
          )}
          {(o.status === "pending" || o.status === "confirmed" || o.status === "ready") && (
            <StatusButton action={setPreorderStatus} id={o.id} status="cancelled" label="Stornieren" danger />
          )}
          {(o.status === "cancelled" || o.status === "collected") && (
            <StatusButton action={setPreorderStatus} id={o.id} status="confirmed" label="Wieder öffnen" />
          )}
        </div>
      </div>

      <ul className="grid gap-1 rounded bg-cream px-3 py-2 text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <MenuIcon slug={l.menu_items?.menu_categories?.slug ?? ""} size={16} className="shrink-0 text-blue-dark" />
              <strong>{l.quantity} ×</strong> {l.label} <span className="text-xs text-muted">pro {l.unit_label}</span>
            </span>
            {l.price_label && <span className="whitespace-nowrap text-xs text-muted">{l.price_label}</span>}
          </li>
        ))}
      </ul>
      {o.notes && <p className="rounded bg-mint px-3 py-2 text-sm">„{o.notes}“</p>}

      <StaffNotesForm
        action={savePreorderNotes}
        id={o.id}
        value={o.staff_notes}
        placeholder="Interne Notiz (Backplan, Hinweise …)"
      />
    </article>
  );
}
