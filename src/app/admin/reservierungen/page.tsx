import Link from "next/link";
import { Suspense } from "react";
import { createReservationManually } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/admin/form-bits";
import { ReservationCard } from "@/components/admin/reservation-card";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDateDE, todayISO } from "@/lib/dates";

export const metadata = { title: "Reservierungen" };

export default function ReservationsPage(props: PageProps<"/admin/reservierungen">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Reservations searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Reservations({ searchParams }: Pick<PageProps<"/admin/reservierungen">, "searchParams">) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const showCancelled = sp.alle === "1";

  let q = supabase.from("reservations").select("*").eq("date", date).order("start_time");
  if (!showCancelled) q = q.neq("status", "cancelled");
  const { data: rows } = await q;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?date=${addDays(date, -1)}`} className="btn-ghost" aria-label="Vorheriger Tag">
            ←
          </Link>
          <form className="contents">
            <input type="date" name="date" defaultValue={date} className="!w-auto" />
            <button className="btn-ghost">Gehe zu</button>
          </form>
          <Link href={`?date=${addDays(date, 1)}`} className="btn-ghost" aria-label="Nächster Tag">
            →
          </Link>
          {date !== today && (
            <Link href="/admin/reservierungen" className="text-xs text-muted underline">
              Heute
            </Link>
          )}
        </div>
        <Link href={`?date=${date}${showCancelled ? "" : "&alle=1"}`} className="text-xs text-muted underline">
          {showCancelled ? "Stornierte ausblenden" : "Stornierte anzeigen"}
        </Link>
      </div>

      <h1 className="font-serif text-3xl">{fmtDateDE(date, { weekday: "long" })}</h1>

      {rows && rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((r) => (
            <ReservationCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <p className="card text-sm text-muted">Keine Reservierungen an diesem Tag.</p>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">Reservierung manuell eintragen (Telefon / vor Ort)</summary>
        <ActionForm action={createReservationManually} className="mt-4 grid gap-3 sm:grid-cols-2" successText="Eingetragen.">
          <div>
            <label htmlFor="m-name">Name</label>
            <input id="m-name" name="name" required />
          </div>
          <div>
            <label htmlFor="m-phone">Telefon</label>
            <input id="m-phone" name="phone" type="tel" />
          </div>
          <div>
            <label htmlFor="m-date">Datum</label>
            <input id="m-date" name="date" type="date" defaultValue={date} required />
          </div>
          <div>
            <label htmlFor="m-time">Uhrzeit</label>
            <input id="m-time" name="time" type="time" step={900} required />
          </div>
          <div>
            <label htmlFor="m-party">Personen</label>
            <input id="m-party" name="party_size" type="number" min={1} max={50} defaultValue={2} required />
          </div>
          <div>
            <label htmlFor="m-email">E-Mail</label>
            <input id="m-email" name="email" type="email" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="m-notes">Notiz</label>
            <input id="m-notes" name="notes" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Als bestätigt eintragen</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </div>
  );
}
