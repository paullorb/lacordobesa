import { Suspense } from "react";
import { saveInquiryNotes, setInquiryStatus } from "@/app/staff/actions";
import { MoreActions, StaffLoadError, StaffLoading, StaffNotesForm, StatusButton, WhatsAppButton } from "@/components/staff/card-bits";
import { requireStaff } from "@/lib/auth";
import { fmtStaffDate } from "@/lib/dates";
import { INQUIRY_STATUS_LABEL } from "@/lib/statuses";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Consultas para eventos" };

const OCCASIONS: Record<string, string> = {
  geburtstag: "Cumpleaños", firmenfeier: "Evento de empresa", taufe: "Bautismo o comunión",
  hochzeit: "Boda", catering: "Catering para retirar o entregar", andere: "Otro evento",
};
const BUDGETS: Record<string, string> = {
  unsicher: "Aún sin definir", "bis-500": "hasta 500 €", "500-1000": "500 a 1.000 €",
  "1000-2500": "1.000 a 2.500 €", "ueber-2500": "más de 2.500 €",
};

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
    console.error("staff/anfragen", error);
    return <StaffLoadError />;
  }

  const all = data ?? [];
  // Won and lost are history; everything else still needs somebody to do something.
  const live = all.filter((i) => i.status === "new" || i.status === "in_progress" || i.status === "quoted");
  const closed = all.filter((i) => i.status === "won" || i.status === "lost");
  const fresh = live.filter((i) => i.status === "new").length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Consultas para eventos</h1>
        <p className="text-sm text-muted">Consultas para celebraciones y catering. Conviene responder en uno o dos días.</p>
      </div>

      {fresh > 0 && (
        <p className="card border-amber-200 bg-amber-50 text-sm font-semibold">
          {fresh} {fresh === 1 ? "consulta nueva espera" : "consultas nuevas esperan"} una respuesta.
        </p>
      )}

      <div className="grid gap-3">
        {live.length > 0 ? (
          live.map((i) => <InquiryCard key={i.id} inquiry={i} />)
        ) : (
          <p className="card text-sm text-muted">No hay consultas pendientes.</p>
        )}
      </div>

      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Cerradas ({closed.length})</summary>
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
  const isLive = i.status === "new" || i.status === "in_progress" || i.status === "quoted";
  const greeting = `Hola ${i.name}! Danke für deine Anfrage bei La Cordobesa. Wir schauen uns das gern an, ein paar Fragen dazu:`;

  return (
    <article className="card grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-serif text-xl">{OCCASIONS[i.occasion] ?? i.occasion}</strong>
            <span className={`status status-${i.status}`}>{INQUIRY_STATUS_LABEL[i.status]}</span>
          </div>
          <div className="text-xs text-muted">
            {i.event_date ? fmtStaffDate(i.event_date) : "Fecha por definir"}
            {i.guests ? ` · aprox. ${i.guests} personas` : ""} · Presupuesto: {BUDGETS[i.budget_band] ?? i.budget_band}
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
          <div className="text-xs text-muted">Consulta recibida el {fmtStaffDate(i.created_at.slice(0, 10))}</div>
        </div>
        <div className="flex flex-wrap items-start gap-1.5">
          {isLive && <WhatsAppButton phone={i.phone} text={greeting} />}
          {/* "quoted" (Angebot raus) is no longer set from here; rows already in it are live and finish like any other. */}
          {i.status === "new" && (
            <StatusButton action={setInquiryStatus} id={i.id} status="in_progress" label="Tomar consulta" primary />
          )}
          {isLive && i.status !== "new" && (
            <StatusButton action={setInquiryStatus} id={i.id} status="won" label="Aceptada" primary />
          )}
          {isLive && <StatusButton action={setInquiryStatus} id={i.id} status="lost" label="No concretada" danger />}
          {!isLive && (
            <MoreActions>
              <StatusButton action={setInquiryStatus} id={i.id} status="in_progress" label="Reabrir" />
            </MoreActions>
          )}
        </div>
      </div>

      {i.message && <p className="rounded bg-cream px-3 py-2 text-sm whitespace-pre-line">„{i.message}“</p>}

      <StaffNotesForm
        action={saveInquiryNotes}
        id={i.id}
        value={i.staff_notes}
        placeholder="Nota interna (presupuesto, llamada …)"
      />
    </article>
  );
}
