import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { addClosure, deleteClosureRange, saveOpeningHours } from "@/app/staff/actions";
import { ActionForm, SubmitButton } from "@/components/staff/form-bits";
import { MonthCalendar } from "@/components/staff/month-calendar";
import { loadCalendarMonth, monthParam } from "@/lib/staff-calendar";
import { requireStaff } from "@/lib/auth";
import { fmtTime, WEEKDAYS_DE } from "@/lib/data";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Öffnungszeiten" };

export default function HoursPage(props: PageProps<"/staff/oeffnungszeiten">) {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Hours searchParams={props.searchParams} />
    </Suspense>
  );
}

/** Collapses consecutive closure days with the same reason into ranges for display. */
function groupClosures(rows: { date: string; reason: string | null }[]) {
  const out: { from: string; to: string; reason: string | null }[] = [];
  for (const r of rows) {
    const last = out.at(-1);
    if (last && last.reason === r.reason && addDays(last.to, 1) === r.date) last.to = r.date;
    else out.push({ from: r.date, to: r.date, reason: r.reason });
  }
  return out;
}

async function Hours({ searchParams }: Pick<PageProps<"/staff/oeffnungszeiten">, "searchParams">) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();
  const month = monthParam(sp, today);
  const [{ data: hours }, { data: closures }, cal] = await Promise.all([
    supabase.from("opening_hours").select("*"),
    supabase.from("closures").select("date, reason").gte("date", today).order("date"),
    loadCalendarMonth(supabase, month),
  ]);
  const ranges = groupClosures(closures ?? []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Öffnungszeiten</h1>
        <p className="text-sm text-muted">Gilt für die Website und für die buchbaren Reservierungszeiten.</p>
      </div>

      <MonthCalendar
        month={month}
        today={today}
        days={cal.days}
        weeklyClosed={cal.weeklyClosed}
        hrefForDay={(d) => `/staff/reservierungen?date=${d}`}
        hrefForMonth={(m) => `/staff/oeffnungszeiten?monat=${m}`}
      />

      <section className="card">
        <h2 className="mb-3 font-semibold">Reguläre Zeiten</h2>
        <ActionForm action={saveOpeningHours} className="grid gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const h = hours?.find((x) => x.weekday === wd);
            return (
              // Four columns only once there is room for them. A `time` input will not render
              // narrower than its own content, so the one-line version needs ~440px and spilled
              // off the right of a phone; below `sm` the day name and the Ruhetag box take a row
              // of their own and the two times share the next one.
              <div
                key={wd}
                className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-line py-2 last:border-0 sm:grid-cols-[6rem_1fr_1fr_auto] sm:gap-y-0"
              >
                <span className="text-sm font-semibold">{WEEKDAYS_DE[wd]}</span>
                <label className="!mb-0 flex items-center justify-end gap-2 text-sm normal-case tracking-normal sm:order-last sm:justify-start">
                  <input type="checkbox" name={`closed_${wd}`} defaultChecked={h?.is_closed ?? false} /> Ruhetag
                </label>
                <input
                  type="time"
                  name={`opens_${wd}`}
                  defaultValue={fmtTime(h?.opens ?? null)}
                  aria-label={`${WEEKDAYS_DE[wd]} öffnet`}
                  className="min-w-0"
                />
                <input
                  type="time"
                  name={`closes_${wd}`}
                  defaultValue={fmtTime(h?.closes ?? null)}
                  aria-label={`${WEEKDAYS_DE[wd]} schließt`}
                  className="min-w-0"
                />
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
        <p className="mb-4 text-sm text-muted">
          Feiertage, Urlaub, Betriebsferien: ein einzelner Tag oder ein Zeitraum. An diesen Tagen sind keine Reservierungen möglich.
        </p>
        <ul className="mb-4 grid gap-2">
          {ranges.map((r) => (
            <li key={r.from} className="flex items-center justify-between gap-3 rounded-md bg-cream px-3 py-2 text-sm">
              <span>
                <strong>
                  {fmtDateDE(r.from)}
                  {r.to !== r.from && ` bis ${fmtDateDE(r.to)}`}
                </strong>
                {r.reason && <span className="ml-2 text-muted">{r.reason}</span>}
              </span>
              <form action={deleteClosureRange}>
                <input type="hidden" name="from" value={r.from} />
                <input type="hidden" name="to" value={r.to} />
                <button className="btn-ghost">Entfernen</button>
              </form>
            </li>
          ))}
          {ranges.length === 0 && <li className="text-sm text-muted">Keine anstehenden Schließtage.</li>}
        </ul>
        <ActionForm action={addClosure} className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]" successText="Eingetragen.">
          <div>
            <label htmlFor="cl-from">Von</label>
            <input id="cl-from" name="from" type="date" min={today} required />
          </div>
          <div>
            <label htmlFor="cl-to">Bis (optional)</label>
            <input id="cl-to" name="to" type="date" min={today} />
          </div>
          <div>
            <label htmlFor="cl-reason">Grund (optional)</label>
            <input id="cl-reason" name="reason" placeholder="Betriebsferien" />
          </div>
          <div className="self-end">
            <SubmitButton>Hinzufügen</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
