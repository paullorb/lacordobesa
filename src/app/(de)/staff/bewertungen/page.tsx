import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { saveReviewScores } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { requireAdmin } from "@/lib/auth";
import { fmtStaffDate } from "@/lib/dates";
import { REVIEW_SCORES_KEY, resolveReviews } from "@/lib/reviews";

export const metadata = { title: "Reseñas" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("site_settings").select("value").eq("key", REVIEW_SCORES_KEY).maybeSingle();
  const platforms = resolveReviews(data?.value ?? null);

  return (
    <div className="grid gap-6">
      <h1 className="font-serif text-3xl">Reseñas</h1>
      <p className="max-w-2xl text-sm text-muted">
        En la página de inicio aparecen los sitios de reseñas con su logo y un enlace a nuestro perfil. Ingresá acá
        los números tal como aparecen en cada sitio. Si dejás la calificación vacía, solo se mostrará el logo y el enlace.
        La fecha se actualiza cuando cambiás los números o marcás que los revisaste hoy.
      </p>
      <ActionForm action={saveReviewScores} className="grid gap-6">
        {platforms.map((p) => (
          <section key={p.id} className="card grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{p.name}</h2>
              <a href={p.url} target="_blank" rel="noreferrer" className="text-sm text-blue-dark underline">
                Abrir perfil
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor={`${p.id}_value`}>Calificación (p. ej., 4,6)</label>
                <input id={`${p.id}_value`} name={`${p.id}_value`} inputMode="decimal" defaultValue={p.score?.value ?? ""} />
              </div>
              <div>
                <label htmlFor={`${p.id}_scale`}>de (escala)</label>
                <input id={`${p.id}_scale`} name={`${p.id}_scale`} inputMode="decimal" defaultValue={p.score?.scale ?? p.scale} />
              </div>
              <div>
                <label htmlFor={`${p.id}_count`}>Cantidad de reseñas</label>
                <input id={`${p.id}_count`} name={`${p.id}_count`} type="number" min={1} defaultValue={p.score?.count ?? ""} />
              </div>
            </div>
            {p.score && (
              <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
                <input type="checkbox" name={`${p.id}_recheck`} /> Revisado hoy{" "}
                {p.score.checked && <span className="text-muted">(Última revisión: {fmtStaffDate(p.score.checked)})</span>}
              </label>
            )}
          </section>
        ))}
        <div>
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
