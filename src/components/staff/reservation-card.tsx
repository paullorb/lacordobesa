import { resendConfirmation, setReservationStatus, saveStaffNotes } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { MoreActions, StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { CopyButton } from "@/components/staff/copy-button";
import { StartGate } from "@/components/staff/start-gate";
import { fmtTime } from "@/lib/data";
import { fmtDate, fmtStaffDate, hasStarted } from "@/lib/dates";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { manageUrl } from "@/lib/site";
import { RESERVATION_STATUS_LABEL } from "@/lib/statuses";
import type { Tables } from "@/lib/database.types";

export function ReservationCard({ r, showDate = false }: { r: Tables<"reservations">; showDate?: boolean }) {
  // The guest's own language, for the link and the WhatsApp text they get back.
  const locale = isLocale(r.locale) ? r.locale : DEFAULT_LOCALE;
  const guestLink = manageUrl(r.manage_token, locale);
  const confirmText = (
    locale === "en"
      ? [
          `¡Hola ${r.name}! Your reservation at La Cordobesa on ${fmtDate(r.date, "en", { weekday: undefined })} at ${fmtTime(r.start_time)} for ${r.party_size} ${r.party_size === 1 ? "person" : "people"} is confirmed. ¡Hasta pronto!`,
          `If you need to cancel or change the time: ${guestLink}`,
        ]
      : locale === "es"
      ? [
          `¡Hola ${r.name}! Tu reserva en La Cordobesa el ${fmtDate(r.date, "es", { weekday: undefined })} a las ${fmtTime(r.start_time)} para ${r.party_size} ${r.party_size === 1 ? "persona" : "personas"} está confirmada. ¡Hasta pronto!`,
          `Si necesitás cancelar o cambiar el horario: ${guestLink}`,
        ]
      : [
          `Hola ${r.name}! Deine Reservierung bei La Cordobesa am ${fmtDate(r.date, "de", { weekday: undefined })} um ${fmtTime(r.start_time)} Uhr für ${r.party_size} Personen ist bestätigt. ¡Hasta pronto!`,
          `Falls du absagen oder verschieben musst: ${guestLink}`,
        ]
  ).join("\n\n");
  const isLive = r.status === "pending" || r.status === "confirmed";
  // A confirmed booking is cancelled until its start and marked how it went from then on.
  const started = r.status === "confirmed" && hasStarted(r.date, r.start_time);

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <strong className="font-serif text-xl">{fmtTime(r.start_time)}</strong>
            <span className="text-sm">
              {r.party_size} {r.party_size === 1 ? "persona" : "personas"}
            </span>
            <span className={`status status-${r.status}`}>{RESERVATION_STATUS_LABEL[r.status]}</span>
            {r.source === "staff" && <span className="status bg-gray-100 text-gray-600">Teléfono / local</span>}
            {locale !== DEFAULT_LOCALE && (
              <span
                className="status bg-amber-50 text-amber-800"
                title={`Reserva en ${locale === "es" ? "español" : "inglés"}: el correo y el enlace están en ${locale === "es" ? "español" : "inglés"}`}
              >
                {locale.toUpperCase()}
              </span>
            )}
          </div>
          {showDate && <div className="text-xs text-muted">{fmtStaffDate(r.date)}</div>}
          <div className="mt-1 font-semibold">{r.name}</div>
          <div className="text-sm text-muted">
            {/* A staff-entered booking can have no number at all, which is stored as an empty
                string; a dead tel: link would be worse than saying so. */}
            {r.phone ? (
              <a href={`tel:${r.phone}`} className="hover:text-blue-dark">
                {r.phone}
              </a>
            ) : (
              "sin número"
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
        <div className="flex flex-wrap items-start gap-1.5">
          {isLive && r.status !== "confirmed" && <WhatsAppButton phone={r.phone} text={confirmText} />}
          {r.status === "pending" && (
            <StatusButton action={setReservationStatus} id={r.id} status="confirmed" label="Confirmar" primary />
          )}
          {r.status === "confirmed" && (
            <StartGate
              date={r.date}
              initiallyStarted={started}
              time={r.start_time}
              before={
                <>
                  <WhatsAppButton phone={r.phone} text={confirmText} />
                  <StatusButton action={setReservationStatus} id={r.id} status="cancelled" label="Cancelar" danger />
                </>
              }
              after={
                <>
                  <StatusButton action={setReservationStatus} id={r.id} status="completed" label="Completada" primary />
                  <StatusButton action={setReservationStatus} id={r.id} status="no_show" label="No se presentó" />
                </>
              }
            />
          )}
          {isLive && r.status !== "confirmed" && (
            <StatusButton action={setReservationStatus} id={r.id} status="cancelled" label="Cancelar" danger />
          )}
          {!isLive && (
            <MoreActions>
              <StatusButton action={setReservationStatus} id={r.id} status="confirmed" label="Reabrir" />
            </MoreActions>
          )}
        </div>
      </div>
      {r.status === "confirmed" && !started && <MailState r={r} />}
      {isLive && !started && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-bold">Enlace para el cliente</span>
          <CopyButton text={guestLink} label="Copiar enlace" />
          <a
            href={guestLink}
            className="inline-flex min-h-10 items-center underline hover:text-blue-dark"
            target="_blank"
            rel="noreferrer"
          >
            Abrir
          </a>
        </div>
      )}
      <StaffNotesForm
        action={saveStaffNotes}
        id={r.id}
        value={r.staff_notes}
        placeholder="Nota interna (mesa, indicaciones …)"
      />
    </article>
  );
}

/** Whether the guest has been told by mail, and a retry when they have not. */
function MailState({ r }: { r: Tables<"reservations"> }) {
  if (!r.email) {
    return <p className="text-xs text-muted">No hay correo electrónico. Confirmá por teléfono o WhatsApp.</p>;
  }
  if (r.confirmation_sent_at) {
    return (
      <p className="text-xs text-emerald-700">
        Confirmación enviada por correo el {fmtStaffDate(r.confirmation_sent_at.slice(0, 10))}.
      </p>
    );
  }
  return (
    <ActionForm action={resendConfirmation} className="flex flex-wrap items-center gap-2" successText="Correo enviado.">
      <input type="hidden" name="id" value={r.id} />
      <span className="text-xs text-amber-700">Todavía no se envió el correo de confirmación.</span>
      <SubmitButton className="btn-ghost !py-1" pendingText="Enviando …">
        Enviar correo
      </SubmitButton>
    </ActionForm>
  );
}
