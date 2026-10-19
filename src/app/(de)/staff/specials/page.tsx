import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteSpecial, saveSpecial } from "@/app/staff/actions";
import { BroadcastSection } from "@/components/staff/broadcast-section";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { DateField } from "@/components/staff/pickers";
import { requireStaff } from "@/lib/auth";
import { fmtDateDE, todayISO } from "@/lib/dates";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Specials" };

export default function SpecialsPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Specials />
    </Suspense>
  );
}

async function Specials() {
  const { supabase } = await requireStaff();
  const today = todayISO();
  const { data } = await supabase.from("specials").select("*").order("starts_on", { ascending: false }).limit(50);
  const specials = data ?? [];
  const isLive = (s: Tables<"specials">) => s.is_active && s.starts_on <= today && (!s.ends_on || s.ends_on >= today);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Specials & Tagesangebote</h1>
        <p className="text-sm text-muted">Aktive Specials stehen oben in der Karte auf der Startseite.</p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Neues Special</h2>
        <SpecialForm today={today} />
      </section>

      <section className="grid gap-3">
        {specials.map((s) => (
          <details key={s.id} className={`card ${isLive(s) ? "border-coral" : ""}`}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{s.title}</strong>
                {isLive(s) && <span className="status ml-2 bg-orange-100 text-orange-800">Live</span>}
                {!s.is_active && <span className="status ml-2 bg-gray-200 text-gray-600">Inaktiv</span>}
              </span>
              <span className="text-xs text-muted">
                {fmtDateDE(s.starts_on)}
                {s.ends_on ? ` bis ${fmtDateDE(s.ends_on)}` : ", ohne Enddatum"}
              </span>
            </summary>
            <div className="mt-4 grid gap-4">
              <SpecialForm today={today} special={s} />
              <form action={deleteSpecial} className="justify-self-start">
                <input type="hidden" name="id" value={s.id} />
                <ConfirmSubmit message={`„${s.title}“ löschen?`}>Löschen</ConfirmSubmit>
              </form>
            </div>
          </details>
        ))}
        {specials.length === 0 && <p className="text-sm text-muted">Noch keine Specials.</p>}
      </section>

      <Suspense fallback={<StaffLoading />}>
        <BroadcastSection />
      </Suspense>
    </div>
  );
}

function SpecialForm({ today, special }: { today: string; special?: Tables<"specials"> }) {
  const id = special?.id ?? "new";
  return (
    <ActionForm action={saveSpecial} className="grid gap-3 sm:grid-cols-2">
      {special && <input type="hidden" name="id" value={special.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-title`}>Titel</label>
        <input id={`${id}-title`} name="title" defaultValue={special?.title} required placeholder="Empanada de la semana: Carne picante" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-desc`}>Beschreibung</label>
        <textarea id={`${id}-desc`} name="description" rows={2} defaultValue={special?.description ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-start`}>Von</label>
        <DateField id={`${id}-start`} name="starts_on" defaultValue={special?.starts_on ?? today} required />
      </div>
      <div>
        <label htmlFor={`${id}-end`}>Bis (leer = bis auf Weiteres)</label>
        <DateField id={`${id}-end`} name="ends_on" defaultValue={special?.ends_on ?? ""} />
      </div>
      <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
        <input type="checkbox" name="is_active" defaultChecked={special?.is_active ?? true} /> Aktiv
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{special ? "Speichern" : "Anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
