import { setReservationStatus, saveStaffNotes } from "@/app/staff/actions";
import { whatsappHref } from "@/lib/contact";
import { fmtTime } from "@/lib/data";
import { fmtDateDE } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

const LABEL: Record<Tables<"reservations">["status"], string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  no_show: "Nicht erschienen",
  completed: "Erledigt",
};

export function ReservationCard({ r, showDate = false }: { r: Tables<"reservations">; showDate?: boolean }) {
  const confirmText = `Hola ${r.name}! Deine Reservierung bei La Cordobesa am ${fmtDateDE(r.date, { weekday: undefined })} um ${fmtTime(r.start_time)} Uhr für ${r.party_size} Personen ist bestätigt. ¡Hasta pronto!`;
  const phoneDigits = r.phone.replace(/[^\d+]/g, "");
  const waNumber = phoneDigits.startsWith("+") ? phoneDigits.slice(1) : phoneDigits.startsWith("0") ? `49${phoneDigits.slice(1)}` : phoneDigits;

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <strong className="font-serif text-xl">{fmtTime(r.start_time)}</strong>
            <span className="text-sm">
              {r.party_size} {r.party_size === 1 ? "Person" : "Pers."}
            </span>
            <span className={`status status-${r.status}`}>{LABEL[r.status]}</span>
            {r.source === "staff" && <span className="status bg-gray-100 text-gray-600">Telefon/Vor Ort</span>}
          </div>
          {showDate && <div className="text-xs text-muted">{fmtDateDE(r.date)}</div>}
          <div className="mt-1 font-semibold">{r.name}</div>
          <div className="text-sm text-muted">
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
          {waNumber.length >= 8 && (
            <a className="btn-ghost" href={whatsappHref(confirmText).replace(/wa\.me\/\d+/, `wa.me/${waNumber}`)} target="_blank" rel="noreferrer">
              WhatsApp ↗
            </a>
          )}
          {r.status === "pending" && <StatusButton id={r.id} status="confirmed" label="Bestätigen" primary />}
          {r.status === "confirmed" && <StatusButton id={r.id} status="completed" label="Erledigt" />}
          {r.status === "confirmed" && <StatusButton id={r.id} status="no_show" label="Nicht erschienen" />}
          {(r.status === "pending" || r.status === "confirmed") && (
            <StatusButton id={r.id} status="cancelled" label="Stornieren" danger />
          )}
          {(r.status === "cancelled" || r.status === "no_show" || r.status === "completed") && (
            <StatusButton id={r.id} status="confirmed" label="Wieder öffnen" />
          )}
        </div>
      </div>
      <form action={saveStaffNotes} className="flex gap-2">
        <input type="hidden" name="id" value={r.id} />
        <input name="staff_notes" defaultValue={r.staff_notes ?? ""} placeholder="Interne Notiz (Tisch, Hinweise …)" />
        <button className="btn-ghost shrink-0">OK</button>
      </form>
    </article>
  );
}

function StatusButton({
  id,
  status,
  label,
  primary,
  danger,
}: {
  id: string;
  status: Tables<"reservations">["status"];
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={setReservationStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={primary ? "btn-primary" : danger ? "btn-danger" : "btn-ghost"}>{label}</button>
    </form>
  );
}
