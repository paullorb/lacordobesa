import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { confirmBroadcastOptin } from "@/app/staff/actions";
import { requireStaff } from "@/lib/auth";
import { whatsappTo } from "@/lib/contact";
import { getActiveSpecials } from "@/lib/data";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";
import { SITE_URL, unsubscribeUrl as unsubscribeLink } from "@/lib/site";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Specials verschicken" };

/** A sign-up whose WhatsApp never arrived is not going to; after this long it stops being listed. */
const PENDING_DAYS = 30;

export default function BroadcastPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Broadcast />
    </Suspense>
  );
}

const unsubscribeUrl = (o: Tables<"broadcast_optins">) => unsubscribeLink(o.unsubscribe_token);

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

async function Broadcast() {
  const { supabase } = await requireStaff();
  const [{ data, error }, specials] = await Promise.all([
    supabase
      .from("broadcast_optins")
      .select("*")
      .eq("channel", "whatsapp")
      .is("unsubscribed_at", null)
      .order("created_at"),
    getActiveSpecials(),
  ]);

  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Die Specials-Liste ist erst verfügbar, sobald die Datenbank-Migration 20261012215041 eingespielt ist.
      </p>
    );
  }

  const pendingSince = addDays(todayISO(), -PENDING_DAYS);
  const optins = (data ?? []).filter((o) => o.phone);
  const confirmed = optins.filter((o) => o.confirmed_at);
  const pending = optins.filter((o) => !o.confirmed_at && o.created_at.slice(0, 10) >= pendingSince);
  const special = specials[0];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Specials verschicken</h1>
        <p className="text-sm text-muted">
          Gäste, die Specials per WhatsApp bekommen möchten. Der Knopf „Senden“ öffnet den Chat mit einer fertigen
          Nachricht, in der der persönliche Abmeldelink dieses Gastes steht. Du verschickst, nicht wir: automatisch geht
          nichts raus.
        </p>
      </div>

      <section className="card grid gap-3">
        <h2 className="font-semibold">Warten auf Bestätigung ({pending.length})</h2>
        <p className="text-sm text-muted">
          Nach der Anmeldung schickt der Gast uns eine WhatsApp. Bestätige erst, wenn sie <strong>von genau dieser
          Nummer</strong> angekommen ist: Nur so wissen wir, dass sich niemand mit einer fremden Nummer angemeldet hat.
          Ohne Bestätigung bekommt die Nummer nichts.
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Gerade wartet niemand.</p>
        ) : (
          <ul className="grid gap-1.5">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{o.name ?? "Ohne Namen"}</strong> <span className="text-muted">{o.phone}</span>
                  <span className="block text-xs text-muted">Angemeldet am {fmtDateDE(o.created_at.slice(0, 10))}</span>
                </span>
                <form action={confirmBroadcastOptin}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-ghost !py-1">Nachricht ist da, bestätigen</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!special && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Gerade ist kein Special aktiv. Leg unter „Specials“ eines an, dann steht es in der fertigen Nachricht.
        </p>
      )}

      <section className="card grid gap-3">
        <h2 className="font-semibold">Bestätigt ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted">Noch niemand bestätigt.</p>
        ) : (
          <ul className="grid gap-1.5">
            {confirmed.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{o.name ?? "Ohne Namen"}</strong> <span className="text-muted">{o.phone}</span>
                  <span className="block text-xs text-muted">
                    Bestätigt am {fmtDateDE(o.confirmed_at!.slice(0, 10))}
                  </span>
                </span>
                {special && (
                  <a
                    className="btn-ghost !py-1"
                    href={whatsappTo(o.phone!, messageFor(special, unsubscribeUrl(o)))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Senden ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
