import { Suspense } from "react";
import { saveInquiryNotes, setInquiryStatus } from "@/app/staff/actions";
import { StaffLoading, StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE } from "@/lib/dates";
import { budgetLabel, occasionLabel } from "@/lib/events";
import { INQUIRY_STATUS_LABEL } from "@/lib/statuses";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Feier-Anfragen" };

export default function InquiriesPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Inquiries />
    </Suspense>
  );
}

async function Inquiries() {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.from("event_inquiries").select("*").order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Feier-Anfragen sind erst verfügbar, sobald die Datenbank-Migration 20261012095610 eingespielt ist.
      </p>
    );
  }

  const all = data ?? [];
  // Won and lost are history; everything else still needs somebody to do something.
  const live = all.filter((i) => i.status === "new" || i.status === "in_progress" || i.status === "quoted");
  const closed = all.filter((i) => i.status === "won" || i.status === "lost");
  const fresh = live.filter((i) => i.status === "new").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Feier-Anfragen</h1>
        <p className="text-sm text-muted">
          Anfragen für Geburtstage, Firmenfeiern und Catering. Die wertvollsten Anfragen der Website, also am besten
          innerhalb von ein, zwei Tagen beantworten.
        </p>
      </div>

      {fresh > 0 && (
        <p className="card border-amber-200 bg-amber-50 text-sm font-semibold">
          {fresh} neue {fresh === 1 ? "Anfrage" : "Anfragen"} warten auf eine Antwort.
        </p>
      )}

      <div className="grid gap-3">
        {live.length > 0 ? (
          live.map((i) => <InquiryCard key={i.id} inquiry={i} />)
        ) : (
          <p className="card text-sm text-muted">Keine offenen Anfragen.</p>
        )}
      </div>

      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Abgeschlossen ({closed.length})</summary>
          <div className="mt-3 grid gap-3">
            {closed.map((i) => (
              <InquiryCard key={i.id} inquiry={i} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function InquiryCard({ inquiry: i }: { inquiry: Tables<"event_inquiries"> }) {
  const greeting = `Hola ${i.name}! Danke für deine Anfrage bei La Cordobesa. Wir schauen uns das gern an, ein paar Fragen dazu:`;

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-serif text-xl">{occasionLabel(i.occasion)}</strong>
            <span className={`status status-${i.status}`}>{INQUIRY_STATUS_LABEL[i.status]}</span>
          </div>
          <div className="text-xs text-muted">
            {i.event_date ? fmtDateDE(i.event_date) : "Datum noch offen"}
            {i.guests ? ` · ca. ${i.guests} Personen` : ""} · Rahmen: {budgetLabel(i.budget_band)}
          </div>
          <div className="mt-1 font-semibold">{i.name}</div>
          <div className="text-sm text-muted">
            <a href={`tel:${i.phone}`} className="hover:text-blue-dark">
              {i.phone}
            </a>
            {i.email && (
              <>
                {" · "}
                <a href={`mailto:${i.email}`} className="hover:text-blue-dark">
                  {i.email}
                </a>
              </>
            )}
          </div>
          <div className="text-xs text-muted">Angefragt am {fmtDateDE(i.created_at.slice(0, 10))}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <WhatsAppButton phone={i.phone} text={greeting} />
          {i.status === "new" && (
            <StatusButton action={setInquiryStatus} id={i.id} status="in_progress" label="Übernehmen" primary />
          )}
          {(i.status === "new" || i.status === "in_progress") && (
            <StatusButton action={setInquiryStatus} id={i.id} status="quoted" label="Angebot raus" />
          )}
          {i.status !== "won" && (
            <StatusButton action={setInquiryStatus} id={i.id} status="won" label="Gewonnen" primary />
          )}
          {i.status !== "lost" && (
            <StatusButton action={setInquiryStatus} id={i.id} status="lost" label="Verloren" danger />
          )}
        </div>
      </div>

      {i.message && <p className="rounded bg-cream px-3 py-2 text-sm whitespace-pre-line">„{i.message}“</p>}

      <StaffNotesForm
        action={saveInquiryNotes}
        id={i.id}
        value={i.staff_notes}
        placeholder="Interne Notiz (Angebot, Rückruf …)"
      />
    </article>
  );
}
