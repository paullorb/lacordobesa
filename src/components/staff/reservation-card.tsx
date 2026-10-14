import { resendConfirmation, setReservationStatus, saveStaffNotes } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { fmtTime } from "@/lib/data";
import { fmtDate, fmtDateDE } from "@/lib/dates";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { manageUrl } from "@/lib/site";
import { RESERVATION_STATUS_LABEL } from "@/lib/statuses";
import type { Tables } from "@/lib/database.types";

export function ReservationCard({ r, showDate = false }: { r: Tables<"reservations">; showDate?: boolean }) {
  // The guest's own language, for the link and the WhatsApp text they get back.
  const locale = isLocale(r.locale) ? r.locale : DEFAULT_LOCALE;
  // manage_token arrives with migration 20261012093558; before that there is no guest link to share.
  const guestLink = r.manage_token ? manageUrl(r.manage_token, locale) : null;
  const confirmText = (
    locale === "es"
      ? [
          `¡Hola ${r.name}! Tu reserva en La Cordobesa el ${fmtDate(r.date, "es", { weekday: undefined })} a las ${fmtTime(r.start_time)} para ${r.party_size} ${r.party_size === 1 ? "persona" : "personas"} está confirmada. ¡Hasta pronto!`,
          guestLink && `Si necesitás cancelar o cambiar el horario: ${guestLink}`,
        ]
      : [
          `Hola ${r.name}! Deine Reservierung bei La Cordobesa am ${fmtDateDE(r.date, { weekday: undefined })} um ${fmtTime(r.start_time)} Uhr für ${r.party_size} Personen ist bestätigt. ¡Hasta pronto!`,
          guestLink && `Falls du absagen oder verschieben musst: ${guestLink}`,
        ]
  )
    .filter(Boolean)
    .join("\n\n");

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <strong className="font-serif text-xl">{fmtTime(r.start_time)}</strong>
            <span className="text-sm">
              {r.party_size} {r.party_size === 1 ? "Person" : "Pers."}
            </span>
            <span className={`status status-${r.status}`}>{RESERVATION_STATUS_LABEL[r.status]}</span>
            {r.source === "staff" && <span className="status bg-gray-100 text-gray-600">Telefon/Vor Ort</span>}
            {locale === "es" && (
              <span className="status bg-amber-50 text-amber-800" title="Auf Spanisch gebucht: E-Mail und Link sind spanisch">
                ES
              </span>
            )}
          </div>
          {showDate && <div className="text-xs text-muted">{fmtDateDE(r.date)}</div>}
          <div className="mt-1 font-semibold">{r.name}</div>
          <div className="text-sm text-muted">
            {/* A staff-entered booking can have no number at all, which is stored as an empty
                string; a dead tel: link would be worse than saying so. */}
            {r.phone ? (
              <a href={`tel:${r.phone}`} className="hover:text-blue-dark">
                {r.phone}
              </a>
            ) : (
              "keine Nummer"
            )}
            {r.email && (
              <>
                {" · "}
                <a href={`mailto:${r.email}`} className="hover:text-blue-dark">
                  {r.email}
                </a>
              </>
            )}
          </div>
          {r.notes && <p className="mt-2 rounded bg-cream px-3 py-2 text-sm">„{r.notes}“</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <WhatsAppButton phone={r.phone} text={confirmText} />
          {r.status === "pending" && (
            <StatusButton action={setReservationStatus} id={r.id} status="confirmed" label="Bestätigen" primary />
          )}
          {r.status === "confirmed" && (
            <StatusButton action={setReservationStatus} id={r.id} status="completed" label="Erledigt" />
          )}
          {r.status === "confirmed" && (
            <StatusButton action={setReservationStatus} id={r.id} status="no_show" label="Nicht erschienen" />
          )}
          {(r.status === "pending" || r.status === "confirmed") && (
            <StatusButton action={setReservationStatus} id={r.id} status="cancelled" label="Stornieren" danger />
          )}
          {(r.status === "cancelled" || r.status === "no_show" || r.status === "completed") && (
            <StatusButton action={setReservationStatus} id={r.id} status="confirmed" label="Wieder öffnen" />
          )}
        </div>
      </div>
      {r.status === "confirmed" && <MailState r={r} />}
      {guestLink && (r.status === "pending" || r.status === "confirmed") && (
        <p className="text-xs text-muted">
          Gäste-Link zum Absagen/Verschieben:{" "}
          <a href={guestLink} className="break-all underline hover:text-blue-dark" target="_blank" rel="noreferrer">
            {guestLink}
          </a>
        </p>
      )}
      <StaffNotesForm
        action={saveStaffNotes}
        id={r.id}
        value={r.staff_notes}
        placeholder="Interne Notiz (Tisch, Hinweise …)"
      />
    </article>
  );
}

/** Whether the guest has been told by mail, and a retry when they have not. */
function MailState({ r }: { r: Tables<"reservations"> }) {
  if (!r.email) {
    return <p className="text-xs text-muted">Keine E-Mail hinterlegt, bitte per Telefon oder WhatsApp bestätigen.</p>;
  }
  // confirmation_sent_at arrives with migration 20261012094449; without it there is nothing to report.
  if (!("confirmation_sent_at" in r)) return null;
  if (r.confirmation_sent_at) {
    return (
      <p className="text-xs text-emerald-700">
        Bestätigung per E-Mail verschickt am {fmtDateDE(r.confirmation_sent_at.slice(0, 10))}.
      </p>
    );
  }
  return (
    <ActionForm action={resendConfirmation} className="flex flex-wrap items-center gap-2" successText="E-Mail verschickt.">
      <input type="hidden" name="id" value={r.id} />
      <span className="text-xs text-amber-700">Bestätigungs-E-Mail noch nicht verschickt.</span>
      <SubmitButton className="btn-ghost !py-1" pendingText="Wird gesendet …">
        E-Mail senden
      </SubmitButton>
    </ActionForm>
  );
}
