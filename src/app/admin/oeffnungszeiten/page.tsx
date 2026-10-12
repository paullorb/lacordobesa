import { Suspense } from "react";
import { addClosure, deleteClosure, saveOpeningHours } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { requireStaff } from "@/lib/auth";
import { fmtTime, WEEKDAYS_DE } from "@/lib/data";
import { fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Öffnungszeiten" };

export default function HoursPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Hours />
    </Suspense>
  );
}

async function Hours() {
  const { supabase } = await requireStaff();
  const today = todayISO();
  const [{ data: hours }, { data: closures }] = await Promise.all([
    supabase.from("opening_hours").select("*"),
    supabase.from("closures").select("*").gte("date", today).order("date"),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Öffnungszeiten</h1>
        <p className="text-sm text-muted">Gilt für die Website und für die buchbaren Reservierungszeiten.</p>
      </div>

      <section className="card">
        <ActionForm action={saveOpeningHours} className="grid gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const h = hours?.find((x) => x.weekday === wd);
            return (
              <div key={wd} className="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-3 border-b border-line py-2 last:border-0">
                <span className="text-sm font-semibold">{WEEKDAYS_DE[wd]}</span>
                <input type="time" name={`opens_${wd}`} defaultValue={fmtTime(h?.opens ?? null)} aria-label={`${WEEKDAYS_DE[wd]} öffnet`} />
                <input type="time" name={`closes_${wd}`} defaultValue={fmtTime(h?.closes ?? null)} aria-label={`${WEEKDAYS_DE[wd]} schließt`} />
                <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
                  <input type="checkbox" name={`closed_${wd}`} defaultChecked={h?.is_closed ?? false} /> Ruhetag
                </label>
              </div>
            );
          })}
          <div className="mt-2">
            <SubmitButton>Öffnungszeiten speichern</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Geschlossene Tage</h2>
        <p className="mb-4 text-sm text-muted">Feiertage, Urlaub, Betriebsferien. An diesen Tagen sind keine Reservierungen möglich.</p>
        <ul className="mb-4 grid gap-2">
          {closures?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-md bg-cream px-3 py-2 text-sm">
              <span>
                <strong>{fmtDateDE(c.date)}</strong>
                {c.reason && <span className="ml-2 text-muted">{c.reason}</span>}
              </span>
              <form action={deleteClosure}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn-ghost">Entfernen</button>
              </form>
            </li>
          ))}
          {(!closures || closures.length === 0) && <li className="text-sm text-muted">Keine anstehenden Schließtage.</li>}
        </ul>
        <ActionForm action={addClosure} className="grid gap-3 sm:grid-cols-[auto_1fr_auto]" successText="Eingetragen.">
          <div>
            <label htmlFor="cl-date">Datum</label>
            <input id="cl-date" name="date" type="date" min={today} required />
          </div>
          <div>
            <label htmlFor="cl-reason">Grund (optional)</label>
            <input id="cl-reason" name="reason" placeholder="Urlaub" />
          </div>
          <div className="self-end">
            <SubmitButton>Hinzufügen</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
