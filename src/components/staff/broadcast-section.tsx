import { ArrowIcon } from "@/components/icons";
import { confirmBroadcastOptin } from "@/app/staff/actions";
import { requireStaff } from "@/lib/auth";
import { whatsappTo } from "@/lib/contact";
import { getActiveSpecials } from "@/lib/data";
import { addDays, fmtStaffDate, todayISO } from "@/lib/dates";
import { SITE_URL, unsubscribeUrl } from "@/lib/site";
import type { Tables } from "@/lib/database.types";

/** A sign-up whose WhatsApp never arrived is not going to; after this long it stops being listed.
 *  Signing up again renews consented_at (subscribe_broadcast), which brings the row back. */
const PENDING_DAYS = 30;

/** The message staff send. Each one carries that guest's own unsubscribe link, because consent has
 *  to stay as easy to withdraw as it was to give. That is also why there is no "copy all numbers"
 *  any more: a WhatsApp broadcast list sends one identical text, so nobody would get their link. */
function messageFor(special: Tables<"specials">, unsubscribe: string) {
  return [
    `¡Hola! Bei La Cordobesa gibt es etwas Besonderes: ${special.title}.`,
    special.description,
    "",
    `Tisch reservieren oder vorbestellen: ${SITE_URL}`,
    "",
    `Keine Specials mehr? Hier abmelden: ${unsubscribe}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function emailFor(address: string, special: Tables<"specials">, unsubscribe: string) {
  const subject = `La Cordobesa Specials: ${special.title}`;
  const recipient = encodeURIComponent(address).replace("%40", "@");
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageFor(special, unsubscribe))}`;
}

/** Staff prepare one message per confirmed WhatsApp or email guest so each gets their own
 *  unsubscribe link. Lives on the Specials page, where the text being sent is written. */
export async function BroadcastSection() {
  const { supabase } = await requireStaff();
  const [{ data, error }, specials] = await Promise.all([
    supabase
      .from("broadcast_optins")
      .select("*")
      .is("unsubscribed_at", null)
      .order("created_at"),
    getActiveSpecials(),
  ]);

  if (error) {
    return (
      <section id="verschicken" className="grid scroll-mt-4 gap-3">
        <h2 className="font-serif text-2xl">Enviar a clientes</h2>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
          No pudimos cargar la lista. Actualizá la página.
        </p>
      </section>
    );
  }

  const pendingSince = addDays(todayISO(), -PENDING_DAYS);
  const optins = (data ?? []).filter((o) => o.phone || o.email);
  const confirmed = optins.filter((o) => o.channel === "whatsapp" && o.confirmed_at);
  const pending = optins.filter((o) => o.channel === "whatsapp" && !o.confirmed_at && o.consented_at.slice(0, 10) >= pendingSince);
  const confirmedEmails = optins.filter((o) => o.channel === "email" && o.confirmed_at && o.email);
  const special = specials[0];

  return (
    <section id="verschicken" className="grid scroll-mt-4 gap-6">
      <div>
        <h2 className="font-serif text-2xl">Enviar a clientes</h2>
        <p className="text-sm text-muted">
          Clientes que quieren recibir especiales por WhatsApp. «Enviar» abre el chat con un mensaje preparado y el
          enlace personal para darse de baja. Vos enviás el mensaje; nada se envía automáticamente.
        </p>
      </div>

      <div className="card grid gap-3">
        <h3 className="font-semibold">Pendientes de confirmación ({pending.length})</h3>
        <p className="text-sm text-muted">
          Después de anotarse, el cliente nos envía un WhatsApp. Confirmá solo si el mensaje llegó <strong>desde ese
          mismo número</strong>. Así sabemos que nadie anotó un número ajeno. Sin confirmación no se envía nada.
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No hay nadie pendiente.</p>
        ) : (
          <ul className="grid gap-1.5">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{o.name ?? "Sin nombre"}</strong> <span className="text-muted">{o.phone}</span>
                  <span className="block text-xs text-muted">Se anotó el {fmtStaffDate(o.consented_at.slice(0, 10))}</span>
                </span>
                <form action={confirmBroadcastOptin}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-ghost !py-1">Mensaje recibido: confirmar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card grid gap-3">
        <h3 className="font-semibold">Correos confirmados ({confirmedEmails.length})</h3>
        <p className="text-sm text-muted">
          Enviá cada correo por separado. El mensaje preparado incluye el enlace personal para darse de baja.
        </p>
        {confirmedEmails.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay correos confirmados.</p>
        ) : (
          <ul className="grid gap-1.5">
            {confirmedEmails.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                <span className="min-w-0 flex-1"><strong>{o.name ?? "Sin nombre"}</strong> <span className="text-muted">{o.email}</span></span>
                {special && (
                  <a className="btn-ghost !py-1" href={emailFor(o.email!, special, unsubscribeUrl(o.unsubscribe_token))}>
                    Preparar correo <ArrowIcon direction="up-right" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!special && (confirmed.length > 0 || confirmedEmails.length > 0) && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No hay especiales activos. Creá uno arriba para incluirlo en el mensaje.
        </p>
      )}

      <div className="card grid gap-3">
        <h3 className="font-semibold">Confirmados ({confirmed.length})</h3>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay nadie confirmado.</p>
        ) : (
          <ul className="grid gap-1.5">
            {confirmed.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{o.name ?? "Sin nombre"}</strong> <span className="text-muted">{o.phone}</span>
                  <span className="block text-xs text-muted">
                    Confirmado el {fmtStaffDate(o.confirmed_at!.slice(0, 10))}
                  </span>
                </span>
                {special && (
                  <a
                    className="btn-ghost !py-1"
                    href={whatsappTo(o.phone!, messageFor(special, unsubscribeUrl(o.unsubscribe_token)))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Enviar <ArrowIcon direction="up-right" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
