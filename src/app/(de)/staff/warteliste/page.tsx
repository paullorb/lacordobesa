import { Suspense } from "react";
import { saveWaitlistNotes, setWaitlistStatus } from "@/app/staff/actions";
import { Disclosure, MoreActions, StaffLoadError, StaffLoading, StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
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
    console.error("staff/warteliste", error);
    return <StaffLoadError />;
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
        <p className="text-sm text-muted">Gäste, die an einem ausgebuchten Tag trotzdem kommen wollten.</p>
        <Disclosure summary="So funktioniert's">
          <p className="text-sm text-muted">
            Die Liste ist pro Tag und nach der Reihenfolge der Anmeldung sortiert. Wird ein Tisch frei, zum Beispiel
            durch eine Stornierung, biete ihn von oben nach unten an.
          </p>
        </Disclosure>
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
  const isLive = e.status === "waiting" || e.status === "notified";
  const offer = `Hola ${e.name}! Bei La Cordobesa ist für ${fmtDateDE(e.date, { weekday: undefined })} ein Tisch für ${e.party_size} ${
    e.party_size === 1 ? "Person" : "Personen"
  } frei geworden. Passt das noch bei dir?`;

  return (
    <article className={`card grid gap-3 ${isLive ? "" : "opacity-60"}`}>
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
        <div className="flex flex-wrap items-start gap-1.5">
          {/* "notified" (Angerufen) is no longer set from here; rows already in it still count as live. */}
          {isLive && <WhatsAppButton phone={e.phone} text={offer} label="Tisch anbieten" />}
          {isLive && (
            <StatusButton action={setWaitlistStatus} id={e.id} status="converted" label="Hat einen Tisch" primary />
          )}
          {isLive && <StatusButton action={setWaitlistStatus} id={e.id} status="cancelled" label="Abgesagt" danger />}
          {!isLive && (
            <MoreActions>
              <StatusButton action={setWaitlistStatus} id={e.id} status="waiting" label="Wieder öffnen" />
            </MoreActions>
          )}
        </div>
      </div>
      <StaffNotesForm action={saveWaitlistNotes} id={e.id} value={e.staff_notes} placeholder="Interne Notiz" />
    </article>
  );
}
