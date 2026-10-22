import Link from "next/link";
import { Suspense } from "react";
import { ArrowIcon } from "@/components/icons";
import { StaffLoadError, StaffLoading } from "@/components/staff/card-bits";
import { MonthCalendar } from "@/components/staff/month-calendar";
import { StaffReservationForm } from "@/components/staff/staff-reservation-form";
import { ReservationCard } from "@/components/staff/reservation-card";
import { loadCalendarMonth, monthParam } from "@/lib/staff-calendar";
import { requireStaff } from "@/lib/auth";
import { getReservationSettings } from "@/lib/data";
import { addDays, fmtStaffDate, isISODate, todayISO } from "@/lib/dates";

export const metadata = { title: "Reservas" };

export default function ReservationsPage(props: PageProps<"/staff/reservierungen">) {
  return (
    <Suspense fallback={<StaffLoading />}>
      <Reservations searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Reservations({ searchParams }: Pick<PageProps<"/staff/reservierungen">, "searchParams">) {
  const { supabase } = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();
  // isISODate(), not a shape regex: "2026-99-99" matches /^\d{4}-\d{2}-\d{2}$/ and is then sliced
  // into monthParam() as "2026-99", which throws RangeError while building the calendar grid.
  const date = isISODate(sp.date) ? sp.date : today;
  const month = monthParam(sp, date);
  const showCancelled = sp.alle === "1";

  let q = supabase.from("reservations").select("*").eq("date", date).order("start_time");
  if (!showCancelled) q = q.neq("status", "cancelled");
  const [{ data: rows, error }, cal, settings] = await Promise.all([q, loadCalendarMonth(supabase, month), getReservationSettings()]);
  if (error) {
    console.error("staff/reservierungen", error);
    return <StaffLoadError />;
  }
  const dayHref = (d: string) => `/staff/reservierungen?date=${d}${showCancelled ? "&alle=1" : ""}`;

  return (
    <div className="grid gap-6">
      <h1 className="font-serif text-3xl">Reservas</h1>

      <MonthCalendar
        month={month}
        today={today}
        selected={date}
        days={cal.days}
        weeklyClosed={cal.weeklyClosed}
        hrefForDay={dayHref}
        hrefForMonth={(m) => `/staff/reservierungen?date=${date}&monat=${m}${showCancelled ? "&alle=1" : ""}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={dayHref(addDays(date, -1))} className="btn-ghost" aria-label="Día anterior">
            <ArrowIcon direction="left" size={18} />
          </Link>
          <h2 className="font-serif text-2xl">{fmtStaffDate(date, { weekday: "long" })}</h2>
          <Link href={dayHref(addDays(date, 1))} className="btn-ghost" aria-label="Día siguiente">
            <ArrowIcon direction="right" size={18} />
          </Link>
          {date !== today && (
            <Link href="/staff/reservierungen" className="text-xs text-muted underline">
              Hoy
            </Link>
          )}
        </div>
        <Link href={`?date=${date}${showCancelled ? "" : "&alle=1"}`} className="text-xs text-muted underline">
          {showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
        </Link>
      </div>

      {rows && rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((r) => (
            <ReservationCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <p className="card text-sm text-muted">No hay reservas para este día.</p>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">Añadir una reserva manualmente (por teléfono o en el local)</summary>
        <StaffReservationForm date={date} maxPartySize={settings.max_party_size} />
      </details>
    </div>
  );
}
