import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteSpecial, deleteSpecialIdea, saveSpecial, saveSpecialIdea } from "@/app/staff/actions";
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
  const { data: ideaRows } = await supabase
    .from("special_ideas")
    .select("*")
    .order("sort_order")
    .order("created_at");
  const ideas = ideaRows ?? [];
  const activeIdeas = ideas.filter((i) => i.is_active).length;
  const isLive = (s: Tables<"specials">) => s.is_active && s.starts_on <= today && (!s.ends_on || s.ends_on >= today);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Specials & Tagesangebote</h1>
        <p className="text-sm text-muted">Aktive Specials im Zeitraum erscheinen oben in der Karte auf der Startseite.</p>
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

      <div className="mt-4">
        <h2 className="font-serif text-2xl">Ideen für Specials (Vorschau)</h2>
        <p className="text-sm text-muted">
          Diese Karten erscheinen auf der Startseite über der Frage, ob Gäste über Specials informiert werden möchten.
          Es sind Ideen, was es geben könnte, keine Zusagen. Sind alle inaktiv (oder gibt es keine), wird die Vorschau
          ausgeblendet und nur die Frage bleibt.
          {ideas.length > 0 && ` Zurzeit aktiv: ${activeIdeas} von ${ideas.length}.`} Die Reihenfolge folgt der Zahl bei „Position“
          (kleinste zuerst). Spanisch und Englisch sind optional; ohne Übersetzung wird der deutsche Text gezeigt.
        </p>
      </div>

      <section className="card">
        <h3 className="mb-3 font-semibold">Neue Idee</h3>
        <IdeaForm nextOrder={(ideas.at(-1)?.sort_order ?? 0) + 10} />
      </section>

      <section className="grid gap-3">
        {ideas.map((i) => (
          <details key={i.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{i.title}</strong>
                {!i.is_active && <span className="status ml-2 bg-gray-200 text-gray-600">Inaktiv</span>}
              </span>
              <span className="text-xs text-muted">Position {i.sort_order}</span>
            </summary>
            <div className="mt-4 grid gap-4">
              <IdeaForm idea={i} />
              <form action={deleteSpecialIdea} className="justify-self-start">
                <input type="hidden" name="id" value={i.id} />
                <ConfirmSubmit message={`„${i.title}“ löschen?`}>Löschen</ConfirmSubmit>
              </form>
            </div>
          </details>
        ))}
        {ideas.length === 0 && <p className="text-sm text-muted">Noch keine Ideen. Ohne Ideen zeigt die Startseite nur die Frage.</p>}
      </section>
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

function IdeaForm({ idea, nextOrder = 0 }: { idea?: Tables<"special_ideas">; nextOrder?: number }) {
  const id = idea ? `idea-${idea.id}` : "idea-new";
  return (
    <ActionForm action={saveSpecialIdea} className="grid gap-3 sm:grid-cols-2">
      {idea && <input type="hidden" name="id" value={idea.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-title`}>Titel</label>
        <input id={`${id}-title`} name="title" defaultValue={idea?.title} required placeholder="Pastelitos de membrillo" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-desc`}>Beschreibung</label>
        <textarea id={`${id}-desc`} name="description" rows={2} defaultValue={idea?.description ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-title-es`}>Titel auf Spanisch (optional)</label>
        <input id={`${id}-title-es`} name="title_es" defaultValue={idea?.title_es ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-title-en`}>Titel auf Englisch (optional)</label>
        <input id={`${id}-title-en`} name="title_en" defaultValue={idea?.title_en ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-desc-es`}>Beschreibung auf Spanisch (optional)</label>
        <textarea id={`${id}-desc-es`} name="description_es" rows={2} defaultValue={idea?.description_es ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-desc-en`}>Beschreibung auf Englisch (optional)</label>
        <textarea id={`${id}-desc-en`} name="description_en" rows={2} defaultValue={idea?.description_en ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-order`}>Position (kleinste zuerst)</label>
        <input id={`${id}-order`} name="sort_order" type="number" step={1} defaultValue={idea?.sort_order ?? nextOrder} />
      </div>
      <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
        <input type="checkbox" name="is_active" defaultChecked={idea?.is_active ?? true} /> Aktiv (auf der Startseite zeigen)
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{idea ? "Speichern" : "Anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
