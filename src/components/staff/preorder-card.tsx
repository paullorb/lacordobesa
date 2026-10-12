import { savePreorderNotes, setPreorderStatus } from "@/app/staff/actions";
import type { PreorderWithLines } from "@/app/staff/vorbestellungen/page";
import { whatsappHref } from "@/lib/contact";
import { fmtTime } from "@/lib/data";
import { fmtDateDE } from "@/lib/dates";
import { PREORDER_STATUS_LABEL } from "@/lib/preorders";
import { SITE_URL } from "@/lib/site";
import type { Enums } from "@/lib/database.types";

export function PreorderCard({ order: o }: { order: PreorderWithLines }) {
  const lines = [...o.preorder_lines].sort((a, b) => a.label.localeCompare(b.label, "de"));
  const guestLink = `${SITE_URL}/vorbestellung/${o.manage_token}`;
  const confirmText = [
    `Hola ${o.name}! Deine Vorbestellung bei La Cordobesa ist bestätigt:`,
    ...lines.map((l) => `• ${l.quantity} × ${l.label}`),
    "",
    `Abholung am ${fmtDateDE(o.pickup_date, { weekday: undefined })} um ${fmtTime(o.pickup_time)} Uhr. Bezahlt wird bei der Abholung.`,
    "",
    `Status jederzeit hier: ${guestLink}`,
    "",
    "¡Hasta pronto!",
  ].join("\n");

  const phoneDigits = o.phone.replace(/[^\d+]/g, "");
  const waNumber = phoneDigits.startsWith("+")
    ? phoneDigits.slice(1)
    : phoneDigits.startsWith("0")
      ? `49${phoneDigits.slice(1)}`
      : phoneDigits;

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <strong className="font-serif text-xl">{fmtTime(o.pickup_time)}</strong>
            <span className={`status status-${o.status}`}>{PREORDER_STATUS_LABEL[o.status]}</span>
            {o.source === "staff" && <span className="status bg-gray-100 text-gray-600">Telefon/Vor Ort</span>}
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
          {waNumber.length >= 8 && (
            <a
              className="btn-ghost"
              href={whatsappHref(confirmText).replace(/wa\.me\/\d+/, `wa.me/${waNumber}`)}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp ↗
            </a>
          )}
          {o.status === "pending" && <StatusButton id={o.id} status="confirmed" label="Bestätigen" primary />}
          {o.status === "confirmed" && <StatusButton id={o.id} status="ready" label="Bereit" primary />}
          {o.status === "ready" && <StatusButton id={o.id} status="collected" label="Abgeholt" />}
          {(o.status === "pending" || o.status === "confirmed" || o.status === "ready") && (
            <StatusButton id={o.id} status="cancelled" label="Stornieren" danger />
          )}
          {(o.status === "cancelled" || o.status === "collected") && (
            <StatusButton id={o.id} status="confirmed" label="Wieder öffnen" />
          )}
        </div>
      </div>

      <ul className="grid gap-1 rounded bg-cream px-3 py-2 text-sm">
        {lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-3">
            <span>
              <strong>{l.quantity} ×</strong> {l.label} <span className="text-xs text-muted">pro {l.unit_label}</span>
            </span>
            {l.price_label && <span className="whitespace-nowrap text-xs text-muted">{l.price_label}</span>}
          </li>
        ))}
      </ul>
      {o.notes && <p className="rounded bg-mint px-3 py-2 text-sm">„{o.notes}“</p>}

      <form action={savePreorderNotes} className="flex gap-2">
        <input type="hidden" name="id" value={o.id} />
        <input name="staff_notes" defaultValue={o.staff_notes ?? ""} placeholder="Interne Notiz (Backplan, Hinweise …)" />
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
  status: Enums<"preorder_status">;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={setPreorderStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={primary ? "btn-primary" : danger ? "btn-danger" : "btn-ghost"}>{label}</button>
    </form>
  );
}
