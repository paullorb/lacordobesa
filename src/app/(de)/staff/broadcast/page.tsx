import { Suspense } from "react";
import { CopyButton } from "@/components/staff/copy-button";
import { StaffLoading } from "@/components/staff/card-bits";
import { requireStaff } from "@/lib/auth";
import { whatsappTo } from "@/lib/contact";
import { getActiveSpecials } from "@/lib/data";
import { fmtDateDE } from "@/lib/dates";
import { SITE_URL, unsubscribeUrl } from "@/lib/site";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Specials verschicken" };

export default function BroadcastPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Broadcast />
    </Suspense>
  );
}

/** The message staff send. Carries the unsubscribe link, because consent has to stay as easy to
 *  withdraw as it was to give. */
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
    supabase.from("broadcast_optins").select("*").is("unsubscribed_at", null).order("created_at"),
    getActiveSpecials(),
  ]);

  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Die Specials-Liste ist erst verfügbar, sobald die Datenbank-Migration 20261012100835 eingespielt ist.
      </p>
    );
  }

  const optins = data ?? [];
  const whatsapp = optins.filter((o) => o.channel === "whatsapp" && o.phone);
  const email = optins.filter((o) => o.channel === "email" && o.email);
  const special = specials[0];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Specials verschicken</h1>
        <p className="text-sm text-muted">
          Gäste, die sich für Specials angemeldet haben. Der WhatsApp-Knopf öffnet den Chat mit einer fertigen
          Nachricht, in der auch der Abmeldelink steht. Du verschickst, nicht wir: automatisch geht noch nichts raus.
        </p>
      </div>

      {!special && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Gerade ist kein Special aktiv. Leg unter „Specials“ eines an, dann steht es in der fertigen Nachricht.
        </p>
      )}

      <section className="card grid gap-3">
        <h2 className="font-semibold">WhatsApp ({whatsapp.length})</h2>
        {whatsapp.length === 0 ? (
          <p className="text-sm text-muted">Noch niemand angemeldet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                label="Alle Nummern kopieren"
                count={whatsapp.length}
                text={whatsapp.map((o) => o.phone).join("\n")}
              />
              {special && (
                <CopyButton label="Nachricht kopieren" count={1} text={messageFor(special, "DEIN-ABMELDELINK")} />
              )}
            </div>
            <ul className="grid gap-1.5">
              {whatsapp.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <strong>{o.name ?? "Ohne Namen"}</strong> <span className="text-muted">{o.phone}</span>
                    <span className="block text-xs text-muted">
                      Angemeldet am {fmtDateDE(o.consented_at.slice(0, 10))}
                    </span>
                  </span>
                  {special && (
                    <a
                      className="btn-ghost !py-1"
                      href={whatsappTo(o.phone!, messageFor(special, unsubscribeUrl(o.unsubscribe_token)))}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Senden ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card grid gap-3">
        <h2 className="font-semibold">E-Mail ({email.length})</h2>
        {email.length === 0 ? (
          <p className="text-sm text-muted">Noch niemand angemeldet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <CopyButton label="Alle Adressen kopieren" count={email.length} text={email.map((o) => o.email).join(", ")} />
            </div>
            <p className="text-xs text-muted">
              Bitte als BCC verschicken, damit die Adressen nicht bei allen anderen sichtbar sind. Der Abmeldelink
              gehört in jede E-Mail.
            </p>
            <ul className="grid gap-1.5">
              {email.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <strong>{o.name ?? "Ohne Namen"}</strong> <span className="text-muted">{o.email}</span>
                  </span>
                  <a
                    className="text-xs underline hover:text-blue-dark"
                    href={unsubscribeUrl(o.unsubscribe_token)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abmeldelink
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
