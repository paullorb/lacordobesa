import { Suspense } from "react";
import { saveWaitlistNotes, setWaitlistStatus } from "@/app/staff/actions";
import { StaffLoading, StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE, todayISO } from "@/lib/dates";
import { WAITLIST_STATUS_LABEL } from "@/lib/statuses";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Warteliste" };

export default function WaitlistPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Waitlist />
    </Suspense>
  );
}

async function Waitlist() {
  const { supabase } = await requireStaff();
  const today = todayISO();
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("*")
    .gte("date", today)
    .order("date")
    .order("created_at");

  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Die Warteliste ist erst verfügbar, sobald die Datenbank-Migration 20261012100456 eingespielt ist.
      </p>
    );
  }

  const entries = data ?? [];
  // Grouped by day, because that is the question being asked: a table just came free on Saturday,
  // who wanted Saturday? Within a day the order is first come, first asked.
  const days = [...new Set(entries.map((e) => e.date))];
  const waitingCount = entries.filter((e) => e.status === "waiting").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Warteliste</h1>
        <p className="text-sm text-muted">
          Gäste, die an einem ausgebuchten Tag trotzdem kommen wollten, pro Tag und in der Reihenfolge der Anmeldung.
          Wird ein Tisch frei, zum Beispiel durch eine Stornierung, ruf hier von oben nach unten durch.
        </p>
      </div>

      {waitingCount > 0 && (
        <p className="card border-amber-200 bg-amber-50 text-sm font-semibold">
          {waitingCount} {waitingCount === 1 ? "Gast wartet" : "Gäste warten"} auf einen Tisch.
        </p>
      )}

      {days.length === 0 && <p className="card text-sm text-muted">Niemand steht auf der Warteliste.</p>}

      {days.map((date) => (
        <section key={date} className="grid gap-2">
          <h2 className="border-b border-line pb-1 font-serif text-xl">{fmtDateDE(date, { weekday: "long" })}</h2>
          {entries
            .filter((e) => e.date === date)
            .map((entry, index) => (
              <Entry key={entry.id} entry={entry} position={index + 1} />
            ))}
        </section>
      ))}
    </div>
  );
}

function Entry({ entry: e, position }: { entry: Tables<"waitlist_entries">; position: number }) {
  const offer = `Hola ${e.name}! Bei La Cordobesa ist für ${fmtDateDE(e.date, { weekday: undefined })} ein Tisch für ${e.party_size} ${
    e.party_size === 1 ? "Person" : "Personen"
  } frei geworden. Passt das noch bei dir?`;

  return (
    <article className={`card grid gap-3 ${e.status === "waiting" ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-serif text-xl tabular-nums">{position}.</strong>
            <span className="font-semibold">{e.name}</span>
            <span className="text-sm">
              {e.party_size} {e.party_size === 1 ? "Person" : "Pers."}
            </span>
            <span className={`status status-${e.status}`}>{WAITLIST_STATUS_LABEL[e.status]}</span>
          </div>
          {e.time_preference && <div className="text-sm text-muted">Wunsch: {e.time_preference}</div>}
          <div className="text-sm text-muted">
            <a href={`tel:${e.phone}`} className="hover:text-blue-dark">
              {e.phone}
            </a>
            {e.email && (
              <>
                {" · "}
                <a href={`mailto:${e.email}`} className="hover:text-blue-dark">
                  {e.email}
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <WhatsAppButton phone={e.phone} text={offer} label="Tisch anbieten" />
          {e.status === "waiting" && (
            <StatusButton action={setWaitlistStatus} id={e.id} status="notified" label="Angerufen" />
          )}
          {e.status !== "converted" && (
            <StatusButton action={setWaitlistStatus} id={e.id} status="converted" label="Hat einen Tisch" primary />
          )}
          {e.status !== "cancelled" && (
            <StatusButton action={setWaitlistStatus} id={e.id} status="cancelled" label="Abgesagt" danger />
          )}
        </div>
      </div>
      <StaffNotesForm action={saveWaitlistNotes} id={e.id} value={e.staff_notes} placeholder="Interne Notiz" />
    </article>
  );
}
