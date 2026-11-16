import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteSpecial, deleteSpecialIdea, saveSpecial, saveSpecialIdea } from "@/app/staff/actions";
import { BroadcastSection } from "@/components/staff/broadcast-section";
import { ActionForm, ConfirmSubmit, QuickForm, SubmitButton } from "@/components/staff/form-bits";
import { DateField } from "@/components/staff/pickers";
import { requireStaff } from "@/lib/auth";
import { fmtStaffDate, todayISO } from "@/lib/dates";
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
  const { data: ideaRows } = await supabase.from("special_ideas").select("*").order("sort_order").order("created_at");
  const ideas = ideaRows ?? [];
  const isLive = (s: Tables<"specials">) => s.is_active && s.starts_on <= today && (!s.ends_on || s.ends_on >= today);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Especiales y ofertas del día</h1>
        <p className="text-sm text-muted">Los especiales activos aparecen arriba del menú en la página de inicio.</p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Nuevo especial</h2>
        <SpecialForm today={today} />
      </section>

      <section className="grid gap-3">
        {specials.map((s) => (
          <details key={s.id} className={`card ${isLive(s) ? "border-coral" : ""}`}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{s.title}</strong>
                {isLive(s) && <span className="status ml-2 bg-orange-100 text-orange-800">Publicado</span>}
                {!s.is_active && <span className="status ml-2 bg-gray-200 text-gray-600">Inactivo</span>}
              </span>
              <span className="text-xs text-muted">
                {fmtStaffDate(s.starts_on)}
                {s.ends_on ? ` hasta ${fmtStaffDate(s.ends_on)}` : ", sin fecha de fin"}
              </span>
            </summary>
            <div className="mt-4 grid gap-4">
              <SpecialForm today={today} special={s} />
              <QuickForm action={deleteSpecial} className="justify-self-start">
                <input type="hidden" name="id" value={s.id} />
                <ConfirmSubmit message={`¿Eliminar «${s.title}»?`}>Eliminar</ConfirmSubmit>
              </QuickForm>
            </div>
          </details>
        ))}
        {specials.length === 0 && <p className="text-sm text-muted">Todavía no hay especiales.</p>}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="font-serif text-2xl">Ideas para la lista de especiales</h2>
          <p className="text-sm text-muted">
            Las tarjetas «qué podríamos ofrecer» encima del formulario de inscripción. No son promesas ni tienen fecha. El alemán es el texto base; español e inglés son opcionales.
          </p>
        </div>
        <div className="card">
          <h3 className="mb-3 font-semibold">Nueva idea</h3>
          <IdeaForm nextOrder={(ideas.at(-1)?.sort_order ?? 0) + 10} />
        </div>
        {ideas.map((i) => (
          <details key={i.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{i.title}</strong>
                {!i.is_active && <span className="status ml-2 bg-gray-200 text-gray-600">Oculta</span>}
              </span>
              <span className="text-xs text-muted">Orden {i.sort_order}</span>
            </summary>
            <div className="mt-4 grid gap-4">
              <IdeaForm idea={i} />
              <QuickForm action={deleteSpecialIdea} className="justify-self-start">
                <input type="hidden" name="id" value={i.id} />
                <ConfirmSubmit message={`¿Eliminar «${i.title}»?`}>Eliminar</ConfirmSubmit>
              </QuickForm>
            </div>
          </details>
        ))}
        {ideas.length === 0 && <p className="text-sm text-muted">Todavía no hay ideas.</p>}
      </section>

      <Suspense fallback={<StaffLoading />}>
        <BroadcastSection />
      </Suspense>
    </div>
  );
}

function IdeaForm({ idea, nextOrder }: { idea?: Tables<"special_ideas">; nextOrder?: number }) {
  const id = idea?.id ?? "new-idea";
  return (
    <ActionForm action={saveSpecialIdea} className="grid gap-3 sm:grid-cols-2" successText={idea ? "Guardado." : "Idea creada."}>
      {idea && <input type="hidden" name="id" value={idea.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-title`}>Título (alemán)</label>
        <input id={`${id}-title`} name="title" defaultValue={idea?.title} required maxLength={120} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-desc`}>Descripción (alemán)</label>
        <textarea id={`${id}-desc`} name="description" rows={2} maxLength={600} defaultValue={idea?.description ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-title-es`}>Título (español)</label>
        <input id={`${id}-title-es`} name="title_es" defaultValue={idea?.title_es ?? ""} maxLength={120} />
      </div>
      <div>
        <label htmlFor={`${id}-title-en`}>Título (inglés)</label>
        <input id={`${id}-title-en`} name="title_en" defaultValue={idea?.title_en ?? ""} maxLength={120} />
      </div>
      <div>
        <label htmlFor={`${id}-desc-es`}>Descripción (español)</label>
        <textarea id={`${id}-desc-es`} name="description_es" rows={2} maxLength={600} defaultValue={idea?.description_es ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-desc-en`}>Descripción (inglés)</label>
        <textarea id={`${id}-desc-en`} name="description_en" rows={2} maxLength={600} defaultValue={idea?.description_en ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-order`}>Orden (menor = primero)</label>
        <input id={`${id}-order`} name="sort_order" type="number" step={1} defaultValue={idea?.sort_order ?? nextOrder ?? 0} />
      </div>
      <label className="!mb-0 flex items-center gap-2 self-end text-sm normal-case tracking-normal">
        <input type="checkbox" name="is_active" defaultChecked={idea?.is_active ?? true} /> Visible en el sitio
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{idea ? "Guardar" : "Crear"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function SpecialForm({ today, special }: { today: string; special?: Tables<"specials"> }) {
  const id = special?.id ?? "new";
  return (
    <ActionForm action={saveSpecial} className="grid gap-3 sm:grid-cols-2">
      {special && <input type="hidden" name="id" value={special.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-title`}>Título</label>
        <input id={`${id}-title`} name="title" defaultValue={special?.title} required placeholder="Empanada de la semana: Carne picante" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-desc`}>Descripción</label>
        <textarea id={`${id}-desc`} name="description" rows={2} defaultValue={special?.description ?? ""} />
      </div>
      <div>
        <label htmlFor={`${id}-start`}>Desde</label>
        <DateField id={`${id}-start`} name="starts_on" defaultValue={special?.starts_on ?? today} required />
      </div>
      <div>
        <label htmlFor={`${id}-end`}>Hasta (vacío = sin fecha de fin)</label>
        <DateField id={`${id}-end`} name="ends_on" defaultValue={special?.ends_on ?? ""} />
      </div>
      <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
        <input type="checkbox" name="is_active" defaultChecked={special?.is_active ?? true} /> Activo
      </label>
      <div className="sm:col-span-2">
        <SubmitButton>{special ? "Guardar" : "Crear"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
